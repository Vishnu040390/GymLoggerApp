using GYM.Application.Common;
using GYM.Domain.Entities;
using GYM.Domain.Enums;
using GYM.Domain.Exceptions;

namespace GYM.Application.Workouts;

/// <summary>Workout session lifecycle: start → log → complete or cancel (spec §10, §11).</summary>
public sealed class WorkoutService(
    IWorkoutRepository workouts,
    IWorkoutExerciseRepository workoutExercises,
    ICurrentUser currentUser,
    IUnitOfWork unitOfWork,
    IAuditLogger audit,
    IClock clock)
{
    public async Task<PagedResult<WorkoutSessionDto>> ListAsync(WorkoutListQuery query, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        if (query.Status is not null && !Enum.TryParse<WorkoutStatus>(query.Status, ignoreCase: false, out _))
        {
            throw new ValidationException("status", "Status must be InProgress, Completed or Cancelled.");
        }

        var pageSize = Math.Clamp(query.PageSize ?? 20, 1, 50);
        var page = Math.Max(1, query.Page ?? 1);
        var (items, total) = await workouts.ListForUserAsync(
            userId, new WorkoutFilter(query.Status, query.Date, query.From, query.ExerciseId), (page - 1) * pageSize, pageSize, ct);
        return new PagedResult<WorkoutSessionDto>(items.Select(s => s.ToDto()).ToList(), page, pageSize, total);
    }

    public async Task<WorkoutSessionDto?> GetActiveAsync(CancellationToken ct = default)
    {
        var active = await workouts.GetActiveForUserAsync(currentUser.RequireUserId(), ct);
        return active?.ToDto();
    }

    public async Task<WorkoutSessionDto> GetAsync(Guid id, CancellationToken ct = default) =>
        (await GetOwnedAsync(id, ct)).ToDto();

    /// <summary>
    /// Starts a session. The date is captured automatically from the client's calendar date.
    /// Any number of sessions may share a date, but only one can be in progress (decision D2).
    /// </summary>
    public async Task<WorkoutSessionDto> StartAsync(StartWorkoutRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        if (request.WorkoutDate is not { } date)
        {
            throw new ValidationException("workoutDate", "Workout date is required.");
        }

        var utcToday = DateOnly.FromDateTime(clock.UtcNow);
        if (Math.Abs(date.DayNumber - utcToday.DayNumber) > 1)
        {
            throw new ValidationException("workoutDate", "Workout date must be today.");
        }

        var active = await workouts.GetActiveForUserAsync(userId, ct);
        if (active is not null)
        {
            throw new ConflictException("You already have a workout in progress.", null, new { activeWorkoutId = active.Id });
        }

        var session = new WorkoutSession
        {
            UserId = userId,
            WorkoutDate = date,
            StartTime = clock.UtcNow,
            Status = WorkoutStatus.InProgress,
            TimeZoneId = ValidTimeZone(request.TimeZone),
        };
        workouts.Add(session);
        audit.Record("StartWorkout", nameof(WorkoutSession), null);
        await unitOfWork.SaveChangesAsync(ct);
        return session.ToDto();
    }

    /// <summary>Completes a session. Exercises without sets are removed first (decision D9).</summary>
    public async Task<WorkoutSessionDto> CompleteAsync(Guid id, CancellationToken ct = default)
    {
        var session = await GetOwnedAsync(id, ct);
        session.Complete(clock.UtcNow);

        await unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            foreach (var empty in session.Exercises.Where(e => e.Sets.Count == 0).ToList())
            {
                session.Exercises.Remove(empty);
                workoutExercises.Remove(empty);
            }

            audit.Record("CompleteWorkout", nameof(WorkoutSession), id.ToString());
            await unitOfWork.SaveChangesAsync(ct);
            await Sequencing.RenumberAsync(session.Exercises.OrderBy(e => e.DisplayOrder).ToList(), e => e.DisplayOrder, (e, n) => e.DisplayOrder = n, unitOfWork, ct);
        }, ct);

        return session.ToDto();
    }

    public async Task<WorkoutSessionDto> CancelAsync(Guid id, CancellationToken ct = default)
    {
        var session = await GetOwnedAsync(id, ct);
        session.Cancel(clock.UtcNow);
        audit.Record("CancelWorkout", nameof(WorkoutSession), id.ToString());
        await unitOfWork.SaveChangesAsync(ct);
        return session.ToDto();
    }

    private async Task<WorkoutSession> GetOwnedAsync(Guid id, CancellationToken ct) =>
        await workouts.GetForUserAsync(id, currentUser.RequireUserId(), withDetails: true, ct)
        ?? throw new NotFoundException("Workout not found.");

    private static string? ValidTimeZone(string? id)
    {
        if (string.IsNullOrWhiteSpace(id) || id.Length > 64)
        {
            return null;
        }

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(id).Id;
        }
        catch (TimeZoneNotFoundException)
        {
            return null;
        }
        catch (InvalidTimeZoneException)
        {
            return null;
        }
    }
}

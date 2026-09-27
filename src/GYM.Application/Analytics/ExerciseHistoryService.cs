using GYM.Application.Common;
using GYM.Domain.Exceptions;
using GYM.Domain.Rules;

namespace GYM.Application.Analytics;

/// <summary>Exercise history and session-to-session comparison, computed from stored history (spec §12).</summary>
public sealed class ExerciseHistoryService(
    IExerciseRepository exercises,
    IWorkoutRepository workouts,
    IExerciseAnalyticsRepository analytics,
    ICurrentUser currentUser)
{
    public async Task<ExerciseHistoryDto> HistoryAsync(Guid exerciseId, Guid? excludeWorkoutId, int? limit, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var exercise = await exercises.GetAsync(exerciseId, ct) ?? throw new NotFoundException("Exercise not found.");
        var entries = (await analytics.CompletedEntriesAsync(userId, exerciseId, excludeWorkoutId, ct))
            .OrderByDescending(e => e.WorkoutDate).ThenByDescending(e => e.StartTime).ToList();

        var items = entries.Select((e, i) =>
        {
            var total = SetMath.Total(e.Sets);
            int? delta = i + 1 < entries.Count ? total - SetMath.Total(entries[i + 1].Sets) : null;
            return new HistoryEntryDto(e.WorkoutId, e.WorkoutExerciseId, e.WorkoutDate, e.StartTime, e.EndTime, e.Label, e.Sets, total, SetMath.Best(e.Sets), delta);
        });
        if (limit is > 0)
        {
            items = items.Take(limit.Value);
        }

        return new ExerciseHistoryDto(exercise.ToDto(), items.ToList());
    }

    /// <summary>Read-only comparison of any two of the caller's sessions for one exercise.</summary>
    public async Task<ComparisonDto> CompareAsync(Guid exerciseId, Guid? currentWorkoutId, Guid? previousWorkoutId, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        if (currentWorkoutId is null || previousWorkoutId is null)
        {
            throw new BusinessRuleException("Choose two sessions to compare.");
        }

        var exercise = await exercises.GetAsync(exerciseId, ct) ?? throw new NotFoundException("Exercise not found.");

        async Task<ComparisonSideDto> Side(Guid workoutId)
        {
            var session = await workouts.GetForUserAsync(workoutId, userId, withDetails: true, ct) ?? throw new NotFoundException("Workout not found.");
            var entry = session.Exercises.FirstOrDefault(e => e.ExerciseId == exerciseId)
                ?? throw new BusinessRuleException($"{exercise.Name} is not part of that workout.");
            return new ComparisonSideDto(session.Id, session.WorkoutDate, session.StartTime, session.Status.ToString(), session.Label(), entry.Sets.ToEntries());
        }

        var current = await Side(currentWorkoutId.Value);
        var previous = await Side(previousWorkoutId.Value);
        var result = SetComparison.Compare([.. previous.Sets], [.. current.Sets]);
        return new ComparisonDto(exercise.ToDto(), current, previous, result.Rows, result.Totals);
    }
}

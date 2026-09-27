using GYM.Application.Common;
using GYM.Domain.Entities;
using GYM.Domain.Exceptions;

namespace GYM.Application.WorkoutExercises;

/// <summary>Adding and removing exercises in an in-progress session.</summary>
public sealed class WorkoutExerciseService(
    IWorkoutRepository workouts,
    IWorkoutExerciseRepository workoutExercises,
    IExerciseRepository exercises,
    ICurrentUser currentUser,
    IUnitOfWork unitOfWork)
{
    public async Task<WorkoutExerciseDto> AddAsync(Guid workoutId, AddWorkoutExerciseRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var session = await workouts.GetForUserAsync(workoutId, userId, withDetails: true, ct) ?? throw new NotFoundException("Workout not found.");
        session.EnsureInProgress();

        if (request.ExerciseId is not { } exerciseId)
        {
            throw new ValidationException("exerciseId", "Choose an exercise.");
        }

        var exercise = await exercises.GetAsync(exerciseId, ct) ?? throw new NotFoundException("Exercise not found.");
        if (!exercise.IsActive)
        {
            throw new BusinessRuleException($"{exercise.Name} is no longer available for new workouts.", [new FieldError("exerciseId", "Exercise is inactive.")]);
        }

        // An exercise appears once per session (decision D14).
        if (session.Exercises.Any(e => e.ExerciseId == exerciseId))
        {
            throw new ConflictException($"{exercise.Name} is already in this workout.");
        }

        var entry = new WorkoutExercise
        {
            WorkoutSessionId = session.Id,
            ExerciseId = exerciseId,
            Exercise = exercise,
            DisplayOrder = session.Exercises.Select(e => e.DisplayOrder).DefaultIfEmpty(0).Max() + 1,
        };
        session.Exercises.Add(entry);
        workoutExercises.Add(entry);
        await unitOfWork.SaveChangesAsync(ct);
        return entry.ToDto();
    }

    public async Task RemoveAsync(Guid id, CancellationToken ct = default)
    {
        var entry = await workoutExercises.GetForUserAsync(id, currentUser.RequireUserId(), ct) ?? throw new NotFoundException("Exercise entry not found.");
        var session = entry.WorkoutSession!;
        session.EnsureInProgress();

        await unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            session.Exercises.Remove(entry);
            workoutExercises.Remove(entry);
            await unitOfWork.SaveChangesAsync(ct);
            await Sequencing.RenumberAsync(session.Exercises.OrderBy(e => e.DisplayOrder).ToList(), e => e.DisplayOrder, (e, n) => e.DisplayOrder = n, unitOfWork, ct);
        }, ct);
    }
}

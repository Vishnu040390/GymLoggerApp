using GYM.Application.Common;
using GYM.Domain.Entities;
using GYM.Domain.Exceptions;
using GYM.Domain.Rules;

namespace GYM.Application.WorkoutSets;

/// <summary>Set/count logging. The server assigns set numbers so duplicates are impossible (spec §20).</summary>
public sealed class WorkoutSetService(
    IWorkoutExerciseRepository workoutExercises,
    IWorkoutSetRepository sets,
    ICurrentUser currentUser,
    IUnitOfWork unitOfWork)
{
    public async Task<SetDto> AddAsync(Guid workoutExerciseId, SetCountRequest request, CancellationToken ct = default)
    {
        var entry = await workoutExercises.GetForUserAsync(workoutExerciseId, currentUser.RequireUserId(), ct) ?? throw new NotFoundException("Exercise entry not found.");
        entry.WorkoutSession!.EnsureInProgress();
        var count = ValidCount(request.Count);

        var set = new WorkoutSet
        {
            WorkoutExerciseId = entry.Id,
            SetNumber = entry.Sets.Select(s => s.SetNumber).DefaultIfEmpty(0).Max() + 1,
            Count = count,
        };
        entry.Sets.Add(set);
        sets.Add(set);
        await unitOfWork.SaveChangesAsync(ct);
        return set.ToDto();
    }

    public async Task<SetDto> UpdateAsync(Guid setId, SetCountRequest request, CancellationToken ct = default)
    {
        var set = await sets.GetForUserAsync(setId, currentUser.RequireUserId(), ct) ?? throw new NotFoundException("Set not found.");
        set.WorkoutExercise!.WorkoutSession!.EnsureInProgress();
        set.Count = ValidCount(request.Count);
        await unitOfWork.SaveChangesAsync(ct);
        return set.ToDto();
    }

    /// <summary>Removes a set and closes the gap so numbers stay 1..n (decision D6).</summary>
    public async Task DeleteAsync(Guid setId, CancellationToken ct = default)
    {
        var set = await sets.GetForUserAsync(setId, currentUser.RequireUserId(), ct) ?? throw new NotFoundException("Set not found.");
        var entry = set.WorkoutExercise!;
        entry.WorkoutSession!.EnsureInProgress();

        await unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            entry.Sets.Remove(set);
            sets.Remove(set);
            await unitOfWork.SaveChangesAsync(ct);
            await Sequencing.RenumberAsync(entry.Sets.OrderBy(s => s.SetNumber).ToList(), s => s.SetNumber, (s, n) => s.SetNumber = n, unitOfWork, ct);
        }, ct);
    }

    private static int ValidCount(int? count)
    {
        var error = ValidationRules.Count(count);
        return error is null ? count!.Value : throw new ValidationException("Check the set count.", [new FieldError("count", error)]);
    }
}

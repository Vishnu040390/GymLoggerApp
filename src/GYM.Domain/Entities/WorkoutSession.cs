using GYM.Domain.Enums;
using GYM.Domain.Exceptions;

namespace GYM.Domain.Entities;

/// <summary>
/// One workout. A user may have any number of sessions on the same WorkoutDate;
/// UserId + WorkoutDate is deliberately NOT unique (spec §8, §30).
/// </summary>
public class WorkoutSession : Entity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }

    /// <summary>The user's intended calendar date for the workout (spec §21).</summary>
    public DateOnly WorkoutDate { get; set; }

    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public WorkoutStatus Status { get; set; } = WorkoutStatus.InProgress;

    /// <summary>IANA time zone of the device that started the session; used for display labels.</summary>
    public string? TimeZoneId { get; set; }

    public ICollection<WorkoutExercise> Exercises { get; set; } = new List<WorkoutExercise>();

    public void EnsureInProgress()
    {
        if (Status != WorkoutStatus.InProgress)
        {
            throw new ConflictException($"This workout is {Status.ToString().ToLowerInvariant()} and can no longer be changed.");
        }
    }

    /// <summary>Completes the session. Requires at least one logged set (decision D9).</summary>
    public void Complete(DateTime utcNow)
    {
        EnsureInProgress();
        if (!Exercises.Any(e => e.Sets.Count > 0))
        {
            throw new BusinessRuleException("Log at least one set before finishing, or cancel the workout.");
        }

        Status = WorkoutStatus.Completed;
        EndTime = utcNow;
    }

    public void Cancel(DateTime utcNow)
    {
        EnsureInProgress();
        Status = WorkoutStatus.Cancelled;
        EndTime = utcNow;
    }
}

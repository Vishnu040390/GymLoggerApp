namespace GYM.Domain.Enums;

/// <summary>Lifecycle of a workout session (spec §10).</summary>
public enum WorkoutStatus
{
    InProgress,
    Completed,
    Cancelled,
}

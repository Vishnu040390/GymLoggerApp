namespace GYM.Domain.ValueObjects;

/// <summary>A logged set as used by comparison and analytics calculations.</summary>
public sealed record SetEntry(int SetNumber, int Count);

/// <summary>One completed session's sets for one exercise. Same-day sessions are separate entries.</summary>
public sealed record ExerciseSessionEntry(
    Guid WorkoutId,
    Guid WorkoutExerciseId,
    Guid ExerciseId,
    DateOnly WorkoutDate,
    DateTime StartTime,
    DateTime? EndTime,
    string Label,
    IReadOnlyList<SetEntry> Sets);

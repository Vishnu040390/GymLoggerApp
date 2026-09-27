namespace GYM.Domain.Entities;

/// <summary>
/// One set. The UI may say "Rep 1, Rep 2", but the model is SetNumber + Count so it can
/// later grow weight, RPE/RIR, warm-ups and drop sets (spec §8, §51).
/// WorkoutExerciseId + SetNumber is unique.
/// </summary>
public class WorkoutSet : Entity
{
    public Guid WorkoutExerciseId { get; set; }
    public WorkoutExercise? WorkoutExercise { get; set; }
    public int SetNumber { get; set; }
    public int Count { get; set; }
}

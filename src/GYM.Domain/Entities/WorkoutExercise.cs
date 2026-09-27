namespace GYM.Domain.Entities;

/// <summary>An exercise performed within one session. WorkoutSessionId + DisplayOrder is unique.</summary>
public class WorkoutExercise : Entity
{
    public Guid WorkoutSessionId { get; set; }
    public WorkoutSession? WorkoutSession { get; set; }
    public Guid ExerciseId { get; set; }
    public Exercise? Exercise { get; set; }
    public int DisplayOrder { get; set; }
    public ICollection<WorkoutSet> Sets { get; set; } = new List<WorkoutSet>();
}

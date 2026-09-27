namespace GYM.Domain.Entities;

/// <summary>Exercise master maintained by administrators (spec §8).</summary>
public class Exercise : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public Guid CategoryId { get; set; }
    public Category? Category { get; set; }
    public Guid MuscleGroupId { get; set; }
    public MuscleGroup? MuscleGroup { get; set; }
    public Guid EquipmentId { get; set; }
    public Equipment? Equipment { get; set; }
    public string Description { get; set; } = string.Empty;

    /// <summary>One step per line.</summary>
    public string Instructions { get; set; } = string.Empty;

    /// <summary>Inactive exercises stay in history but cannot be added to new workouts.</summary>
    public bool IsActive { get; set; } = true;

    public int DisplayOrder { get; set; }

    public ICollection<ExerciseMedia> Media { get; set; } = new List<ExerciseMedia>();
}

namespace GYM.Domain.Entities;

/// <summary>Admin-managed lookup value used to describe exercises.</summary>
public abstract class ReferenceItem : Entity
{
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }
}

public class Category : ReferenceItem
{
}

public class MuscleGroup : ReferenceItem
{
}

public class Equipment : ReferenceItem
{
}

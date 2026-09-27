namespace GYM.Domain.Entities;

/// <summary>Base for all persisted entities. Timestamps are UTC and maintained by the persistence layer.</summary>
public abstract class Entity
{
    public Guid Id { get; set; }
    public DateTime CreatedDate { get; set; }
    public DateTime ModifiedDate { get; set; }
}

/// <summary>Entities changed by administrators also record who made the change (spec §47).</summary>
public abstract class AuditableEntity : Entity
{
    public Guid? CreatedBy { get; set; }
    public Guid? ModifiedBy { get; set; }
}

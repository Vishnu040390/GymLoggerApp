using GYM.Domain.Enums;

namespace GYM.Domain.Entities;

/// <summary>Photo or tutorial video for an exercise (spec §8).</summary>
public class ExerciseMedia : AuditableEntity
{
    public Guid ExerciseId { get; set; }
    public Exercise? Exercise { get; set; }
    public MediaType MediaType { get; set; }
    public string FileUrl { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }

    /// <summary>Original file name, for display to administrators only. Storage uses a generated name.</summary>
    public string FileName { get; set; } = string.Empty;

    public string MimeType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }

    /// <summary>Describes an image for people using screen readers (required for images, spec §33).</summary>
    public string? AltText { get; set; }

    public string? Title { get; set; }
    public int? DurationSeconds { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

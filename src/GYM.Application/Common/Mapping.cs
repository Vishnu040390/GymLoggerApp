using GYM.Domain.Entities;
using GYM.Domain.Enums;
using GYM.Domain.Rules;
using GYM.Domain.ValueObjects;

namespace GYM.Application.Common;

/// <summary>Entity → contract mapping. Callers must load the navigations each method reads.</summary>
internal static class Mapping
{
    public static UserDto ToDto(this User u) => new(u.Id, u.Email, u.DisplayName, u.Role.ToString());

    public static MediaDto ToDto(this ExerciseMedia m) => new(
        m.Id, m.ExerciseId, m.MediaType.ToString(), m.FileUrl, m.ThumbnailUrl, m.FileName, m.MimeType, m.SizeBytes,
        m.AltText, m.Title, m.DurationSeconds, m.DisplayOrder, m.IsActive, m.CreatedDate, m.ModifiedDate);

    public static MediaDto? PrimaryImage(this Exercise e) => e.Media
        .Where(m => m.IsActive && m.MediaType == MediaType.Image)
        .OrderBy(m => m.DisplayOrder)
        .FirstOrDefault()?.ToDto();

    public static ExerciseDto ToDto(this Exercise e, bool withMedia = false, bool includeInactiveMedia = false)
    {
        var visible = e.Media.Where(m => includeInactiveMedia || m.IsActive).OrderBy(m => m.DisplayOrder).ToList();
        return new ExerciseDto(
            e.Id, e.Name,
            e.CategoryId, e.Category?.Name ?? string.Empty,
            e.MuscleGroupId, e.MuscleGroup?.Name ?? string.Empty,
            e.EquipmentId, e.Equipment?.Name ?? string.Empty,
            e.Description, e.Instructions, e.IsActive, e.DisplayOrder, e.CreatedDate, e.ModifiedDate,
            visible.Count(m => m.MediaType == MediaType.Image),
            visible.Count(m => m.MediaType == MediaType.Video),
            e.PrimaryImage())
        {
            Media = withMedia ? visible.Select(m => m.ToDto()).ToList() : null,
        };
    }

    public static SetDto ToDto(this WorkoutSet s) => new(s.Id, s.SetNumber, s.Count, s.ModifiedDate);

    public static IReadOnlyList<SetEntry> ToEntries(this IEnumerable<WorkoutSet> sets) =>
        sets.OrderBy(s => s.SetNumber).Select(s => new SetEntry(s.SetNumber, s.Count)).ToList();

    public static string Label(this WorkoutSession s) => SessionLabels.For(s.StartTime, s.TimeZoneId);

    public static WorkoutExerciseDto ToDto(this WorkoutExercise we)
    {
        var ex = we.Exercise!;
        return new WorkoutExerciseDto(
            we.Id, ex.Id, ex.Name, we.DisplayOrder,
            ex.Category?.Name ?? string.Empty, ex.MuscleGroup?.Name ?? string.Empty, ex.Equipment?.Name ?? string.Empty,
            ex.IsActive, ex.PrimaryImage(),
            we.Sets.OrderBy(s => s.SetNumber).Select(s => s.ToDto()).ToList());
    }

    public static WorkoutSessionDto ToDto(this WorkoutSession s)
    {
        var exercises = s.Exercises.OrderBy(e => e.DisplayOrder).Select(e => e.ToDto()).ToList();
        var sets = exercises.SelectMany(e => e.Sets).ToList();
        return new WorkoutSessionDto(
            s.Id, s.WorkoutDate, s.StartTime, s.EndTime, s.Status.ToString(), s.Label(),
            s.EndTime.HasValue ? (long)(s.EndTime.Value - s.StartTime).TotalMilliseconds : null,
            exercises,
            new SessionTotalsDto(exercises.Count, sets.Count, sets.Sum(x => x.Count)),
            s.CreatedDate, s.ModifiedDate);
    }
}

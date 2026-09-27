using System.Text.Json.Serialization;
using GYM.Domain.Rules;
using GYM.Domain.ValueObjects;

namespace GYM.Application.Common;

// Response contracts. Property names serialise to camelCase and are the stable
// /api/v1 contract shared by the web UI now and React / React Native later (spec §52).

public sealed record UserDto(Guid Id, string Email, string DisplayName, string Role);

public sealed record MediaDto(
    Guid Id,
    Guid ExerciseId,
    string MediaType,
    string FileUrl,
    string? ThumbnailUrl,
    string FileName,
    string MimeType,
    long SizeBytes,
    string? AltText,
    string? Title,
    int? DurationSeconds,
    int DisplayOrder,
    bool IsActive,
    DateTime CreatedDate,
    DateTime ModifiedDate);

public sealed record LastPerformanceDto(Guid WorkoutId, DateOnly WorkoutDate, string Label, IReadOnlyList<SetEntry> Sets);

public sealed record ExerciseDto(
    Guid Id,
    string Name,
    Guid CategoryId,
    string CategoryName,
    Guid MuscleGroupId,
    string MuscleGroupName,
    Guid EquipmentId,
    string EquipmentName,
    string Description,
    string Instructions,
    bool IsActive,
    int DisplayOrder,
    DateTime CreatedDate,
    DateTime ModifiedDate,
    int ImageCount,
    int VideoCount,
    MediaDto? PrimaryImage)
{
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<MediaDto>? Media { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public LastPerformanceDto? Last { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? SessionsCount { get; init; }
}

public sealed record ListResult<T>(IReadOnlyList<T> Items, int Total);

public sealed record SetDto(Guid Id, int SetNumber, int Count, DateTime ModifiedDate);

public sealed record WorkoutExerciseDto(
    Guid Id,
    Guid ExerciseId,
    string Name,
    int DisplayOrder,
    string CategoryName,
    string MuscleGroupName,
    string EquipmentName,
    bool IsExerciseActive,
    MediaDto? PrimaryImage,
    IReadOnlyList<SetDto> Sets);

public sealed record SessionTotalsDto(int Exercises, int Sets, int Reps);

public sealed record WorkoutSessionDto(
    Guid Id,
    DateOnly WorkoutDate,
    DateTime StartTime,
    DateTime? EndTime,
    string Status,
    string Label,
    long? DurationMs,
    IReadOnlyList<WorkoutExerciseDto> Exercises,
    SessionTotalsDto Totals,
    DateTime CreatedDate,
    DateTime ModifiedDate);

public sealed record HistoryEntryDto(
    Guid WorkoutId,
    Guid WorkoutExerciseId,
    DateOnly WorkoutDate,
    DateTime StartTime,
    DateTime? EndTime,
    string Label,
    IReadOnlyList<SetEntry> Sets,
    int Total,
    int Best,
    int? DeltaVsPrevious);

public sealed record ExerciseHistoryDto(ExerciseDto Exercise, IReadOnlyList<HistoryEntryDto> Items);

public sealed record ComparisonSideDto(Guid WorkoutId, DateOnly WorkoutDate, DateTime StartTime, string Status, string Label, IReadOnlyList<SetEntry> Sets);

public sealed record ComparisonDto(ExerciseDto Exercise, ComparisonSideDto Current, ComparisonSideDto Previous, IReadOnlyList<ComparisonRow> Rows, ComparisonTotals Totals);

public sealed record AnalyticsDto(
    ExerciseDto Exercise,
    string Range,
    int SessionsCount,
    int SessionsInRange,
    int DistinctDays,
    DateOnly? FirstDate,
    DateOnly? LastDate,
    double FrequencyPerWeek,
    BestSet? BestSet,
    SessionTotal? Last,
    SessionTotal? Previous,
    int? TotalDelta,
    IReadOnlyList<SeriesPoint> Series,
    IReadOnlyList<WeeklyCount> Weekly);

public sealed record PeriodStatsDto(int Sessions, int Sets, int Reps);

public sealed record Last30Dto(int Sessions, int Exercises, int Sets);

public sealed record ExerciseTrendDto(
    Guid ExerciseId,
    string Name,
    string CategoryName,
    bool IsActive,
    int SessionsCount,
    DateOnly LastDate,
    string LastLabel,
    Guid LastWorkoutId,
    IReadOnlyList<SetEntry> LastSets,
    int LastTotal,
    int? PrevTotal,
    int? Delta,
    IReadOnlyList<int> Spark);

public sealed record SummaryDto(PeriodStatsDto ThisWeek, PeriodStatsDto LastWeek, Last30Dto Last30, double AvgPerWeek, IReadOnlyList<ExerciseTrendDto> Exercises);

public sealed record ReferenceItemDto(Guid Id, string Name, bool IsActive, int DisplayOrder, int Usage);

public sealed record ReferenceDataDto(IReadOnlyList<ReferenceItemDto> Categories, IReadOnlyList<ReferenceItemDto> MuscleGroups, IReadOnlyList<ReferenceItemDto> Equipment);

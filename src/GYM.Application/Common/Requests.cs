namespace GYM.Application.Common;

// Request contracts (JSON bodies and query strings of /api/v1).

public sealed record RegisterRequest(string? Email, string? Password, string? DisplayName);

public sealed record LoginRequest(string? Email, string? Password);

public sealed record UpdateProfileRequest(string? DisplayName);

public sealed record ReferenceRequest(string? Name, bool? IsActive);

public sealed record ExerciseRequest(
    string? Name,
    Guid? CategoryId,
    Guid? MuscleGroupId,
    Guid? EquipmentId,
    string? Description,
    string? Instructions,
    int? DisplayOrder,
    bool? IsActive);

public sealed record ExerciseStatusRequest(bool IsActive);

public sealed record MediaUpdateRequest(string? AltText, string? Title, bool? IsActive);

public sealed record MediaReorderRequest(IReadOnlyList<Guid>? Ids);

public sealed record StartWorkoutRequest(DateOnly? WorkoutDate, string? TimeZone);

public sealed record AddWorkoutExerciseRequest(Guid? ExerciseId);

public sealed record SetCountRequest(int? Count);

public sealed record ExerciseListQuery(string? Search, Guid? CategoryId, string? Status, string? Scope, string? Include, Guid? ExcludeWorkoutId, string? Sort);

public sealed record WorkoutListQuery(string? Status, DateOnly? Date, DateOnly? From, Guid? ExerciseId, int? Page, int? PageSize);

public sealed record UploadMediaCommand(string FileName, string? ContentType, long Length, Stream Content, string? AltText, string? Title, int? DurationSeconds);

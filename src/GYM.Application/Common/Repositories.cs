using GYM.Domain.Entities;
using GYM.Domain.ValueObjects;

namespace GYM.Application.Common;

// Repository abstractions organised by business area (spec §6). They handle
// persistence and retrieval only; business decisions live in the services.
// Every workout query takes the caller's userId so one user can never load
// another user's data (spec §15, §26).

public interface IAuthenticationRepository
{
    Task<User?> FindByEmailAsync(string normalizedEmail, CancellationToken ct = default);

    Task<IReadOnlyList<DateTime>> FailedAttemptsSinceAsync(string normalizedEmail, DateTime sinceUtc, CancellationToken ct = default);

    void AddAttempt(LoginAttempt attempt);
}

public interface IUserRepository
{
    Task<User?> GetAsync(Guid id, CancellationToken ct = default);

    Task<bool> EmailExistsAsync(string normalizedEmail, CancellationToken ct = default);

    Task<bool> IsActiveAsync(Guid id, CancellationToken ct = default);

    void Add(User user);
}

public interface IReferenceDataRepository
{
    Task<List<T>> ListAsync<T>(CancellationToken ct = default) where T : ReferenceItem;

    Task<T?> GetAsync<T>(Guid id, CancellationToken ct = default) where T : ReferenceItem;

    Task<bool> NameExistsAsync<T>(string name, Guid? excludeId, CancellationToken ct = default) where T : ReferenceItem;

    /// <summary>Number of exercises that use each reference value.</summary>
    Task<Dictionary<Guid, int>> UsageAsync(CancellationToken ct = default);

    void Add<T>(T item) where T : ReferenceItem;
}

public sealed record ExerciseFilter(bool? IsActive, Guid? CategoryId);

public interface IExerciseRepository
{
    /// <summary>Exercises with category, muscle group, equipment and media loaded.</summary>
    Task<List<Exercise>> ListAsync(ExerciseFilter filter, CancellationToken ct = default);

    Task<Exercise?> GetAsync(Guid id, CancellationToken ct = default);

    Task<bool> NameExistsAsync(string name, Guid? excludeId, CancellationToken ct = default);

    Task<int> MaxDisplayOrderAsync(CancellationToken ct = default);

    void Add(Exercise exercise);
}

public interface IExerciseMediaRepository
{
    Task<List<ExerciseMedia>> ListAsync(Guid exerciseId, bool includeInactive, CancellationToken ct = default);

    Task<ExerciseMedia?> GetAsync(Guid exerciseId, Guid mediaId, CancellationToken ct = default);

    void Add(ExerciseMedia media);

    void Remove(ExerciseMedia media);
}

public sealed record WorkoutFilter(string? Status, DateOnly? Date, DateOnly? From, Guid? ExerciseId);

public interface IWorkoutRepository
{
    /// <summary>The caller's session, or null (also when it belongs to someone else).</summary>
    Task<WorkoutSession?> GetForUserAsync(Guid id, Guid userId, bool withDetails, CancellationToken ct = default);

    Task<WorkoutSession?> GetActiveForUserAsync(Guid userId, CancellationToken ct = default);

    Task<(List<WorkoutSession> Items, int Total)> ListForUserAsync(Guid userId, WorkoutFilter filter, int skip, int take, CancellationToken ct = default);

    void Add(WorkoutSession session);
}

public interface IWorkoutExerciseRepository
{
    /// <summary>Includes the session (with its exercises), the exercise and the sets.</summary>
    Task<WorkoutExercise?> GetForUserAsync(Guid id, Guid userId, CancellationToken ct = default);

    void Add(WorkoutExercise workoutExercise);

    void Remove(WorkoutExercise workoutExercise);
}

public interface IWorkoutSetRepository
{
    /// <summary>Includes the parent workout exercise (with all its sets) and the session.</summary>
    Task<WorkoutSet?> GetForUserAsync(Guid id, Guid userId, CancellationToken ct = default);

    void Add(WorkoutSet set);

    void Remove(WorkoutSet set);
}

public interface IExerciseAnalyticsRepository
{
    /// <summary>Completed sessions' sets per exercise for one user. Read-only; analytics never modify history.</summary>
    Task<List<ExerciseSessionEntry>> CompletedEntriesAsync(Guid userId, Guid? exerciseId, Guid? excludeWorkoutId, CancellationToken ct = default);
}

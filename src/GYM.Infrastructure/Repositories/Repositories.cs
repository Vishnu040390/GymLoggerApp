using GYM.Application.Common;
using GYM.Domain.Entities;
using GYM.Domain.Enums;
using GYM.Domain.Rules;
using GYM.Domain.ValueObjects;
using GYM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GYM.Infrastructure.Repositories;

// Repositories per business area (spec §6). Queries only; no business decisions.

internal sealed class AuthenticationRepository(GymDbContext db) : IAuthenticationRepository
{
    public Task<User?> FindByEmailAsync(string normalizedEmail, CancellationToken ct = default) =>
        db.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, ct);

    /// <summary>Failed attempts since <paramref name="sinceUtc"/> that happened after the last successful sign-in.</summary>
    public async Task<IReadOnlyList<DateTime>> FailedAttemptsSinceAsync(string normalizedEmail, DateTime sinceUtc, CancellationToken ct = default)
    {
        var attempts = await db.LoginAttempts.AsNoTracking()
            .Where(a => a.Email == normalizedEmail && a.AttemptedAt >= sinceUtc)
            .Select(a => new { a.AttemptedAt, a.Succeeded })
            .ToListAsync(ct);
        var lastSuccess = attempts.Where(a => a.Succeeded).Select(a => (DateTime?)a.AttemptedAt).Max();
        return attempts.Where(a => !a.Succeeded && (lastSuccess is null || a.AttemptedAt > lastSuccess)).Select(a => a.AttemptedAt).ToList();
    }

    public void AddAttempt(LoginAttempt attempt) => db.LoginAttempts.Add(attempt);
}

internal sealed class UserRepository(GymDbContext db) : IUserRepository
{
    public Task<User?> GetAsync(Guid id, CancellationToken ct = default) => db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<bool> EmailExistsAsync(string normalizedEmail, CancellationToken ct = default) => db.Users.AnyAsync(u => u.Email == normalizedEmail, ct);

    public Task<bool> IsActiveAsync(Guid id, CancellationToken ct = default) => db.Users.AnyAsync(u => u.Id == id && u.IsActive, ct);

    public void Add(User user) => db.Users.Add(user);
}

internal sealed class ReferenceDataRepository(GymDbContext db) : IReferenceDataRepository
{
    public Task<List<T>> ListAsync<T>(CancellationToken ct = default) where T : ReferenceItem => db.Set<T>().ToListAsync(ct);

    public Task<T?> GetAsync<T>(Guid id, CancellationToken ct = default) where T : ReferenceItem => db.Set<T>().FirstOrDefaultAsync(x => x.Id == id, ct);

    public Task<bool> NameExistsAsync<T>(string name, Guid? excludeId, CancellationToken ct = default) where T : ReferenceItem
    {
        var lower = name.ToLowerInvariant();
        return db.Set<T>().AnyAsync(x => x.Name.ToLower() == lower && (excludeId == null || x.Id != excludeId), ct);
    }

    public async Task<Dictionary<Guid, int>> UsageAsync(CancellationToken ct = default)
    {
        var rows = await db.Exercises.AsNoTracking().Select(e => new { e.CategoryId, e.MuscleGroupId, e.EquipmentId }).ToListAsync(ct);
        return rows.SelectMany(r => new[] { r.CategoryId, r.MuscleGroupId, r.EquipmentId })
            .GroupBy(id => id)
            .ToDictionary(g => g.Key, g => g.Count());
    }

    public void Add<T>(T item) where T : ReferenceItem => db.Set<T>().Add(item);
}

internal sealed class ExerciseRepository(GymDbContext db) : IExerciseRepository
{
    private IQueryable<Exercise> WithDetails() => db.Exercises
        .Include(e => e.Category)
        .Include(e => e.MuscleGroup)
        .Include(e => e.Equipment)
        .Include(e => e.Media)
        .AsSplitQuery();

    public Task<List<Exercise>> ListAsync(ExerciseFilter filter, CancellationToken ct = default)
    {
        var q = WithDetails().AsNoTracking();
        if (filter.IsActive is { } active)
        {
            q = q.Where(e => e.IsActive == active);
        }

        if (filter.CategoryId is { } category)
        {
            q = q.Where(e => e.CategoryId == category);
        }

        return q.ToListAsync(ct);
    }

    public Task<Exercise?> GetAsync(Guid id, CancellationToken ct = default) => WithDetails().FirstOrDefaultAsync(e => e.Id == id, ct);

    public Task<bool> NameExistsAsync(string name, Guid? excludeId, CancellationToken ct = default)
    {
        var lower = name.ToLowerInvariant();
        return db.Exercises.AnyAsync(e => e.Name.ToLower() == lower && (excludeId == null || e.Id != excludeId), ct);
    }

    public async Task<int> MaxDisplayOrderAsync(CancellationToken ct = default) =>
        await db.Exercises.Select(e => (int?)e.DisplayOrder).MaxAsync(ct) ?? 0;

    public void Add(Exercise exercise) => db.Exercises.Add(exercise);
}

internal sealed class ExerciseMediaRepository(GymDbContext db) : IExerciseMediaRepository
{
    public Task<List<ExerciseMedia>> ListAsync(Guid exerciseId, bool includeInactive, CancellationToken ct = default) =>
        db.ExerciseMedia.Where(m => m.ExerciseId == exerciseId && (includeInactive || m.IsActive)).OrderBy(m => m.DisplayOrder).ToListAsync(ct);

    public Task<ExerciseMedia?> GetAsync(Guid exerciseId, Guid mediaId, CancellationToken ct = default) =>
        db.ExerciseMedia.FirstOrDefaultAsync(m => m.Id == mediaId && m.ExerciseId == exerciseId, ct);

    public void Add(ExerciseMedia media) => db.ExerciseMedia.Add(media);

    public void Remove(ExerciseMedia media) => db.ExerciseMedia.Remove(media);
}

internal sealed class WorkoutRepository(GymDbContext db) : IWorkoutRepository
{
    private IQueryable<WorkoutSession> Query(bool withDetails)
    {
        IQueryable<WorkoutSession> q = db.WorkoutSessions;
        if (withDetails)
        {
            q = q.Include(s => s.Exercises).ThenInclude(e => e.Sets)
                .Include(s => s.Exercises).ThenInclude(e => e.Exercise!).ThenInclude(x => x.Category)
                .Include(s => s.Exercises).ThenInclude(e => e.Exercise!).ThenInclude(x => x.MuscleGroup)
                .Include(s => s.Exercises).ThenInclude(e => e.Exercise!).ThenInclude(x => x.Equipment)
                .Include(s => s.Exercises).ThenInclude(e => e.Exercise!).ThenInclude(x => x.Media)
                .AsSplitQuery();
        }

        return q;
    }

    public Task<WorkoutSession?> GetForUserAsync(Guid id, Guid userId, bool withDetails, CancellationToken ct = default) =>
        Query(withDetails).FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId, ct);

    public Task<WorkoutSession?> GetActiveForUserAsync(Guid userId, CancellationToken ct = default) =>
        Query(true).Where(s => s.UserId == userId && s.Status == WorkoutStatus.InProgress).OrderByDescending(s => s.StartTime).FirstOrDefaultAsync(ct);

    public async Task<(List<WorkoutSession> Items, int Total)> ListForUserAsync(Guid userId, WorkoutFilter filter, int skip, int take, CancellationToken ct = default)
    {
        var q = db.WorkoutSessions.Where(s => s.UserId == userId);
        q = filter.Status is not null && Enum.TryParse<WorkoutStatus>(filter.Status, out var status)
            ? q.Where(s => s.Status == status)
            : q.Where(s => s.Status != WorkoutStatus.InProgress);
        if (filter.Date is { } date)
        {
            q = q.Where(s => s.WorkoutDate == date);
        }

        if (filter.From is { } from)
        {
            q = q.Where(s => s.WorkoutDate >= from);
        }

        if (filter.ExerciseId is { } exerciseId)
        {
            q = q.Where(s => s.Exercises.Any(e => e.ExerciseId == exerciseId));
        }

        var total = await q.CountAsync(ct);
        var ids = await q.OrderByDescending(s => s.WorkoutDate).ThenByDescending(s => s.StartTime).Skip(skip).Take(take).Select(s => s.Id).ToListAsync(ct);
        var items = await Query(true).AsNoTracking().Where(s => ids.Contains(s.Id)).ToListAsync(ct);
        return (items.OrderBy(s => ids.IndexOf(s.Id)).ToList(), total);
    }

    public void Add(WorkoutSession session) => db.WorkoutSessions.Add(session);
}

internal sealed class WorkoutExerciseRepository(GymDbContext db) : IWorkoutExerciseRepository
{
    public Task<WorkoutExercise?> GetForUserAsync(Guid id, Guid userId, CancellationToken ct = default) =>
        db.WorkoutExercises
            .Include(e => e.WorkoutSession!).ThenInclude(s => s.Exercises)
            .Include(e => e.Sets)
            .Include(e => e.Exercise)
            .AsSplitQuery()
            .FirstOrDefaultAsync(e => e.Id == id && e.WorkoutSession!.UserId == userId, ct);

    public void Add(WorkoutExercise workoutExercise) => db.WorkoutExercises.Add(workoutExercise);

    public void Remove(WorkoutExercise workoutExercise) => db.WorkoutExercises.Remove(workoutExercise);
}

internal sealed class WorkoutSetRepository(GymDbContext db) : IWorkoutSetRepository
{
    public Task<WorkoutSet?> GetForUserAsync(Guid id, Guid userId, CancellationToken ct = default) =>
        db.WorkoutSets
            .Include(s => s.WorkoutExercise!).ThenInclude(e => e.Sets)
            .Include(s => s.WorkoutExercise!).ThenInclude(e => e.WorkoutSession)
            .AsSplitQuery()
            .FirstOrDefaultAsync(s => s.Id == id && s.WorkoutExercise!.WorkoutSession!.UserId == userId, ct);

    public void Add(WorkoutSet set) => db.WorkoutSets.Add(set);

    public void Remove(WorkoutSet set) => db.WorkoutSets.Remove(set);
}

internal sealed class ExerciseAnalyticsRepository(GymDbContext db) : IExerciseAnalyticsRepository
{
    public async Task<List<ExerciseSessionEntry>> CompletedEntriesAsync(Guid userId, Guid? exerciseId, Guid? excludeWorkoutId, CancellationToken ct = default)
    {
        var q = db.WorkoutExercises.AsNoTracking()
            .Where(e => e.WorkoutSession!.UserId == userId && e.WorkoutSession.Status == WorkoutStatus.Completed);
        if (exerciseId is { } ex)
        {
            q = q.Where(e => e.ExerciseId == ex);
        }

        if (excludeWorkoutId is { } exclude)
        {
            q = q.Where(e => e.WorkoutSessionId != exclude);
        }

        var rows = await q.Select(e => new
        {
            e.Id,
            e.ExerciseId,
            e.WorkoutSessionId,
            e.WorkoutSession!.WorkoutDate,
            e.WorkoutSession.StartTime,
            e.WorkoutSession.EndTime,
            e.WorkoutSession.TimeZoneId,
            Sets = e.Sets.OrderBy(s => s.SetNumber).Select(s => new SetEntry(s.SetNumber, s.Count)).ToList(),
        }).AsSplitQuery().ToListAsync(ct);

        return rows
            .Where(r => r.Sets.Count > 0)
            .Select(r => new ExerciseSessionEntry(r.WorkoutSessionId, r.Id, r.ExerciseId, r.WorkoutDate, r.StartTime, r.EndTime, SessionLabels.For(r.StartTime, r.TimeZoneId), r.Sets))
            .ToList();
    }
}

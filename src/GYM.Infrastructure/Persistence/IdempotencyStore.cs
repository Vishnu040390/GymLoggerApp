using GYM.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace GYM.Infrastructure.Persistence;

/// <summary>
/// Uses its own DbContext so it never saves (or is affected by) the request's pending changes.
/// A unique index on (UserId, Key, Method, Path) makes concurrent duplicates impossible.
/// </summary>
internal sealed class IdempotencyStore(IDbContextFactory<GymDbContext> factory, IClock clock) : IIdempotencyStore
{
    public static readonly TimeSpan Retention = TimeSpan.FromHours(24);

    public async Task<IdempotencyLookup> BeginAsync(Guid userId, string key, string method, string path, CancellationToken ct = default)
    {
        await using var db = await factory.CreateDbContextAsync(ct);
        var cutoff = clock.UtcNow - Retention;
        var existing = await db.IdempotencyRecords.FirstOrDefaultAsync(r => r.UserId == userId && r.Key == key && r.Method == method && r.Path == path, ct);
        if (existing is not null && existing.CreatedDate < cutoff)
        {
            db.IdempotencyRecords.Remove(existing);
            await db.SaveChangesAsync(ct);
            existing = null;
        }

        if (existing is not null)
        {
            return existing.StatusCode == 0
                ? new IdempotencyLookup(IdempotencyState.InProgress, existing.Id)
                : new IdempotencyLookup(IdempotencyState.Completed, existing.Id, existing.StatusCode, existing.ResponseBody);
        }

        var record = new IdempotencyRecord { UserId = userId, Key = key, Method = method, Path = path, CreatedDate = clock.UtcNow };
        db.IdempotencyRecords.Add(record);
        try
        {
            await db.SaveChangesAsync(ct);
            return new IdempotencyLookup(IdempotencyState.New, record.Id);
        }
        catch (DbUpdateException ex) when (UnitOfWork.IsUniqueViolation(ex))
        {
            return new IdempotencyLookup(IdempotencyState.InProgress, Guid.Empty);
        }
    }

    public async Task CompleteAsync(Guid recordId, int statusCode, string body, CancellationToken ct = default)
    {
        await using var db = await factory.CreateDbContextAsync(ct);
        var record = await db.IdempotencyRecords.FindAsync([recordId], ct);
        if (record is null)
        {
            return;
        }

        record.StatusCode = statusCode;
        record.ResponseBody = body;
        await db.SaveChangesAsync(ct);
    }

    public async Task AbandonAsync(Guid recordId, CancellationToken ct = default)
    {
        await using var db = await factory.CreateDbContextAsync(ct);
        await db.IdempotencyRecords.Where(r => r.Id == recordId).ExecuteDeleteAsync(ct);
    }
}

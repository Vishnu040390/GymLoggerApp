using GYM.Domain.Enums;
using GYM.Domain.Exceptions;

namespace GYM.Application.Common;

/// <summary>Current time. Injected so date boundaries can be tested (spec §21).</summary>
public interface IClock
{
    DateTime UtcNow { get; }
}

/// <summary>The authenticated caller, resolved by the web layer.</summary>
public interface ICurrentUser
{
    Guid? UserId { get; }

    bool IsAdmin { get; }
}

public static class CurrentUserExtensions
{
    public static Guid RequireUserId(this ICurrentUser user) =>
        user.UserId ?? throw new AuthenticationFailedException("Your session has expired. Sign in again.");

    /// <summary>Defence in depth: admin endpoints are also protected by role policies in the web layer.</summary>
    public static Guid RequireAdmin(this ICurrentUser user)
    {
        var id = user.RequireUserId();
        return user.IsAdmin ? id : throw new ForbiddenException("You don't have permission to do that.");
    }
}

public interface IUnitOfWork
{
    /// <summary>Saves pending changes. Unique-constraint violations surface as <see cref="ConflictException"/>.</summary>
    Task SaveChangesAsync(CancellationToken ct = default);

    Task ExecuteInTransactionAsync(Func<Task> work, CancellationToken ct = default);
}

public interface IAuditLogger
{
    /// <summary>Queues an audit record; it is written with the next save. Never pass secrets.</summary>
    void Record(string action, string entityName, string? entityId, string? oldValue = null, string? newValue = null);
}

public interface IPasswordHasher
{
    string Hash(string password);

    bool Verify(string hash, string password);
}

public interface IFileStorage
{
    /// <summary>Stores content under a generated name and returns its public URL.</summary>
    Task<string> SaveAsync(Stream content, string extension, CancellationToken ct = default);

    Task DeleteAsync(string fileUrl, CancellationToken ct = default);
}

/// <summary>Checks file contents (magic bytes), not just the declared type (spec §23).</summary>
public interface IMediaInspector
{
    Task<bool> MatchesAsync(Stream content, MediaType type, string extension, CancellationToken ct = default);
}

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total);

public enum IdempotencyState
{
    New,
    Completed,
    InProgress,
}

public sealed record IdempotencyLookup(IdempotencyState State, Guid RecordId, int StatusCode = 0, string? Body = null);

/// <summary>
/// Remembers responses to POST requests sent with an Idempotency-Key header, so a retried
/// or double-clicked request can never create a second record (spec §36).
/// </summary>
public interface IIdempotencyStore
{
    Task<IdempotencyLookup> BeginAsync(Guid userId, string key, string method, string path, CancellationToken ct = default);

    Task CompleteAsync(Guid recordId, int statusCode, string body, CancellationToken ct = default);

    Task AbandonAsync(Guid recordId, CancellationToken ct = default);
}

using GYM.Application.Common;
using GYM.Domain.Entities;
using GYM.Infrastructure.Persistence;
using Microsoft.Extensions.Logging;

namespace GYM.Infrastructure.Logging;

/// <summary>Writes audit records (spec §47) and a matching structured log line (spec §22). Never log secrets.</summary>
internal sealed class AuditLogger(GymDbContext db, ICurrentUser currentUser, IClock clock, ILogger<AuditLogger> logger) : IAuditLogger
{
    public void Record(string action, string entityName, string? entityId, string? oldValue = null, string? newValue = null)
    {
        db.AuditLogs.Add(new AuditLog
        {
            UserId = currentUser.UserId,
            Action = action,
            EntityName = entityName,
            EntityId = entityId,
            OldValue = Trim(oldValue),
            NewValue = Trim(newValue),
            CreatedDate = clock.UtcNow,
        });
        logger.LogInformation("Audit {Action} {EntityName} {EntityId} by {UserId}", action, entityName, entityId, currentUser.UserId);
    }

    private static string? Trim(string? v) => v is null || v.Length <= 1000 ? v : v[..1000];
}

internal sealed class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}

using GYM.Application.Common;
using GYM.Domain.Entities;
using GYM.Domain.Exceptions;
using Microsoft.Data.SqlClient;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace GYM.Infrastructure.Persistence;

internal sealed class UnitOfWork(GymDbContext db, IClock clock) : IUnitOfWork
{
    public async Task SaveChangesAsync(CancellationToken ct = default)
    {
        Stamp();
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            throw new ConflictException("This was changed somewhere else at the same time. Reload and try again.");
        }
    }

    public async Task ExecuteInTransactionAsync(Func<Task> work, CancellationToken ct = default)
    {
        if (db.Database.CurrentTransaction is not null)
        {
            await work();
            return;
        }

        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await work();
            await tx.CommitAsync(ct);
        });
    }

    internal static bool IsUniqueViolation(DbUpdateException ex) => ex.InnerException switch
    {
        SqlException sql => sql.Number is 2601 or 2627,
        SqliteException lite => lite.SqliteErrorCode == 19 && lite.SqliteExtendedErrorCode is 2067 or 1555,
        _ => false,
    };

    private void Stamp()
    {
        var now = clock.UtcNow;
        foreach (var entry in db.ChangeTracker.Entries<Entity>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.CreatedDate == default)
                {
                    entry.Entity.CreatedDate = now;
                }

                if (entry.Entity.ModifiedDate == default)
                {
                    entry.Entity.ModifiedDate = entry.Entity.CreatedDate;
                }
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.ModifiedDate = now;
            }
        }
    }
}

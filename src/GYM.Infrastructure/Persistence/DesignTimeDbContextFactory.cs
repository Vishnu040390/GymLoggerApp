using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace GYM.Infrastructure.Persistence;

/// <summary>Used by `dotnet ef` to build SQL Server migrations. The connection string is not used to generate them.</summary>
internal sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<GymDbContext>
{
    public GymDbContext CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<GymDbContext>()
        .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=GymLogger;Trusted_Connection=True;TrustServerCertificate=True")
        .Options);
}

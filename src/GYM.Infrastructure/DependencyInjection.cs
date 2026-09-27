using GYM.Application.Common;
using GYM.Infrastructure.Authentication;
using GYM.Infrastructure.Logging;
using GYM.Infrastructure.Persistence;
using GYM.Infrastructure.Repositories;
using GYM.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GYM.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration, string contentRoot)
    {
        var database = configuration.GetSection(DatabaseOptions.Section).Get<DatabaseOptions>() ?? new DatabaseOptions();
        var connectionString = configuration.GetConnectionString("Gym")
            ?? throw new InvalidOperationException("Connection string 'Gym' is not configured. Set ConnectionStrings__Gym.");
        services.Configure<DatabaseOptions>(configuration.GetSection(DatabaseOptions.Section));
        services.Configure<SeedOptions>(configuration.GetSection(SeedOptions.Section));
        services.Configure<MediaStorageOptions>(configuration.GetSection(MediaStorageOptions.Section));
        services.PostConfigure<MediaStorageOptions>(o => o.RootPath = Path.GetFullPath(Path.Combine(contentRoot, o.RootPath)));

        void Configure(DbContextOptionsBuilder options)
        {
            if (database.Provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
            {
                options.UseSqlite(connectionString);
            }
            else
            {
                options.UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure());
            }
        }

        // The factory serves the idempotency store (its own context); requests get a scoped context.
        services.AddDbContextFactory<GymDbContext>(Configure);
        services.AddScoped(sp => sp.GetRequiredService<IDbContextFactory<GymDbContext>>().CreateDbContext());

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IAuditLogger, AuditLogger>();
        services.AddScoped<IIdempotencyStore, IdempotencyStore>();
        services.AddScoped<DatabaseInitializer>();

        services.AddScoped<IAuthenticationRepository, AuthenticationRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IReferenceDataRepository, ReferenceDataRepository>();
        services.AddScoped<IExerciseRepository, ExerciseRepository>();
        services.AddScoped<IExerciseMediaRepository, ExerciseMediaRepository>();
        services.AddScoped<IWorkoutRepository, WorkoutRepository>();
        services.AddScoped<IWorkoutExerciseRepository, WorkoutExerciseRepository>();
        services.AddScoped<IWorkoutSetRepository, WorkoutSetRepository>();
        services.AddScoped<IExerciseAnalyticsRepository, ExerciseAnalyticsRepository>();

        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton<IPasswordHasher, IdentityPasswordHasher>();
        services.AddSingleton<IFileStorage, LocalFileStorage>();
        services.AddSingleton<IMediaInspector, MediaInspector>();
        return services;
    }
}

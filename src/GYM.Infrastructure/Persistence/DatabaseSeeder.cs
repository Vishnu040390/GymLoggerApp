using GYM.Application.Common;
using GYM.Domain.Entities;
using GYM.Domain.Enums;
using GYM.Domain.Rules;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace GYM.Infrastructure.Persistence;

public sealed class DatabaseOptions
{
    public const string Section = "Database";

    /// <summary>"SqlServer" (default, spec §2) or "Sqlite" (local runs without SQL Server, and tests).</summary>
    public string Provider { get; set; } = "SqlServer";

    /// <summary>Apply EF Core migrations on start-up (SQL Server). Keep false in production; migrate through the release pipeline (spec §43).</summary>
    public bool ApplyMigrationsOnStartup { get; set; }
}

public sealed class SeedOptions
{
    public const string Section = "Seed";

    /// <summary>Create the starter categories, muscle groups, equipment and exercises when the library is empty.</summary>
    public bool ReferenceData { get; set; } = true;

    /// <summary>Bootstrap administrator. Supply through user secrets or environment variables, never appsettings in production.</summary>
    public string? AdminEmail { get; set; }

    public string? AdminPassword { get; set; }

    /// <summary>Development only: demo accounts with eight weeks of workout history.</summary>
    public bool DemoData { get; set; }

    /// <summary>Time zone used for demo session times and labels.</summary>
    public string DemoTimeZone { get; set; } = "UTC";
}

/// <summary>Creates or migrates the database and seeds starter data.</summary>
public sealed class DatabaseInitializer(
    GymDbContext db,
    IUnitOfWork unitOfWork,
    Application.Common.IPasswordHasher hasher,
    IClock clock,
    IOptions<DatabaseOptions> database,
    IOptions<SeedOptions> seed,
    ILogger<DatabaseInitializer> logger)
{
    public async Task InitializeAsync(CancellationToken ct = default)
    {
        if (database.Value.Provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
        {
            // SQLite is for local runs and tests: create the folder and schema directly (no migrations).
            var file = new SqliteConnectionStringBuilder(db.Database.GetConnectionString()).DataSource;
            var folder = Path.GetDirectoryName(file);
            if (!string.IsNullOrEmpty(folder) && !file.Contains(":memory:", StringComparison.Ordinal))
            {
                Directory.CreateDirectory(folder);
            }

            await db.Database.EnsureCreatedAsync(ct);
        }
        else if (database.Value.ApplyMigrationsOnStartup)
        {
            await db.Database.MigrateAsync(ct);
        }

        var options = seed.Value;
        if (options.ReferenceData && !await db.Categories.AnyAsync(ct))
        {
            SeedLibrary();
            await unitOfWork.SaveChangesAsync(ct);
            logger.LogInformation("Seeded the exercise library");
        }

        if (!string.IsNullOrWhiteSpace(options.AdminEmail) && !string.IsNullOrEmpty(options.AdminPassword))
        {
            await EnsureUserAsync(options.AdminEmail, options.AdminPassword, "Administrator", UserRole.Admin, true, ct);
        }

        if (options.DemoData && !await db.Users.AnyAsync(u => u.Email == "demo@gymlogger.test", ct))
        {
            await SeedDemoAsync(options.DemoTimeZone, ct);
            logger.LogInformation("Seeded demo accounts and workout history");
        }
    }

    private void SeedLibrary()
    {
        var categories = SeedData.Categories.Select((n, i) => new Category { Name = n, DisplayOrder = i + 1 }).ToDictionary(c => c.Name);
        var muscles = SeedData.MuscleGroups.Select((n, i) => new MuscleGroup { Name = n, DisplayOrder = i + 1 }).ToDictionary(c => c.Name);
        var equipment = SeedData.Equipment.Select((n, i) => new Equipment { Name = n, DisplayOrder = i + 1 }).ToDictionary(c => c.Name);
        db.Categories.AddRange(categories.Values);
        db.MuscleGroups.AddRange(muscles.Values);
        db.Equipment.AddRange(equipment.Values);
        var order = 0;
        foreach (var e in SeedData.Exercises)
        {
            db.Exercises.Add(new Exercise
            {
                Name = e.Name,
                Category = categories[e.Category],
                MuscleGroup = muscles[e.Muscle],
                Equipment = equipment[e.Equipment],
                Description = e.Description,
                Instructions = e.Instructions,
                IsActive = e.Active,
                DisplayOrder = order += 10,
            });
        }
    }

    private async Task<User> EnsureUserAsync(string email, string password, string name, UserRole role, bool active, CancellationToken ct)
    {
        var normalized = ValidationRules.NormalizeEmail(email);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == normalized, ct);
        if (user is not null)
        {
            return user;
        }

        user = new User { Email = normalized, DisplayName = name, PasswordHash = hasher.Hash(password), Role = role, IsActive = active };
        db.Users.Add(user);
        await unitOfWork.SaveChangesAsync(ct);
        return user;
    }

    /// <summary>
    /// Eight weeks of Push / Pull / Legs history, including the spec's worked example:
    /// two Bench Press sessions on one day (15/12/10 morning, 12/10/8 afternoon) and an
    /// evening session three days earlier (14/11/9), plus one cancelled session.
    /// </summary>
    private async Task SeedDemoAsync(string timeZoneId, CancellationToken ct)
    {
        var tz = TryZone(timeZoneId);
        var demo = await EnsureUserAsync("demo@gymlogger.test", "Demo@1234", "Alex Morgan", UserRole.User, true, ct);
        var other = await EnsureUserAsync("other@gymlogger.test", "Other@1234", "Jordan Lee", UserRole.User, true, ct);
        await EnsureUserAsync("inactive@gymlogger.test", "Inactive@1234", "Sam Inactive", UserRole.User, false, ct);

        var exercises = await db.Exercises.ToListAsync(ct);
        var byKey = SeedData.Exercises.ToDictionary(e => e.Key, e => (Seed: e, Entity: exercises.First(x => x.Name == e.Name)));
        var random = new Random(20260927);
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(clock.UtcNow, tz);
        var today = DateOnly.FromDateTime(localNow);
        const int horizon = 56;

        int[] Counts(string key, int dayOffset, int[]? overrideCounts)
        {
            if (overrideCounts is not null)
            {
                return overrideCounts;
            }

            var (seed, _) = byKey[key];
            var f = Math.Clamp((horizon - dayOffset) / (double)horizon, 0, 1);
            return seed.From.Select((a, i) => Math.Max(1, (int)Math.Round(a + ((seed.To[i] - a) * f) + ((random.NextDouble() - 0.5) * 1.6)))).ToArray();
        }

        void Add(User user, int dayOffset, string time, IEnumerable<string> keys, WorkoutStatus status = WorkoutStatus.Completed, Dictionary<string, int[]>? overrides = null)
        {
            var date = today.AddDays(-dayOffset);
            var localStart = date.ToDateTime(TimeOnly.Parse(time, System.Globalization.CultureInfo.InvariantCulture));
            var start = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(localStart, DateTimeKind.Unspecified), tz);
            var session = new WorkoutSession { UserId = user.Id, WorkoutDate = date, StartTime = start, Status = status, TimeZoneId = tz.Id, CreatedDate = start };
            var minute = 4;
            var order = 0;
            foreach (var key in keys)
            {
                var entry = new WorkoutExercise { ExerciseId = byKey[key].Entity.Id, DisplayOrder = ++order, CreatedDate = start.AddMinutes(minute) };
                var n = 0;
                foreach (var count in Counts(key, dayOffset, overrides?.GetValueOrDefault(key)))
                {
                    minute += 3;
                    entry.Sets.Add(new WorkoutSet { SetNumber = ++n, Count = count, CreatedDate = start.AddMinutes(minute) });
                }

                minute += 4;
                session.Exercises.Add(entry);
            }

            session.EndTime = start.AddMinutes(minute + 3);
            db.WorkoutSessions.Add(session);
        }

        var times = new Dictionary<DayOfWeek, string> { [DayOfWeek.Monday] = "18:40", [DayOfWeek.Wednesday] = "07:10", [DayOfWeek.Friday] = "18:15", [DayOfWeek.Saturday] = "10:30" };
        string[] kinds = ["push", "pull", "legs"];
        var k = 0;
        for (var off = horizon; off >= 1; off--)
        {
            if (off is 12 or 9 or 5 || !times.TryGetValue(today.AddDays(-off).DayOfWeek, out var time))
            {
                continue;
            }

            var kind = kinds[k++ % 3];
            var list = SeedData.Rotation[kind].AsEnumerable();
            if (kind == "legs" && k % 2 == 0)
            {
                list = list.Where(x => x != "legpress");
            }

            Add(demo, off, time, list);
        }

        Add(demo, 12, "18:40", SeedData.Rotation["push"], overrides: new() { ["bench"] = [14, 11, 9] });
        Add(demo, 9, "07:10", SeedData.Rotation["push"], overrides: new() { ["bench"] = [15, 12, 10] });
        Add(demo, 9, "13:30", ["bench", "pushup"], overrides: new() { ["bench"] = [12, 10, 8], ["pushup"] = [22, 18, 15] });
        Add(demo, 5, "07:30", ["squat"], WorkoutStatus.Cancelled, new() { ["squat"] = [9, 8] });
        Add(other, 9, "06:30", ["bench", "row"], overrides: new() { ["bench"] = [20, 18, 16], ["row"] = [12, 12, 12] });
        Add(other, 4, "19:00", ["squat", "rdl"]);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private static TimeZoneInfo TryZone(string id)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(id);
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.Utc;
        }
    }
}

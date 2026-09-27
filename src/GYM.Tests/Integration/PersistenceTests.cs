using GYM.Domain.Entities;
using GYM.Domain.Enums;
using GYM.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace GYM.Tests.Integration;

/// <summary>Database constraints and relationships (spec §9, §26), checked against a real relational database.</summary>
public sealed class PersistenceTests : IDisposable
{
    private readonly SqliteConnection connection = new("Data Source=:memory:");

    public PersistenceTests()
    {
        connection.Open();

        // EF enables SQLite foreign keys only on connections it opens itself; this one is shared.
        using var pragma = connection.CreateCommand();
        pragma.CommandText = "PRAGMA foreign_keys = ON;";
        pragma.ExecuteNonQuery();
    }

    public void Dispose() => connection.Dispose();

    private GymDbContext NewContext()
    {
        var db = new GymDbContext(new DbContextOptionsBuilder<GymDbContext>().UseSqlite(connection).Options);
        db.Database.EnsureCreated();
        return db;
    }

    private static (User User, Exercise Exercise) Seed(GymDbContext db)
    {
        var user = new User { Email = $"u-{Guid.NewGuid():N}@example.com", PasswordHash = "x", DisplayName = "U" };
        var exercise = new Exercise
        {
            Name = "Bench " + Guid.NewGuid().ToString("N")[..6],
            Category = new Category { Name = "C" + Guid.NewGuid().ToString("N")[..6] },
            MuscleGroup = new MuscleGroup { Name = "M" + Guid.NewGuid().ToString("N")[..6] },
            Equipment = new Equipment { Name = "E" + Guid.NewGuid().ToString("N")[..6] },
        };
        db.AddRange(user, exercise);
        db.SaveChanges();
        return (user, exercise);
    }

    private static WorkoutSession Session(User user, Exercise exercise, DateOnly date, params int[] counts)
    {
        var entry = new WorkoutExercise { ExerciseId = exercise.Id, DisplayOrder = 1 };
        for (var i = 0; i < counts.Length; i++)
        {
            entry.Sets.Add(new WorkoutSet { SetNumber = i + 1, Count = counts[i] });
        }

        return new WorkoutSession { UserId = user.Id, WorkoutDate = date, StartTime = DateTime.UtcNow, Status = WorkoutStatus.Completed, Exercises = { entry } };
    }

    [Fact]
    public void Email_is_unique()
    {
        using var db = NewContext();
        db.Users.Add(new User { Email = "same@example.com", PasswordHash = "x", DisplayName = "A" });
        db.Users.Add(new User { Email = "same@example.com", PasswordHash = "x", DisplayName = "B" });

        Assert.Throws<DbUpdateException>(() => db.SaveChanges());
    }

    [Fact]
    public void Many_sessions_on_the_same_date_are_allowed()
    {
        using var db = NewContext();
        var (user, exercise) = Seed(db);
        var date = new DateOnly(2026, 9, 18);
        db.WorkoutSessions.AddRange(Session(user, exercise, date, 15, 12, 10), Session(user, exercise, date, 12, 10, 8));

        db.SaveChanges();

        Assert.Equal(2, db.WorkoutSessions.Count(s => s.UserId == user.Id && s.WorkoutDate == date));
    }

    [Fact]
    public void Set_numbers_are_unique_within_a_workout_exercise()
    {
        using var db = NewContext();
        var (user, exercise) = Seed(db);
        var session = Session(user, exercise, new DateOnly(2026, 9, 18), 10);
        session.Exercises.First().Sets.Add(new WorkoutSet { SetNumber = 1, Count = 9 });
        db.WorkoutSessions.Add(session);

        Assert.Throws<DbUpdateException>(() => db.SaveChanges());
    }

    [Fact]
    public void Deleting_a_session_removes_its_exercises_and_sets()
    {
        using var db = NewContext();
        var (user, exercise) = Seed(db);
        var session = Session(user, exercise, new DateOnly(2026, 9, 18), 10, 9);
        db.WorkoutSessions.Add(session);
        db.SaveChanges();

        db.WorkoutSessions.Remove(session);
        db.SaveChanges();

        Assert.Equal(0, db.WorkoutExercises.Count());
        Assert.Equal(0, db.WorkoutSets.Count());
    }

    [Fact]
    public void An_exercise_used_in_history_cannot_be_deleted()
    {
        using var db = NewContext();
        var (user, exercise) = Seed(db);
        db.WorkoutSessions.Add(Session(user, exercise, new DateOnly(2026, 9, 18), 10));
        db.SaveChanges();

        // A fresh context has no tracked history rows, so the database itself must refuse (FK Restrict).
        using var other = NewContext();
        other.Exercises.Remove(other.Exercises.Single(e => e.Id == exercise.Id));

        Assert.Throws<DbUpdateException>(() => other.SaveChanges());
    }
}

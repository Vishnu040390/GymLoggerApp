using GYM.Domain.Entities;
using GYM.Domain.Enums;
using GYM.Domain.Exceptions;
using GYM.Domain.Rules;
using GYM.Domain.ValueObjects;

namespace GYM.Tests.Unit;

/// <summary>Domain rules (spec §25). No database required.</summary>
public class DomainRulesTests
{
    private static SetEntry[] Sets(params int[] counts) => counts.Select((c, i) => new SetEntry(i + 1, c)).ToArray();

    [Fact]
    public void Comparison_matches_the_spec_example()
    {
        var result = SetComparison.Compare(Sets(15, 12, 10), Sets(16, 13, 10));

        Assert.Equal([1, 1, 0], result.Rows.Select(r => r.Delta));
        Assert.Equal(new ComparisonTotals(37, 39, 2, 5.4), result.Totals);
    }

    [Fact]
    public void Comparison_never_treats_a_missing_set_as_zero()
    {
        var result = SetComparison.Compare(Sets(15, 12, 10), Sets(16, 13));

        Assert.Equal(3, result.Rows.Count);
        Assert.Equal(new ComparisonRow(3, 10, null, null), result.Rows[2]);
    }

    [Theory]
    [InlineData(4, 0, "Morning")]
    [InlineData(11, 59, "Morning")]
    [InlineData(12, 0, "Afternoon")]
    [InlineData(17, 0, "Evening")]
    [InlineData(21, 0, "Night")]
    [InlineData(3, 59, "Night")]
    public void Session_label_boundaries(int hour, int minute, string expected) =>
        Assert.Equal(expected, SessionLabels.For(new DateTime(2026, 9, 18, hour, minute, 0, DateTimeKind.Unspecified)));

    [Fact]
    public void Session_label_uses_the_session_time_zone()
    {
        var utc = new DateTime(2026, 9, 18, 7, 30, 0, DateTimeKind.Utc);

        Assert.Equal("Morning", SessionLabels.For(utc, "UTC"));
        Assert.Equal("Afternoon", SessionLabels.For(utc, "Asia/Kolkata")); // 13:00 local
        Assert.Equal("Morning", SessionLabels.For(utc, "Not/AZone"));      // unknown → UTC
    }

    [Theory]
    [InlineData("2026-09-27", "2026-09-21")] // Sunday → Monday
    [InlineData("2026-09-21", "2026-09-21")] // Monday
    [InlineData("2026-01-01", "2025-12-29")] // across a year boundary
    public void Weeks_start_on_monday(string date, string expected) =>
        Assert.Equal(DateOnly.Parse(expected, System.Globalization.CultureInfo.InvariantCulture), CalendarRules.WeekStart(DateOnly.Parse(date, System.Globalization.CultureInfo.InvariantCulture)));

    [Fact]
    public void Analytics_keep_same_day_sessions_separate()
    {
        ExerciseSessionEntry Entry(string id, string date, int hour, string label, params int[] counts) =>
            new(Guid.Parse(id), Guid.NewGuid(), Guid.Empty, DateOnly.Parse(date, System.Globalization.CultureInfo.InvariantCulture), new DateTime(2026, 9, 1, hour, 0, 0, DateTimeKind.Utc), null, label, Sets(counts));

        var entries = new[]
        {
            Entry("00000000-0000-0000-0000-000000000015", "2026-09-15", 18, "Evening", 14, 11, 9),
            Entry("00000000-0000-0000-0000-000000000018", "2026-09-18", 7, "Morning", 15, 12, 10),
            Entry("00000000-0000-0000-0000-000000000019", "2026-09-18", 13, "Afternoon", 12, 10, 8),
        };

        var a = ExerciseAnalyticsCalculator.Calculate(entries, new DateOnly(2026, 9, 27), "all");

        Assert.Equal(3, a.SessionsCount);
        Assert.Equal(2, a.DistinctDays);
        Assert.Equal([34, 37, 30], a.Series.Select(p => p.Total));
        Assert.Equal("Afternoon", a.Last!.Label);
        Assert.Equal(-7, a.TotalDelta);
        Assert.Equal(15, a.BestSet!.Count);
        Assert.Equal(3, a.Weekly.Single(w => w.WeekStart == new DateOnly(2026, 9, 14)).Sessions);
    }

    [Fact]
    public void Analytics_are_deterministic_and_safe_when_empty()
    {
        var empty = ExerciseAnalyticsCalculator.Calculate([], new DateOnly(2026, 9, 27), "4w");

        Assert.Equal(0, empty.SessionsCount);
        Assert.Null(empty.Last);
        Assert.Null(empty.TotalDelta);
        Assert.Equal(4, empty.Weekly.Count);
    }

    [Theory]
    [InlineData(null, "Enter a count.")]
    [InlineData(0, "Count must be at least 1.")]
    [InlineData(1000, "Count must be 999 or less.")]
    [InlineData(12, null)]
    public void Set_count_validation(int? count, string? expected) => Assert.Equal(expected, ValidationRules.Count(count));

    [Theory]
    [InlineData("password", false)]
    [InlineData("Password", false)]
    [InlineData("Pass1", false)]
    [InlineData("Password1", true)]
    public void Password_policy(string password, bool valid) => Assert.Equal(valid, ValidationRules.Password(password) is null);

    [Theory]
    [InlineData("bench.jpg", "image/jpeg", 1000, true)]
    [InlineData("demo.mp4", "video/mp4", 1000, true)]
    [InlineData("run.exe", "application/octet-stream", 10, false)]
    [InlineData("fake.jpg", "text/html", 10, false)]
    [InlineData("big.png", "image/png", 6 * 1024 * 1024, false)]
    public void Media_rules_check_extension_type_and_size(string name, string type, long size, bool valid) =>
        Assert.Equal(valid, MediaRules.Check(name, type, size).Rule is not null);

    [Fact]
    public void Completing_requires_at_least_one_set()
    {
        var session = new WorkoutSession { Exercises = { new WorkoutExercise() } };

        Assert.Throws<BusinessRuleException>(() => session.Complete(DateTime.UtcNow));
        Assert.Equal(WorkoutStatus.InProgress, session.Status);
    }

    [Fact]
    public void Finished_sessions_cannot_change()
    {
        var session = new WorkoutSession { Exercises = { new WorkoutExercise { Sets = { new WorkoutSet { SetNumber = 1, Count = 10 } } } } };
        session.Complete(DateTime.UtcNow);

        var ex = Assert.Throws<ConflictException>(session.EnsureInProgress);
        Assert.Contains("completed", ex.Message, StringComparison.Ordinal);
        Assert.Throws<ConflictException>(() => session.Cancel(DateTime.UtcNow));
    }
}

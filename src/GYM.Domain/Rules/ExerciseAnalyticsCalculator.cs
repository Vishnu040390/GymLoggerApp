using GYM.Domain.ValueObjects;

namespace GYM.Domain.Rules;

public sealed record SeriesPoint(Guid WorkoutId, DateOnly WorkoutDate, DateTime StartTime, string Label, int Total, int Best, int SetCount, IReadOnlyList<SetEntry> Sets);

public sealed record BestSet(int Count, Guid WorkoutId, DateOnly WorkoutDate, string Label, int SetNumber);

public sealed record SessionTotal(Guid WorkoutId, DateOnly WorkoutDate, string Label, IReadOnlyList<SetEntry> Sets, int Total);

public sealed record WeeklyCount(DateOnly WeekStart, int Sessions);

public sealed record ExerciseAnalytics(
    int SessionsCount,
    int SessionsInRange,
    int DistinctDays,
    DateOnly? FirstDate,
    DateOnly? LastDate,
    double FrequencyPerWeek,
    BestSet? BestSet,
    SessionTotal? Last,
    SessionTotal? Previous,
    int? TotalDelta,
    IReadOnlyList<SeriesPoint> Series,
    IReadOnlyList<WeeklyCount> Weekly);

/// <summary>
/// Stage-1 exercise analytics (spec §13), derived from completed sessions only and
/// never modifying history. Each session is its own data point, so two sessions on
/// the same date are never merged (spec §30). Deterministic for the same input (§31).
/// </summary>
public static class ExerciseAnalyticsCalculator
{
    public const string RangeFourWeeks = "4w";
    public const string RangeTwelveWeeks = "12w";
    public const string RangeAll = "all";

    public static bool IsValidRange(string range) => range is RangeFourWeeks or RangeTwelveWeeks or RangeAll;

    public static ExerciseAnalytics Calculate(IEnumerable<ExerciseSessionEntry> entries, DateOnly today, string range)
    {
        var sorted = entries.OrderBy(e => e.WorkoutDate).ThenBy(e => e.StartTime).ToList();
        var thisWeek = CalendarRules.WeekStart(today);
        DateOnly? since = range switch
        {
            RangeFourWeeks => thisWeek.AddDays(-21),
            RangeTwelveWeeks => thisWeek.AddDays(-77),
            _ => null,
        };
        var inRange = since is null ? sorted : sorted.Where(e => e.WorkoutDate >= since).ToList();

        var series = inRange.Select(e => new SeriesPoint(e.WorkoutId, e.WorkoutDate, e.StartTime, e.Label, SetMath.Total(e.Sets), SetMath.Best(e.Sets), e.Sets.Count, e.Sets)).ToList();

        BestSet? best = null;
        foreach (var e in sorted)
        {
            foreach (var s in e.Sets)
            {
                if (best is null || s.Count > best.Count)
                {
                    best = new BestSet(s.Count, e.WorkoutId, e.WorkoutDate, e.Label, s.SetNumber);
                }
            }
        }

        var last = sorted.Count > 0 ? sorted[^1] : null;
        var prev = sorted.Count > 1 ? sorted[^2] : null;

        var freqSince = thisWeek.AddDays(-49);
        var frequency = Math.Round(sorted.Count(e => e.WorkoutDate >= freqSince) / 8.0, 1, MidpointRounding.AwayFromZero);

        int weeksBack = range switch
        {
            RangeFourWeeks => 4,
            RangeTwelveWeeks => 12,
            _ => sorted.Count == 0 ? 4 : Math.Clamp(((thisWeek.DayNumber - CalendarRules.WeekStart(sorted[0].WorkoutDate).DayNumber) / 7) + 1, 4, 26),
        };
        var weekly = new List<WeeklyCount>(weeksBack);
        for (var i = weeksBack - 1; i >= 0; i--)
        {
            var ws = thisWeek.AddDays(-7 * i);
            var we = ws.AddDays(6);
            weekly.Add(new WeeklyCount(ws, sorted.Count(e => e.WorkoutDate >= ws && e.WorkoutDate <= we)));
        }

        return new ExerciseAnalytics(
            SessionsCount: sorted.Count,
            SessionsInRange: inRange.Count,
            DistinctDays: sorted.Select(e => e.WorkoutDate).Distinct().Count(),
            FirstDate: sorted.Count > 0 ? sorted[0].WorkoutDate : null,
            LastDate: last?.WorkoutDate,
            FrequencyPerWeek: frequency,
            BestSet: best,
            Last: last is null ? null : ToTotal(last),
            Previous: prev is null ? null : ToTotal(prev),
            TotalDelta: last is not null && prev is not null ? SetMath.Total(last.Sets) - SetMath.Total(prev.Sets) : null,
            Series: series,
            Weekly: weekly);
    }

    private static SessionTotal ToTotal(ExerciseSessionEntry e) => new(e.WorkoutId, e.WorkoutDate, e.Label, e.Sets, SetMath.Total(e.Sets));
}

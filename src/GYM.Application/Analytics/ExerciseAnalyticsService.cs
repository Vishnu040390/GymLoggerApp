using GYM.Application.Common;
using GYM.Domain.Exceptions;
using GYM.Domain.Rules;

namespace GYM.Application.Analytics;

/// <summary>Progress analytics derived from completed sessions (spec §13). Cancelled sessions are excluded.</summary>
public sealed class ExerciseAnalyticsService(
    IExerciseRepository exercises,
    IExerciseAnalyticsRepository analytics,
    ICurrentUser currentUser,
    IClock clock)
{
    public async Task<AnalyticsDto> ExerciseAsync(Guid exerciseId, string? range, DateOnly? today, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        range ??= ExerciseAnalyticsCalculator.RangeAll;
        if (!ExerciseAnalyticsCalculator.IsValidRange(range))
        {
            throw new ValidationException("range", "Range must be 4w, 12w or all.");
        }

        var exercise = await exercises.GetAsync(exerciseId, ct) ?? throw new NotFoundException("Exercise not found.");
        var entries = await analytics.CompletedEntriesAsync(userId, exerciseId, null, ct);
        var a = ExerciseAnalyticsCalculator.Calculate(entries, Dates.Today(clock, today), range);
        return new AnalyticsDto(
            exercise.ToDto(), range, a.SessionsCount, a.SessionsInRange, a.DistinctDays, a.FirstDate, a.LastDate,
            a.FrequencyPerWeek, a.BestSet, a.Last, a.Previous, a.TotalDelta, a.Series, a.Weekly);
    }

    /// <summary>Week totals, 30-day totals and per-exercise trends for Today and Progress.</summary>
    public async Task<SummaryDto> SummaryAsync(DateOnly? today, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var day = Dates.Today(clock, today);
        var entries = await analytics.CompletedEntriesAsync(userId, null, null, ct);
        var weekStart = CalendarRules.WeekStart(day);

        PeriodStatsDto Stats(DateOnly from, DateOnly to)
        {
            var inRange = entries.Where(e => e.WorkoutDate >= from && e.WorkoutDate <= to).ToList();
            return new PeriodStatsDto(inRange.Select(e => e.WorkoutId).Distinct().Count(), inRange.Sum(e => e.Sets.Count), inRange.Sum(e => SetMath.Total(e.Sets)));
        }

        var last30 = entries.Where(e => e.WorkoutDate >= day.AddDays(-29)).ToList();
        var eightWeeks = entries.Where(e => e.WorkoutDate >= weekStart.AddDays(-49)).Select(e => e.WorkoutId).Distinct().Count();

        var all = await exercises.ListAsync(new ExerciseFilter(null, null), ct);
        var trends = entries
            .GroupBy(e => e.ExerciseId)
            .Select(g =>
            {
                var history = g.OrderByDescending(e => e.WorkoutDate).ThenByDescending(e => e.StartTime).ToList();
                var ex = all.FirstOrDefault(x => x.Id == g.Key);
                var last = history[0];
                var prev = history.Count > 1 ? history[1] : null;
                var lastTotal = SetMath.Total(last.Sets);
                int? prevTotal = prev is null ? null : SetMath.Total(prev.Sets);
                return new ExerciseTrendDto(
                    g.Key, ex?.Name ?? "Exercise", ex?.Category?.Name ?? string.Empty, ex?.IsActive ?? false,
                    history.Count, last.WorkoutDate, last.Label, last.WorkoutId, last.Sets, lastTotal, prevTotal,
                    prevTotal is null ? null : lastTotal - prevTotal,
                    history.Take(10).Reverse().Select(e => SetMath.Total(e.Sets)).ToList());
            })
            .OrderByDescending(t => t.LastDate).ThenByDescending(t => t.SessionsCount).ThenBy(t => t.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new SummaryDto(
            Stats(weekStart, day),
            Stats(weekStart.AddDays(-7), weekStart.AddDays(-1)),
            new Last30Dto(last30.Select(e => e.WorkoutId).Distinct().Count(), last30.Select(e => e.ExerciseId).Distinct().Count(), last30.Sum(e => e.Sets.Count)),
            Math.Round(eightWeeks / 8.0, 1, MidpointRounding.AwayFromZero),
            trends);
    }
}

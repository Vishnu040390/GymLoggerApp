namespace GYM.Domain.Rules;

public static class CalendarRules
{
    /// <summary>Monday of the ISO week containing <paramref name="date"/> (decision D18).</summary>
    public static DateOnly WeekStart(DateOnly date)
    {
        var offset = ((int)date.DayOfWeek + 6) % 7;
        return date.AddDays(-offset);
    }
}

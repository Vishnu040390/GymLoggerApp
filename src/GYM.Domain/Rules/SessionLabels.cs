namespace GYM.Domain.Rules;

/// <summary>
/// Human label for a session from its local start time, e.g. "18 Sep — Morning" (decision D1).
/// Two sessions can share a label, so screens always show the time as well.
/// </summary>
public static class SessionLabels
{
    public static string For(DateTime localStart) => localStart.Hour switch
    {
        >= 4 and < 12 => "Morning",
        >= 12 and < 17 => "Afternoon",
        >= 17 and < 21 => "Evening",
        _ => "Night",
    };

    /// <summary>Label for a UTC start time shown in the given IANA/Windows time zone (UTC if unknown).</summary>
    public static string For(DateTime utcStart, string? timeZoneId) => For(ToLocal(utcStart, timeZoneId));

    public static DateTime ToLocal(DateTime utc, string? timeZoneId)
    {
        var value = DateTime.SpecifyKind(utc, DateTimeKind.Utc);
        if (string.IsNullOrWhiteSpace(timeZoneId))
        {
            return value;
        }

        try
        {
            return TimeZoneInfo.ConvertTimeFromUtc(value, TimeZoneInfo.FindSystemTimeZoneById(timeZoneId));
        }
        catch (TimeZoneNotFoundException)
        {
            return value;
        }
        catch (InvalidTimeZoneException)
        {
            return value;
        }
    }
}

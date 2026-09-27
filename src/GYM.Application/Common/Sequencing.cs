namespace GYM.Application.Common;

internal static class Sequencing
{
    /// <summary>
    /// Renumbers <paramref name="ordered"/> to 1..n without ever breaking a unique
    /// (parent, number) index: changed rows move through negative temporary values
    /// first. Works the same on SQL Server and SQLite. Call inside a transaction.
    /// </summary>
    public static async Task RenumberAsync<T>(IReadOnlyList<T> ordered, Func<T, int> get, Action<T, int> set, IUnitOfWork unitOfWork, CancellationToken ct)
    {
        var changes = ordered.Select((item, i) => (item, number: i + 1)).Where(x => get(x.item) != x.number).ToList();
        if (changes.Count == 0)
        {
            return;
        }

        foreach (var (item, number) in changes)
        {
            set(item, -number);
        }

        await unitOfWork.SaveChangesAsync(ct);
        foreach (var (item, number) in changes)
        {
            set(item, number);
        }

        await unitOfWork.SaveChangesAsync(ct);
    }
}

internal static class Dates
{
    /// <summary>
    /// The caller's "today". Clients may send their local calendar date; it is accepted
    /// only within one day of the server's UTC date (spec §21, decision Q1).
    /// </summary>
    public static DateOnly Today(IClock clock, DateOnly? requested)
    {
        var utcToday = DateOnly.FromDateTime(clock.UtcNow);
        return requested is { } d && Math.Abs(d.DayNumber - utcToday.DayNumber) <= 1 ? d : utcToday;
    }
}

using GYM.Domain.ValueObjects;

namespace GYM.Domain.Rules;

public sealed record ComparisonRow(int SetNumber, int? Previous, int? Current, int? Delta);

public sealed record ComparisonTotals(int Previous, int Current, int Delta, double? DeltaPct);

public sealed record ComparisonResult(IReadOnlyList<ComparisonRow> Rows, ComparisonTotals Totals);

/// <summary>
/// Compares two sessions of one exercise by set number (spec §12, §25).
/// Previous 15/12/10 vs current 16/13/10 gives +1 / +1 / 0.
/// A set missing on either side has no delta; it is never treated as zero.
/// </summary>
public static class SetComparison
{
    public static ComparisonResult Compare(IReadOnlyCollection<SetEntry> previous, IReadOnlyCollection<SetEntry> current)
    {
        var prev = previous.ToDictionary(s => s.SetNumber, s => s.Count);
        var cur = current.ToDictionary(s => s.SetNumber, s => s.Count);
        var max = prev.Keys.Concat(cur.Keys).DefaultIfEmpty(0).Max();

        var rows = new List<ComparisonRow>(max);
        for (var n = 1; n <= max; n++)
        {
            int? p = prev.TryGetValue(n, out var pv) ? pv : null;
            int? c = cur.TryGetValue(n, out var cv) ? cv : null;
            rows.Add(new ComparisonRow(n, p, c, p.HasValue && c.HasValue ? c - p : null));
        }

        var pt = SetMath.Total(previous);
        var ct = SetMath.Total(current);
        double? pct = pt == 0 ? null : Math.Round((ct - pt) * 100.0 / pt, 1, MidpointRounding.AwayFromZero);
        return new ComparisonResult(rows, new ComparisonTotals(pt, ct, ct - pt, pct));
    }
}

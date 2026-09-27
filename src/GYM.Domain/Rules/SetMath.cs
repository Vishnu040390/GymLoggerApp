using GYM.Domain.ValueObjects;

namespace GYM.Domain.Rules;

public static class SetMath
{
    public static int Total(IEnumerable<SetEntry> sets) => sets.Sum(s => s.Count);

    public static int Best(IEnumerable<SetEntry> sets) => sets.Select(s => s.Count).DefaultIfEmpty(0).Max();
}

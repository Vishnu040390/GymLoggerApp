using System.Text.RegularExpressions;
using GYM.Domain.Enums;

namespace GYM.Domain.Rules;

/// <summary>
/// Validation rules shared by every client (spec §20). Messages are written for people
/// and are returned by the API unchanged, so web and mobile clients show the same text.
/// </summary>
public static partial class ValidationRules
{
    public const int CountMin = 1;
    public const int CountMax = 999;
    public const int ExerciseNameMin = 2;
    public const int ExerciseNameMax = 100;
    public const int DisplayNameMin = 2;
    public const int DisplayNameMax = 50;
    public const int ReferenceNameMin = 2;
    public const int ReferenceNameMax = 50;
    public const int DescriptionMax = 2000;
    public const int InstructionsMax = 4000;
    public const int PasswordMin = 8;
    public const int PasswordMax = 128;
    public const int EmailMax = 254;
    public const int MediaTextMax = 150;

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$", RegexOptions.CultureInvariant)]
    private static partial Regex EmailPattern();

    public static string? Count(int? count) => count switch
    {
        null => "Enter a count.",
        < CountMin => $"Count must be at least {CountMin}.",
        > CountMax => $"Count must be {CountMax} or less.",
        _ => null,
    };

    public static string? Email(string? email)
    {
        var v = (email ?? string.Empty).Trim();
        if (v.Length == 0)
        {
            return "Enter your email address.";
        }

        return v.Length > EmailMax || !EmailPattern().IsMatch(v) ? "Enter a valid email address, like name@example.com." : null;
    }

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    /// <summary>Password policy (decision D16): 8–128 characters with upper case, lower case and a number.</summary>
    public static string? Password(string? password)
    {
        if (string.IsNullOrEmpty(password))
        {
            return "Enter a password.";
        }

        var ok = password.Length is >= PasswordMin and <= PasswordMax
            && password.Any(char.IsUpper)
            && password.Any(char.IsLower)
            && password.Any(char.IsDigit);
        return ok ? null : "Password does not meet the requirements.";
    }

    public static string? DisplayName(string? name)
    {
        var v = (name ?? string.Empty).Trim();
        if (v.Length == 0)
        {
            return "Enter your name.";
        }

        return v.Length is < DisplayNameMin or > DisplayNameMax ? $"Name must be {DisplayNameMin}–{DisplayNameMax} characters." : null;
    }

    public static string? ExerciseName(string? name)
    {
        var v = (name ?? string.Empty).Trim();
        if (v.Length == 0)
        {
            return "Enter an exercise name.";
        }

        return v.Length is < ExerciseNameMin or > ExerciseNameMax ? $"Name must be {ExerciseNameMin}–{ExerciseNameMax} characters." : null;
    }

    public static string? ReferenceName(string? name)
    {
        var v = (name ?? string.Empty).Trim();
        return v.Length is < ReferenceNameMin or > ReferenceNameMax ? $"Name must be {ReferenceNameMin}–{ReferenceNameMax} characters." : null;
    }

    public static bool IsValidRole(UserRole role) => Enum.IsDefined(role);
}

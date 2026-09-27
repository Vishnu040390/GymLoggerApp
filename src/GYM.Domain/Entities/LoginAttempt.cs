namespace GYM.Domain.Entities;

/// <summary>Sign-in attempt, used for abuse protection (spec §23) and security logging.</summary>
public class LoginAttempt
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public bool Succeeded { get; set; }
    public DateTime AttemptedAt { get; set; }
}

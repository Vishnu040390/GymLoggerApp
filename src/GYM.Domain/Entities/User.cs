using GYM.Domain.Enums;

namespace GYM.Domain.Entities;

public class User : Entity
{
    /// <summary>Stored trimmed and lower-cased. Unique.</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>Salted hash. Passwords are never stored as plain text.</summary>
    public string PasswordHash { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.User;
    public bool IsActive { get; set; } = true;

    public ICollection<WorkoutSession> WorkoutSessions { get; set; } = new List<WorkoutSession>();
}

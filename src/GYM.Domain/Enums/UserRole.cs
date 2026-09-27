namespace GYM.Domain.Enums;

/// <summary>Admin manages exercise masters and media; User manages only their own workout data (spec §15).</summary>
public enum UserRole
{
    User,
    Admin,
}

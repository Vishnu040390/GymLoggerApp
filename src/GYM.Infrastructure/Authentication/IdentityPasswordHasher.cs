using GYM.Domain.Entities;
using Microsoft.AspNetCore.Identity;

namespace GYM.Infrastructure.Authentication;

/// <summary>ASP.NET Core Identity's PBKDF2 password hasher (spec §15, §23).</summary>
internal sealed class IdentityPasswordHasher : Application.Common.IPasswordHasher
{
    private static readonly User Subject = new();
    private readonly PasswordHasher<User> hasher = new();

    public string Hash(string password) => hasher.HashPassword(Subject, password);

    public bool Verify(string hash, string password) =>
        hasher.VerifyHashedPassword(Subject, hash, password) is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
}

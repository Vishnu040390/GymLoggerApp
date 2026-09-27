using GYM.Application.Common;
using GYM.Domain.Entities;
using GYM.Domain.Enums;
using GYM.Domain.Exceptions;
using GYM.Domain.Rules;

namespace GYM.Application.Authentication;

/// <summary>Email registration and email/password sign-in (spec §15). Social sign-in is deferred.</summary>
public sealed class AuthService(
    IAuthenticationRepository authentication,
    IUserRepository users,
    IPasswordHasher hasher,
    IUnitOfWork unitOfWork,
    IAuditLogger audit,
    IClock clock)
{
    public const int MaxFailedAttempts = 5;
    public static readonly TimeSpan FailureWindow = TimeSpan.FromMinutes(5);

    public async Task<UserDto> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        var errors = new List<FieldError>();
        AddIf(errors, "displayName", ValidationRules.DisplayName(request.DisplayName));
        AddIf(errors, "email", ValidationRules.Email(request.Email));
        AddIf(errors, "password", ValidationRules.Password(request.Password));
        if (errors.Count > 0)
        {
            throw new ValidationException("Check the highlighted fields.", errors);
        }

        var email = ValidationRules.NormalizeEmail(request.Email!);
        if (await users.EmailExistsAsync(email, ct))
        {
            throw new ConflictException("An account with this email already exists.", [new FieldError("email", "An account with this email already exists. Sign in instead.")]);
        }

        var user = new User
        {
            Email = email,
            DisplayName = request.DisplayName!.Trim(),
            PasswordHash = hasher.Hash(request.Password!),
            Role = UserRole.User,
            IsActive = true,
        };
        users.Add(user);
        audit.Record("Register", nameof(User), null, newValue: email);
        await unitOfWork.SaveChangesAsync(ct);
        return user.ToDto();
    }

    /// <summary>Validates credentials. Returns the user; the web layer issues the auth cookie.</summary>
    public async Task<UserDto> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var missing = new List<FieldError>();
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            missing.Add(new FieldError("email", "Enter your email address."));
        }

        if (string.IsNullOrEmpty(request.Password))
        {
            missing.Add(new FieldError("password", "Enter your password."));
        }

        if (missing.Count > 0)
        {
            throw new ValidationException("Enter your email and password.", missing);
        }

        var email = ValidationRules.NormalizeEmail(request.Email!);
        var now = clock.UtcNow;
        var failures = await authentication.FailedAttemptsSinceAsync(email, now - FailureWindow, ct);
        if (failures.Count >= MaxFailedAttempts)
        {
            var retry = (int)Math.Ceiling((failures.Min() + FailureWindow - now).TotalSeconds);
            throw new TooManyRequestsException($"Too many sign-in attempts. Try again in {Math.Max(1, (int)Math.Ceiling(retry / 60.0))} min.", Math.Max(1, retry));
        }

        var user = await authentication.FindByEmailAsync(email, ct);
        if (user is null || !hasher.Verify(user.PasswordHash, request.Password!))
        {
            // Same message for unknown email and wrong password: no account enumeration.
            authentication.AddAttempt(new LoginAttempt { Email = email, Succeeded = false, AttemptedAt = now });
            audit.Record("LoginFailed", nameof(User), user?.Id.ToString());
            await unitOfWork.SaveChangesAsync(ct);
            throw new AuthenticationFailedException("Email or password is incorrect.");
        }

        if (!user.IsActive)
        {
            audit.Record("LoginInactive", nameof(User), user.Id.ToString());
            await unitOfWork.SaveChangesAsync(ct);
            throw new ForbiddenException("This account is inactive. Contact the gym administrator.");
        }

        authentication.AddAttempt(new LoginAttempt { Email = email, Succeeded = true, AttemptedAt = now });
        audit.Record("Login", nameof(User), user.Id.ToString());
        await unitOfWork.SaveChangesAsync(ct);
        return user.ToDto();
    }

    private static void AddIf(List<FieldError> errors, string field, string? message)
    {
        if (message is not null)
        {
            errors.Add(new FieldError(field, message));
        }
    }
}

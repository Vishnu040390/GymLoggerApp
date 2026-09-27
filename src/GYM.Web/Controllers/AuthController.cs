using GYM.Application.Authentication;
using GYM.Application.Common;
using GYM.Application.Users;
using GYM.Web.Extensions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace GYM.Web.Controllers;

public sealed record RegisteredDto(Guid Id, string Email, string DisplayName);

public sealed record LoginResultDto(DateTime ExpiresAt, UserDto User);

public sealed record MeDto(Guid Id, string Email, string DisplayName, string Role, DateTime? ExpiresAt);

[Route("api/v1/auth")]
public sealed class AuthController(AuthService auth, UserService users, ILogger<AuthController> logger) : ApiControllerBase
{
    [AllowAnonymous]
    [EnableRateLimiting(WebServiceExtensions.AuthRateLimit)]
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken ct)
    {
        var user = await auth.RegisterAsync(request, ct);
        return CreatedEnvelope(new RegisteredDto(user.Id, user.Email, user.DisplayName), "Account created.");
    }

    [AllowAnonymous]
    [EnableRateLimiting(WebServiceExtensions.AuthRateLimit)]
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken ct)
    {
        var user = await auth.LoginAsync(request, ct);
        var expires = DateTimeOffset.UtcNow.Add(WebServiceExtensions.SessionLifetime);
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            HttpCurrentUser.CreatePrincipal(user),
            new AuthenticationProperties { IsPersistent = true, ExpiresUtc = expires, AllowRefresh = true });
        return Envelope(new LoginResultDto(expires.UtcDateTime, user), "Signed in.");
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        logger.LogInformation("Signed out {UserId}", User.GetUserId());
        return NoContent();
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var user = await users.GetMeAsync(ct);
        var result = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Envelope(new MeDto(user.Id, user.Email, user.DisplayName, user.Role, result.Properties?.ExpiresUtc?.UtcDateTime));
    }
}

[Route("api/v1/users")]
public sealed class UsersController(UserService users) : ApiControllerBase
{
    [HttpPut("me")]
    public async Task<IActionResult> UpdateMe(UpdateProfileRequest request, CancellationToken ct) =>
        Envelope(await users.UpdateProfileAsync(request, ct), "Profile updated.");
}

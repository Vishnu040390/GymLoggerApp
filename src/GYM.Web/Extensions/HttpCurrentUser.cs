using System.Security.Claims;
using GYM.Application.Common;

namespace GYM.Web.Extensions;

/// <summary>Resolves the caller from the authentication cookie's claims.</summary>
internal sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public Guid? UserId => accessor.HttpContext?.User.GetUserId();

    public bool IsAdmin => accessor.HttpContext?.User.IsInRole("Admin") ?? false;

    public static ClaimsPrincipal CreatePrincipal(UserDto user) => new(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.DisplayName),
            new Claim(ClaimTypes.Role, user.Role),
        ],
        "Cookies"));
}

public static class ClaimsPrincipalExtensions
{
    public static Guid? GetUserId(this ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
}

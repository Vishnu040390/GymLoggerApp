using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using GYM.Application.Common;
using GYM.Web.Configuration;
using GYM.Web.Filters;
using GYM.Web.Middleware;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GYM.Web.Extensions;

public static class WebServiceExtensions
{
    public const string AdminPolicy = "Admin";
    public const string AuthRateLimit = "auth";
    public static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(8);

    public static IServiceCollection AddGymWeb(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpCurrentUser>();

        services.AddControllers(o => o.AllowEmptyInputInBodyModelBinding = true)
            .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
        services.Configure<ApiBehaviorOptions>(o => o.InvalidModelStateResponseFactory = ModelStateResponse.Create);

        // Cookie authentication for the web client: HttpOnly, SameSite=Strict (CSRF defence
        // together with RequestedWithMiddleware), 8-hour sliding session (spec §15, §23).
        services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(o =>
            {
                o.Cookie.Name = "gym.auth";
                o.Cookie.HttpOnly = true;
                o.Cookie.SameSite = SameSiteMode.Strict;
                o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                o.ExpireTimeSpan = SessionLifetime;
                o.SlidingExpiration = true;
                o.Events.OnRedirectToLogin = ctx => ErrorWriter.WriteAsync(ctx.HttpContext, 401, "Your session has expired. Sign in again.");
                o.Events.OnRedirectToAccessDenied = ctx => ErrorWriter.WriteAsync(ctx.HttpContext, 403, "You don't have permission to do that.");
                o.Events.OnValidatePrincipal = async ctx =>
                {
                    // Deactivated accounts lose access on their next request.
                    var id = ctx.Principal?.GetUserId();
                    var users = ctx.HttpContext.RequestServices.GetRequiredService<IUserRepository>();
                    if (id is null || !await users.IsActiveAsync(id.Value, ctx.HttpContext.RequestAborted))
                    {
                        ctx.RejectPrincipal();
                    }
                };
            });

        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
            .AddPolicy(AdminPolicy, p => p.RequireAuthenticatedUser().RequireRole("Admin"));

        var permit = configuration.GetValue("RateLimiting:AuthPermitPerMinute", 20);
        services.AddRateLimiter(o =>
        {
            o.AddPolicy(AuthRateLimit, ctx => RateLimitPartition.GetFixedWindowLimiter(
                ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = permit, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
            o.OnRejected = async (ctx, ct) =>
            {
                ctx.HttpContext.Response.Headers.RetryAfter = "60";
                await ErrorWriter.WriteAsync(ctx.HttpContext, 429, "Too many requests. Try again in a minute.");
            };
        });

        services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");
        services.AddOpenApi();
        return services;
    }
}

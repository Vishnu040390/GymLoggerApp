using System.Net;
using GYM.Tests.Support;

namespace GYM.Tests.API;

/// <summary>Authentication QA matrix (spec §28).</summary>
public class AuthenticationTests(GymApiFactory factory) : IClassFixture<GymApiFactory>
{
    [Fact]
    public async Task Valid_registration_creates_an_account()
    {
        var (status, body) = await factory.NewClient().SendJsonAsync(HttpMethod.Post, "/api/v1/auth/register",
            new { email = $"new-{Guid.NewGuid():N}@example.com", password = "Strong@123", displayName = "New Lifter" });

        Assert.Equal(HttpStatusCode.Created, status);
        Assert.True(body.GetProperty("success").GetBoolean());
        Assert.Equal("New Lifter", body.Data().GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task Duplicate_email_is_rejected_on_the_email_field()
    {
        var (status, body) = await factory.NewClient().SendJsonAsync(HttpMethod.Post, "/api/v1/auth/register",
            new { email = "DEMO@gymlogger.test", password = "Strong@123", displayName = "Copy" });

        Assert.Equal(HttpStatusCode.Conflict, status);
        Assert.Equal(["email"], body.ErrorFields());
    }

    [Fact]
    public async Task Invalid_email_and_weak_password_are_rejected_with_field_errors()
    {
        var (status, body) = await factory.NewClient().SendJsonAsync(HttpMethod.Post, "/api/v1/auth/register",
            new { email = "not-an-email", password = "weak", displayName = "X" });

        Assert.Equal(HttpStatusCode.UnprocessableEntity, status);
        Assert.Equal(["displayName", "email", "password"], body.ErrorFields().Order());
    }

    [Fact]
    public async Task Valid_login_authenticates()
    {
        var client = await factory.SignedInAsync("demo@gymlogger.test", "Demo@1234");
        var (status, body) = await client.GetJsonAsync("/api/v1/auth/me");

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("demo@gymlogger.test", body.Data().GetProperty("email").GetString());
        Assert.Equal("User", body.Data().GetProperty("role").GetString());
    }

    [Theory]
    [InlineData("demo@gymlogger.test", "Wrong@1234")]
    [InlineData("nobody@gymlogger.test", "Demo@1234")]
    public async Task Wrong_password_and_unknown_email_get_the_same_generic_answer(string email, string password)
    {
        var (status, body) = await factory.NewClient().SendJsonAsync(HttpMethod.Post, "/api/v1/auth/login", new { email, password });

        Assert.Equal(HttpStatusCode.Unauthorized, status);
        Assert.Equal("Email or password is incorrect.", body.Message());
    }

    [Fact]
    public async Task Inactive_account_is_rejected()
    {
        var (status, _) = await factory.NewClient().SendJsonAsync(HttpMethod.Post, "/api/v1/auth/login", new { email = "inactive@gymlogger.test", password = "Inactive@1234" });

        Assert.Equal(HttpStatusCode.Forbidden, status);
    }

    [Fact]
    public async Task Repeated_failures_are_throttled()
    {
        var client = factory.NewClient();
        var email = $"target-{Guid.NewGuid():N}@example.com";
        await client.SendJsonAsync(HttpMethod.Post, "/api/v1/auth/register", new { email, password = "Strong@123", displayName = "Target" });
        for (var i = 0; i < 5; i++)
        {
            await client.SendJsonAsync(HttpMethod.Post, "/api/v1/auth/login", new { email, password = "Wrong@0000" });
        }

        var (status, body) = await client.SendJsonAsync(HttpMethod.Post, "/api/v1/auth/login", new { email, password = "Strong@123" });
        Assert.Equal((HttpStatusCode)429, status);
        Assert.StartsWith("Too many sign-in attempts", body.Message(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Missing_authentication_returns_401_envelope()
    {
        var (status, body) = await factory.NewClient().GetJsonAsync("/api/v1/workouts");

        Assert.Equal(HttpStatusCode.Unauthorized, status);
        Assert.False(body.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task User_calling_an_admin_api_gets_403()
    {
        var client = await factory.SignedInAsync("demo@gymlogger.test", "Demo@1234");
        var (status, _) = await client.SendJsonAsync(HttpMethod.Post, "/api/v1/exercises", new { name = "Sneaky" });

        Assert.Equal(HttpStatusCode.Forbidden, status);
    }

    [Fact]
    public async Task Logout_ends_the_session()
    {
        var client = await factory.NewUserAsync();
        var (logout, _) = await client.SendJsonAsync(HttpMethod.Post, "/api/v1/auth/logout");
        var (me, _) = await client.GetJsonAsync("/api/v1/auth/me");

        Assert.Equal(HttpStatusCode.NoContent, logout);
        Assert.Equal(HttpStatusCode.Unauthorized, me);
    }
}

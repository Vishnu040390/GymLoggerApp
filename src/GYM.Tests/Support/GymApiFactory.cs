using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;

namespace GYM.Tests.Support;

/// <summary>
/// Hosts the real application (all layers, real middleware) on a private database.
/// Each test class gets its own database via IClassFixture.
/// By default that is an in-memory SQLite database. Set GYM_TEST_SQLSERVER to a SQL Server
/// connection string (without a database name) to run the same tests against SQL Server,
/// with the real EF Core migrations applied (CI does this in a SQL Server container).
/// </summary>
public sealed class GymApiFactory : WebApplicationFactory<Program>
{
    private static readonly string? SqlServer = Environment.GetEnvironmentVariable("GYM_TEST_SQLSERVER");
    private readonly string mediaRoot = Path.Combine(Path.GetTempPath(), "gym-tests-media-" + Guid.NewGuid().ToString("N"));
    private readonly string connectionString;
    private readonly SqliteConnection? keepAlive;

    public GymApiFactory()
    {
        if (string.IsNullOrWhiteSpace(SqlServer))
        {
            // An in-memory SQLite database lives as long as one connection to it is open.
            connectionString = $"Data Source=gymtests-{Guid.NewGuid():N};Mode=Memory;Cache=Shared";
            keepAlive = new SqliteConnection(connectionString);
            keepAlive.Open();
        }
        else
        {
            connectionString = $"{SqlServer.TrimEnd(';')};Database=gymtests_{Guid.NewGuid():N}";
        }
    }

    public static bool UsesSqlServer => !string.IsNullOrWhiteSpace(SqlServer);

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Database:Provider", UsesSqlServer ? "SqlServer" : "Sqlite");
        builder.UseSetting("Database:ApplyMigrationsOnStartup", "true");
        builder.UseSetting("ConnectionStrings:Gym", connectionString);
        builder.UseSetting("Seed:ReferenceData", "true");
        builder.UseSetting("Seed:DemoData", "true");
        builder.UseSetting("Seed:AdminEmail", "admin@gymlogger.test");
        builder.UseSetting("Seed:AdminPassword", "Admin@1234");
        builder.UseSetting("Media:RootPath", mediaRoot);
        builder.UseSetting("RateLimiting:AuthPermitPerMinute", "100000");
    }

    /// <summary>A client with cookie handling and the X-Requested-With header the API requires.</summary>
    public HttpClient NewClient(bool requestedWith = true)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true, AllowAutoRedirect = false });
        if (requestedWith)
        {
            client.DefaultRequestHeaders.Add("X-Requested-With", "XMLHttpRequest");
        }

        return client;
    }

    public async Task<HttpClient> SignedInAsync(string email, string password)
    {
        var client = NewClient();
        var (status, body) = await client.SendJsonAsync(HttpMethod.Post, "/api/v1/auth/login", new { email, password });
        Assert.True(status == HttpStatusCode.OK, $"Sign-in failed for {email}: {body}");
        return client;
    }

    /// <summary>Registers a brand-new user (clean history) and returns a signed-in client.</summary>
    public async Task<HttpClient> NewUserAsync(string? name = null)
    {
        var email = $"lifter-{Guid.NewGuid():N}@example.com";
        var anon = NewClient();
        var (status, body) = await anon.SendJsonAsync(HttpMethod.Post, "/api/v1/auth/register", new { email, password = "Strong@123", displayName = name ?? "Test Lifter" });
        Assert.True(status == HttpStatusCode.Created, body.ToString());
        return await SignedInAsync(email, "Strong@123");
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            keepAlive?.Dispose();
            if (Directory.Exists(mediaRoot))
            {
                Directory.Delete(mediaRoot, recursive: true);
            }
        }
    }
}

public static class HttpTestExtensions
{
    public static async Task<(HttpStatusCode Status, JsonElement Body)> SendJsonAsync(this HttpClient client, HttpMethod method, string url, object? body = null, string? idempotencyKey = null)
    {
        using var request = new HttpRequestMessage(method, url);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        if (idempotencyKey is not null)
        {
            request.Headers.Add("Idempotency-Key", idempotencyKey);
        }

        using var response = await client.SendAsync(request);
        return (response.StatusCode, await ReadAsync(response));
    }

    public static Task<(HttpStatusCode Status, JsonElement Body)> GetJsonAsync(this HttpClient client, string url) => client.SendJsonAsync(HttpMethod.Get, url);

    public static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        return string.IsNullOrEmpty(text) ? default : JsonDocument.Parse(text).RootElement.Clone();
    }

    public static JsonElement Data(this JsonElement body) => body.GetProperty("data");

    public static string Message(this JsonElement body) => body.GetProperty("message").GetString()!;

    public static string[] ErrorFields(this JsonElement body) =>
        body.GetProperty("errors").EnumerateArray().Select(e => e.GetProperty("field").GetString() ?? string.Empty).ToArray();

    public static string Id(this JsonElement element) => element.GetProperty("id").GetString()!;
}

/// <summary>Small workflow helpers on top of the HTTP API.</summary>
public static class Workouts
{
    public static string Today => DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);

    public static async Task<string> ExerciseIdAsync(this HttpClient client, string name)
    {
        var (_, body) = await client.GetJsonAsync("/api/v1/exercises?search=" + Uri.EscapeDataString(name));
        return body.Data().GetProperty("items").EnumerateArray().First(e => e.GetProperty("name").GetString() == name).Id();
    }

    public static async Task<string> StartAsync(this HttpClient client)
    {
        var (status, body) = await client.SendJsonAsync(HttpMethod.Post, "/api/v1/workouts", new { workoutDate = Today, timeZone = "UTC" });
        Assert.True(status == HttpStatusCode.Created, body.ToString());
        return body.Data().Id();
    }

    public static async Task<string> AddExerciseAsync(this HttpClient client, string workoutId, string exerciseId)
    {
        var (status, body) = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workouts/{workoutId}/exercises", new { exerciseId });
        Assert.True(status == HttpStatusCode.Created, body.ToString());
        return body.Data().Id();
    }

    public static async Task<List<string>> AddSetsAsync(this HttpClient client, string workoutExerciseId, params int[] counts)
    {
        var ids = new List<string>();
        foreach (var count in counts)
        {
            var (status, body) = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workout-exercises/{workoutExerciseId}/sets", new { count });
            Assert.True(status == HttpStatusCode.Created, body.ToString());
            ids.Add(body.Data().Id());
        }

        return ids;
    }

    /// <summary>Starts a session, logs one exercise with the given counts and completes it.</summary>
    public static async Task<string> LogSessionAsync(this HttpClient client, string exerciseId, params int[] counts)
    {
        var workoutId = await client.StartAsync();
        var entryId = await client.AddExerciseAsync(workoutId, exerciseId);
        await client.AddSetsAsync(entryId, counts);
        var (status, body) = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workouts/{workoutId}/complete");
        Assert.True(status == HttpStatusCode.OK, body.ToString());
        return workoutId;
    }
}

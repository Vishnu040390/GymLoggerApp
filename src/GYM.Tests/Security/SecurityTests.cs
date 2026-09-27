using System.Net;
using System.Net.Http.Headers;
using GYM.Tests.Support;

namespace GYM.Tests.Security;

/// <summary>User isolation (spec §15, §26 mandatory scenario), CSRF, safe errors and upload security (§23).</summary>
public class SecurityTests(GymApiFactory factory) : IClassFixture<GymApiFactory>
{
    [Fact]
    public async Task User_B_cannot_read_or_change_user_A_workout()
    {
        var userA = await factory.NewUserAsync("User A");
        var userB = await factory.NewUserAsync("User B");
        var bench = await userA.ExerciseIdAsync("Bench Press");
        var workoutId = await userA.StartAsync();
        var entryId = await userA.AddExerciseAsync(workoutId, bench);
        var setId = (await userA.AddSetsAsync(entryId, 10))[0];

        var attempts = new (HttpMethod Method, string Url, object? Body)[]
        {
            (HttpMethod.Get, $"/api/v1/workouts/{workoutId}", null),
            (HttpMethod.Post, $"/api/v1/workouts/{workoutId}/exercises", new { exerciseId = bench }),
            (HttpMethod.Post, $"/api/v1/workouts/{workoutId}/complete", null),
            (HttpMethod.Post, $"/api/v1/workouts/{workoutId}/cancel", null),
            (HttpMethod.Post, $"/api/v1/workout-exercises/{entryId}/sets", new { count = 99 }),
            (HttpMethod.Delete, $"/api/v1/workout-exercises/{entryId}", null),
            (HttpMethod.Put, $"/api/v1/workout-sets/{setId}", new { count = 99 }),
            (HttpMethod.Delete, $"/api/v1/workout-sets/{setId}", null),
            (HttpMethod.Get, $"/api/v1/exercises/{bench}/comparison?currentWorkoutId={workoutId}&previousWorkoutId={workoutId}", null),
        };
        foreach (var (method, url, body) in attempts)
        {
            var (status, response) = await userB.SendJsonAsync(method, url, body);
            Assert.True(status == HttpStatusCode.NotFound, $"{method} {url} returned {status}");
            Assert.DoesNotContain("User A", response.ToString(), StringComparison.Ordinal);
        }

        // User A's data is untouched.
        var (_, own) = await userA.GetJsonAsync($"/api/v1/workouts/{workoutId}");
        Assert.Equal("InProgress", own.Data().GetProperty("status").GetString());
        Assert.Equal(10, own.Data().GetProperty("exercises")[0].GetProperty("sets")[0].GetProperty("count").GetInt32());
        var (_, listB) = await userB.GetJsonAsync("/api/v1/workouts?status=InProgress");
        Assert.Equal(0, listB.Data().GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task State_changing_requests_need_the_requested_with_header()
    {
        var client = factory.NewClient(requestedWith: false);

        var (status, _) = await client.SendJsonAsync(HttpMethod.Post, "/api/v1/auth/login", new { email = "demo@gymlogger.test", password = "Demo@1234" });

        Assert.Equal(HttpStatusCode.BadRequest, status);
    }

    [Fact]
    public async Task Errors_are_safe_and_use_the_envelope()
    {
        var client = await factory.NewUserAsync();
        using var malformed = new StringContent("{ not json", new MediaTypeHeaderValue("application/json"));

        var unknown = await client.GetJsonAsync("/api/v1/does-not-exist");
        using var response = await client.PostAsync("/api/v1/workouts", malformed);
        var body = await HttpTestExtensions.ReadAsync(response);

        Assert.Equal(HttpStatusCode.NotFound, unknown.Status);
        Assert.False(unknown.Body.GetProperty("success").GetBoolean());
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.DoesNotContain("System.", body.ToString(), StringComparison.Ordinal);
        Assert.DoesNotContain("   at ", body.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Security_headers_are_sent()
    {
        using var response = await factory.NewClient().GetAsync("/");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Contains("frame-ancestors 'none'", response.Headers.GetValues("Content-Security-Policy").Single(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Media_upload_checks_type_contents_and_role()
    {
        var admin = await factory.SignedInAsync("admin@gymlogger.test", "Admin@1234");
        var user = await factory.NewUserAsync();
        var bench = await admin.ExerciseIdAsync("Bench Press");
        byte[] png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D];

        var ok = await UploadAsync(admin, bench, "bench.png", "image/png", png);
        var exe = await UploadAsync(admin, bench, "tool.exe", "application/octet-stream", [0x4D, 0x5A, 0x90, 0]);
        var disguised = await UploadAsync(admin, bench, "photo.png", "image/png", "<script>alert(1)</script>"u8.ToArray());
        var notAdmin = await UploadAsync(user, bench, "bench.png", "image/png", png);

        Assert.Equal(HttpStatusCode.Created, ok.Status);
        Assert.Equal(HttpStatusCode.UnsupportedMediaType, exe.Status);
        Assert.Equal(HttpStatusCode.UnsupportedMediaType, disguised.Status);
        Assert.Equal(HttpStatusCode.Forbidden, notAdmin.Status);

        // Stored under a generated name and served with nosniff.
        var url = ok.Body.Data().GetProperty("fileUrl").GetString()!;
        Assert.DoesNotContain("bench", url, StringComparison.Ordinal);
        using var file = await factory.NewClient().GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, file.StatusCode);
        Assert.Equal("image/png", file.Content.Headers.ContentType?.MediaType);
        Assert.Equal("nosniff", file.Headers.GetValues("X-Content-Type-Options").Single());
    }

    private static async Task<(HttpStatusCode Status, System.Text.Json.JsonElement Body)> UploadAsync(HttpClient client, string exerciseId, string name, string type, byte[] bytes)
    {
        using var form = new MultipartFormDataContent();
        var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue(type);
        form.Add(content, "file", name);
        using var response = await client.PostAsync($"/api/v1/exercises/{exerciseId}/media", form);
        return (response.StatusCode, await HttpTestExtensions.ReadAsync(response));
    }
}

using System.Net;
using System.Text.Json;
using GYM.Tests.Support;

namespace GYM.Tests.API;

/// <summary>Workout QA matrix (spec §29) and the critical same-day session scenario (spec §30).</summary>
public class WorkoutFlowTests(GymApiFactory factory) : IClassFixture<GymApiFactory>
{
    private static int[] Counts(JsonElement sets) => sets.EnumerateArray().Select(s => s.GetProperty("count").GetInt32()).ToArray();

    [Fact]
    public async Task Start_add_log_edit_and_complete_a_workout()
    {
        var client = await factory.NewUserAsync();
        var bench = await client.ExerciseIdAsync("Bench Press");

        var workoutId = await client.StartAsync();
        var entryId = await client.AddExerciseAsync(workoutId, bench);
        var setIds = await client.AddSetsAsync(entryId, 15, 12, 10);
        var (updated, updateBody) = await client.SendJsonAsync(HttpMethod.Put, $"/api/v1/workout-sets/{setIds[2]}", new { count = 11 });
        Assert.Equal(HttpStatusCode.OK, updated);
        Assert.Equal(3, updateBody.Data().GetProperty("setNumber").GetInt32());

        var (status, body) = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workouts/{workoutId}/complete");

        Assert.Equal(HttpStatusCode.OK, status);
        var data = body.Data();
        Assert.Equal("Completed", data.GetProperty("status").GetString());
        Assert.Equal(Workouts.Today, data.GetProperty("workoutDate").GetString());
        var exercise = data.GetProperty("exercises")[0];
        Assert.Equal([15, 12, 11], Counts(exercise.GetProperty("sets")));
        Assert.Equal([1, 2, 3], exercise.GetProperty("sets").EnumerateArray().Select(s => s.GetProperty("setNumber").GetInt32()));
        Assert.Equal(38, data.GetProperty("totals").GetProperty("reps").GetInt32());
    }

    [Fact]
    public async Task Completed_workouts_are_read_only()
    {
        var client = await factory.NewUserAsync();
        var workoutId = await client.StartAsync();
        var entryId = await client.AddExerciseAsync(workoutId, await client.ExerciseIdAsync("Back Squat"));
        var setId = (await client.AddSetsAsync(entryId, 10))[0];
        await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workouts/{workoutId}/complete");

        var (addSet, body) = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workout-exercises/{entryId}/sets", new { count = 8 });
        var (editSet, _) = await client.SendJsonAsync(HttpMethod.Put, $"/api/v1/workout-sets/{setId}", new { count = 99 });
        var (cancel, _) = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workouts/{workoutId}/cancel");

        Assert.Equal(HttpStatusCode.Conflict, addSet);
        Assert.Equal("This workout is completed and can no longer be changed.", body.Message());
        Assert.Equal(HttpStatusCode.Conflict, editSet);
        Assert.Equal(HttpStatusCode.Conflict, cancel);
    }

    [Fact]
    public async Task Same_day_sessions_stay_separate_and_can_be_compared()
    {
        var client = await factory.NewUserAsync();
        var bench = await client.ExerciseIdAsync("Bench Press");

        var morning = await client.LogSessionAsync(bench, 15, 12, 10);
        var afternoon = await client.LogSessionAsync(bench, 16, 13, 10);

        var (_, history) = await client.GetJsonAsync($"/api/v1/exercises/{bench}/history");
        var items = history.Data().GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(2, items.Count);
        Assert.All(items, i => Assert.Equal(Workouts.Today, i.GetProperty("workoutDate").GetString()));
        Assert.Equal([afternoon, morning], items.Select(i => i.GetProperty("workoutId").GetString()));
        Assert.Equal(2, items[0].GetProperty("deltaVsPrevious").GetInt32());

        var (status, comparison) = await client.GetJsonAsync($"/api/v1/exercises/{bench}/comparison?currentWorkoutId={afternoon}&previousWorkoutId={morning}");
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal([1, 1, 0], comparison.Data().GetProperty("rows").EnumerateArray().Select(r => r.GetProperty("delta").GetInt32()));

        var (_, analytics) = await client.GetJsonAsync($"/api/v1/exercises/{bench}/analytics?range=all");
        Assert.Equal(2, analytics.Data().GetProperty("sessionsCount").GetInt32());
        Assert.Equal(1, analytics.Data().GetProperty("distinctDays").GetInt32());
    }

    [Fact]
    public async Task Only_one_workout_can_be_in_progress()
    {
        var client = await factory.NewUserAsync();
        var first = await client.StartAsync();

        var (status, body) = await client.SendJsonAsync(HttpMethod.Post, "/api/v1/workouts", new { workoutDate = Workouts.Today });

        Assert.Equal(HttpStatusCode.Conflict, status);
        Assert.Equal(first, body.Data().GetProperty("activeWorkoutId").GetString());
        var (_, active) = await client.GetJsonAsync("/api/v1/workouts/active");
        Assert.Equal(first, active.Data().Id());
    }

    [Fact]
    public async Task Workout_date_must_be_today()
    {
        var client = await factory.NewUserAsync();

        var (status, body) = await client.SendJsonAsync(HttpMethod.Post, "/api/v1/workouts", new { workoutDate = "2020-01-01" });

        Assert.Equal(HttpStatusCode.UnprocessableEntity, status);
        Assert.Equal(["workoutDate"], body.ErrorFields());
    }

    [Fact]
    public async Task Removing_a_set_renumbers_the_rest()
    {
        var client = await factory.NewUserAsync();
        var workoutId = await client.StartAsync();
        var entryId = await client.AddExerciseAsync(workoutId, await client.ExerciseIdAsync("Pull-Up"));
        var ids = await client.AddSetsAsync(entryId, 9, 8, 7, 6);

        var (status, _) = await client.SendJsonAsync(HttpMethod.Delete, $"/api/v1/workout-sets/{ids[1]}");

        Assert.Equal(HttpStatusCode.NoContent, status);
        var (_, workout) = await client.GetJsonAsync($"/api/v1/workouts/{workoutId}");
        var sets = workout.Data().GetProperty("exercises")[0].GetProperty("sets");
        Assert.Equal([9, 7, 6], Counts(sets));
        Assert.Equal([1, 2, 3], sets.EnumerateArray().Select(s => s.GetProperty("setNumber").GetInt32()));
    }

    [Fact]
    public async Task Completing_needs_a_set_and_drops_empty_exercises()
    {
        var client = await factory.NewUserAsync();
        var workoutId = await client.StartAsync();
        var squat = await client.AddExerciseAsync(workoutId, await client.ExerciseIdAsync("Back Squat"));

        var (empty, _) = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workouts/{workoutId}/complete");
        Assert.Equal(HttpStatusCode.UnprocessableEntity, empty);

        await client.AddExerciseAsync(workoutId, await client.ExerciseIdAsync("Leg Press"));
        await client.AddSetsAsync(squat, 10);
        var (status, body) = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workouts/{workoutId}/complete");

        Assert.Equal(HttpStatusCode.OK, status);
        var exercises = body.Data().GetProperty("exercises").EnumerateArray().ToList();
        Assert.Single(exercises);
        Assert.Equal("Back Squat", exercises[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task Cancelled_workouts_stay_in_history_but_not_in_analytics()
    {
        var client = await factory.NewUserAsync();
        var bench = await client.ExerciseIdAsync("Bench Press");
        var workoutId = await client.StartAsync();
        await client.AddSetsAsync(await client.AddExerciseAsync(workoutId, bench), 10);

        var (status, body) = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workouts/{workoutId}/cancel");

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("Cancelled", body.Data().GetProperty("status").GetString());
        var (_, list) = await client.GetJsonAsync("/api/v1/workouts?status=Cancelled");
        Assert.Equal(1, list.Data().GetProperty("total").GetInt32());
        var (_, history) = await client.GetJsonAsync($"/api/v1/exercises/{bench}/history");
        Assert.Empty(history.Data().GetProperty("items").EnumerateArray());
    }

    [Fact]
    public async Task Invalid_exercises_and_counts_are_rejected()
    {
        var client = await factory.NewUserAsync();
        var workoutId = await client.StartAsync();

        var (inactive, inactiveBody) = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workouts/{workoutId}/exercises", new { exerciseId = await AdminExerciseIdAsync("Smith Machine Squat") });
        var (missing, _) = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workouts/{workoutId}/exercises", new { exerciseId = Guid.NewGuid() });
        var entryId = await client.AddExerciseAsync(workoutId, await client.ExerciseIdAsync("Push-Up"));
        var (duplicate, _) = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workouts/{workoutId}/exercises", new { exerciseId = await client.ExerciseIdAsync("Push-Up") });
        var (badCount, countBody) = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workout-exercises/{entryId}/sets", new { count = 0 });
        var (wrongType, typeBody) = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workout-exercises/{entryId}/sets", new { count = "ten" });

        Assert.Equal(HttpStatusCode.UnprocessableEntity, inactive);
        Assert.Equal("Smith Machine Squat is no longer available for new workouts.", inactiveBody.Message());
        Assert.Equal(HttpStatusCode.NotFound, missing);
        Assert.Equal(HttpStatusCode.Conflict, duplicate);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, badCount);
        Assert.Equal(["count"], countBody.ErrorFields());
        Assert.Equal(HttpStatusCode.UnprocessableEntity, wrongType);
        Assert.Equal(["count"], typeBody.ErrorFields());
    }

    [Fact]
    public async Task Retried_requests_with_the_same_idempotency_key_create_one_set()
    {
        var client = await factory.NewUserAsync();
        var workoutId = await client.StartAsync();
        var entryId = await client.AddExerciseAsync(workoutId, await client.ExerciseIdAsync("Barbell Row"));
        var key = Guid.NewGuid().ToString();

        var first = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workout-exercises/{entryId}/sets", new { count = 12 }, key);
        var retry = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workout-exercises/{entryId}/sets", new { count = 12 }, key);

        Assert.Equal(HttpStatusCode.Created, first.Status);
        Assert.Equal(HttpStatusCode.Created, retry.Status);
        Assert.Equal(first.Body.Data().Id(), retry.Body.Data().Id());
        var (_, workout) = await client.GetJsonAsync($"/api/v1/workouts/{workoutId}");
        Assert.Single(workout.Data().GetProperty("exercises")[0].GetProperty("sets").EnumerateArray());
    }

    [Fact]
    public async Task Double_completion_is_harmless()
    {
        var client = await factory.NewUserAsync();
        var workoutId = await client.StartAsync();
        await client.AddSetsAsync(await client.AddExerciseAsync(workoutId, await client.ExerciseIdAsync("Lat Pulldown")), 12);
        var key = Guid.NewGuid().ToString();

        var first = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workouts/{workoutId}/complete", null, key);
        var second = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workouts/{workoutId}/complete", null, key);
        var third = await client.SendJsonAsync(HttpMethod.Post, $"/api/v1/workouts/{workoutId}/complete");

        Assert.Equal(HttpStatusCode.OK, first.Status);
        Assert.Equal(HttpStatusCode.OK, second.Status);
        Assert.Equal(HttpStatusCode.Conflict, third.Status);
    }

    [Fact]
    public async Task Summary_reports_this_week_and_exercise_trends()
    {
        var client = await factory.NewUserAsync();
        var bench = await client.ExerciseIdAsync("Bench Press");
        await client.LogSessionAsync(bench, 10, 10);
        await client.LogSessionAsync(bench, 12, 10);

        var (status, body) = await client.GetJsonAsync("/api/v1/analytics/summary?today=" + Workouts.Today);

        Assert.Equal(HttpStatusCode.OK, status);
        var data = body.Data();
        Assert.Equal(2, data.GetProperty("thisWeek").GetProperty("sessions").GetInt32());
        Assert.Equal(42, data.GetProperty("thisWeek").GetProperty("reps").GetInt32());
        var trend = data.GetProperty("exercises")[0];
        Assert.Equal(2, trend.GetProperty("delta").GetInt32());
        Assert.Equal([20, 22], trend.GetProperty("spark").EnumerateArray().Select(v => v.GetInt32()));
    }

    private async Task<string> AdminExerciseIdAsync(string name)
    {
        var admin = await factory.SignedInAsync("admin@gymlogger.test", "Admin@1234");
        var (_, body) = await admin.GetJsonAsync("/api/v1/exercises?scope=admin&status=all&search=" + Uri.EscapeDataString(name));
        return body.Data().GetProperty("items")[0].Id();
    }
}

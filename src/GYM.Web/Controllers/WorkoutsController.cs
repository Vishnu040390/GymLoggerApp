using GYM.Application.Common;
using GYM.Application.WorkoutExercises;
using GYM.Application.Workouts;
using GYM.Application.WorkoutSets;
using Microsoft.AspNetCore.Mvc;

namespace GYM.Web.Controllers;

/// <summary>
/// Workout sessions. Every query is scoped to the signed-in user; another user's
/// id returns 404, so changing an id in a request can never expose their data (spec §15).
/// </summary>
[Route("api/v1/workouts")]
public sealed class WorkoutsController(WorkoutService workouts, WorkoutExerciseService workoutExercises) : ApiControllerBase
{
    /// <summary>Completed and cancelled sessions, newest first (status=InProgress|Completed|Cancelled to filter).</summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] WorkoutListQuery query, CancellationToken ct) => Envelope(await workouts.ListAsync(query, ct));

    [HttpGet("active")]
    public async Task<IActionResult> Active(CancellationToken ct) => Envelope(await workouts.GetActiveAsync(ct));

    [HttpPost]
    public async Task<IActionResult> Start(StartWorkoutRequest request, CancellationToken ct) =>
        CreatedEnvelope(await workouts.StartAsync(request, ct), "Workout started.");

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) => Envelope(await workouts.GetAsync(id, ct));

    [HttpPost("{id:guid}/complete")]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct) => Envelope(await workouts.CompleteAsync(id, ct), "Workout completed.");

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct) => Envelope(await workouts.CancelAsync(id, ct), "Workout cancelled.");

    [HttpPost("{id:guid}/exercises")]
    public async Task<IActionResult> AddExercise(Guid id, AddWorkoutExerciseRequest request, CancellationToken ct)
    {
        var entry = await workoutExercises.AddAsync(id, request, ct);
        return CreatedEnvelope(entry, entry.Name + " added.");
    }
}

[Route("api/v1/workout-exercises")]
public sealed class WorkoutExercisesController(WorkoutExerciseService workoutExercises, WorkoutSetService sets) : ApiControllerBase
{
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remove(Guid id, CancellationToken ct)
    {
        await workoutExercises.RemoveAsync(id, ct);
        return NoContent();
    }

    /// <summary>Adds the next set. The server assigns the set number.</summary>
    [HttpPost("{id:guid}/sets")]
    public async Task<IActionResult> AddSet(Guid id, SetCountRequest request, CancellationToken ct) =>
        CreatedEnvelope(await sets.AddAsync(id, request, ct), "Set saved.");
}

[Route("api/v1/workout-sets")]
public sealed class WorkoutSetsController(WorkoutSetService sets) : ApiControllerBase
{
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, SetCountRequest request, CancellationToken ct) => Envelope(await sets.UpdateAsync(id, request, ct), "Set updated.");

    /// <summary>Removes a set; later sets are renumbered so numbers stay 1..n.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await sets.DeleteAsync(id, ct);
        return NoContent();
    }
}

using GYM.Application.Analytics;
using GYM.Application.Common;
using GYM.Application.Exercises;
using GYM.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GYM.Web.Controllers;

[Route("api/v1/exercises")]
public sealed class ExercisesController(ExerciseService exercises, ExerciseHistoryService history, ExerciseAnalyticsService analytics) : ApiControllerBase
{
    /// <summary>Active exercises for everyone; admins may pass scope=admin&amp;status=all|active|inactive.</summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] ExerciseListQuery query, CancellationToken ct) => Envelope(await exercises.ListAsync(query, ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, [FromQuery] string? scope, CancellationToken ct) => Envelope(await exercises.GetAsync(id, scope == "admin", ct));

    [Authorize(Policy = WebServiceExtensions.AdminPolicy)]
    [HttpPost]
    public async Task<IActionResult> Create(ExerciseRequest request, CancellationToken ct)
    {
        var created = await exercises.CreateAsync(request, ct);
        return CreatedEnvelope(created, $"\"{created.Name}\" created.");
    }

    [Authorize(Policy = WebServiceExtensions.AdminPolicy)]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, ExerciseRequest request, CancellationToken ct) => Envelope(await exercises.UpdateAsync(id, request, ct), "Changes saved.");

    [Authorize(Policy = WebServiceExtensions.AdminPolicy)]
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> SetStatus(Guid id, ExerciseStatusRequest request, CancellationToken ct)
    {
        var updated = await exercises.SetStatusAsync(id, request.IsActive, ct);
        return Envelope(updated, updated.Name + (updated.IsActive ? " is active." : " is inactive."));
    }

    [HttpGet("{id:guid}/history")]
    public async Task<IActionResult> History(Guid id, [FromQuery] Guid? excludeWorkoutId, [FromQuery] int? limit, CancellationToken ct) =>
        Envelope(await history.HistoryAsync(id, excludeWorkoutId, limit, ct));

    [HttpGet("{id:guid}/comparison")]
    public async Task<IActionResult> Comparison(Guid id, [FromQuery] Guid? currentWorkoutId, [FromQuery] Guid? previousWorkoutId, CancellationToken ct) =>
        Envelope(await history.CompareAsync(id, currentWorkoutId, previousWorkoutId, ct));

    [HttpGet("{id:guid}/analytics")]
    public async Task<IActionResult> Analytics(Guid id, [FromQuery] string? range, [FromQuery] DateOnly? today, CancellationToken ct) =>
        Envelope(await analytics.ExerciseAsync(id, range, today, ct));
}

[Route("api/v1/analytics")]
public sealed class AnalyticsController(ExerciseAnalyticsService analytics) : ApiControllerBase
{
    /// <summary>This week, last 30 days and per-exercise trends. `today` is the caller's local date.</summary>
    [HttpGet("summary")]
    public async Task<IActionResult> Summary([FromQuery] DateOnly? today, CancellationToken ct) => Envelope(await analytics.SummaryAsync(today, ct));
}

using GYM.Application.Common;
using GYM.Application.Media;
using GYM.Domain.Exceptions;
using GYM.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GYM.Web.Controllers;

[Route("api/v1/exercises/{exerciseId:guid}/media")]
public sealed class ExerciseMediaController(ExerciseMediaService media) : ApiControllerBase
{
    private const long MaxUploadBytes = 110L * 1024 * 1024;

    [HttpGet]
    public async Task<IActionResult> List(Guid exerciseId, CancellationToken ct) => Envelope(await media.ListAsync(exerciseId, ct));

    /// <summary>multipart/form-data: file, altText (images), title (videos), durationSeconds.</summary>
    [Authorize(Policy = WebServiceExtensions.AdminPolicy)]
    [HttpPost]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
    public async Task<IActionResult> Upload(Guid exerciseId, IFormFile? file, [FromForm] string? altText, [FromForm] string? title, [FromForm] int? durationSeconds, CancellationToken ct)
    {
        if (file is null)
        {
            throw new ValidationException("file", "Choose a file to upload.");
        }

        await using var stream = file.OpenReadStream();
        var created = await media.UploadAsync(exerciseId, new UploadMediaCommand(file.FileName, file.ContentType, file.Length, stream, altText, title, durationSeconds), ct);
        return CreatedEnvelope(created, created.FileName + " uploaded.");
    }

    [Authorize(Policy = WebServiceExtensions.AdminPolicy)]
    [HttpPut("{mediaId:guid}")]
    public async Task<IActionResult> Update(Guid exerciseId, Guid mediaId, MediaUpdateRequest request, CancellationToken ct) =>
        Envelope(await media.UpdateAsync(exerciseId, mediaId, request, ct), "Saved.");

    [Authorize(Policy = WebServiceExtensions.AdminPolicy)]
    [HttpPost("reorder")]
    public async Task<IActionResult> Reorder(Guid exerciseId, MediaReorderRequest request, CancellationToken ct) =>
        Envelope(await media.ReorderAsync(exerciseId, request, ct), "Order saved.");

    [Authorize(Policy = WebServiceExtensions.AdminPolicy)]
    [HttpDelete("{mediaId:guid}")]
    public async Task<IActionResult> Delete(Guid exerciseId, Guid mediaId, CancellationToken ct)
    {
        await media.DeleteAsync(exerciseId, mediaId, ct);
        return NoContent();
    }
}

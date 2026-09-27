using GYM.Application.Common;
using GYM.Application.ReferenceData;
using GYM.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GYM.Web.Controllers;

/// <summary>Categories, muscle groups and equipment. Types: categories | muscle-groups | equipment.</summary>
[Route("api/v1/reference")]
public sealed class ReferenceController(ReferenceDataService service) : ApiControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct) => Envelope(await service.GetAsync(ct));

    [Authorize(Policy = WebServiceExtensions.AdminPolicy)]
    [HttpPost("{type}")]
    public async Task<IActionResult> Add(string type, ReferenceRequest request, CancellationToken ct)
    {
        var item = await service.AddAsync(type, request, ct);
        return CreatedEnvelope(item, $"\"{item.Name}\" added.");
    }

    [Authorize(Policy = WebServiceExtensions.AdminPolicy)]
    [HttpPut("{type}/{id:guid}")]
    public async Task<IActionResult> Update(string type, Guid id, ReferenceRequest request, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(type, id, request, ct), "Saved.");
}

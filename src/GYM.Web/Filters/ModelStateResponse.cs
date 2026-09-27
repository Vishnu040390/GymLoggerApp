using GYM.Web.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace GYM.Web.Filters;

/// <summary>
/// Turns model-binding failures (wrong JSON types, bad ids) into the standard 422 envelope
/// with camelCase field names, without echoing framework or type details to the client.
/// </summary>
internal static class ModelStateResponse
{
    public static IActionResult Create(ActionContext context)
    {
        var errors = context.ModelState
            .Where(e => e.Value?.Errors.Count > 0)
            .Select(e => new ApiError(FieldName(e.Key), "Enter a valid value."))
            .GroupBy(e => e.Field)
            .Select(g => g.First())
            .ToList();

        // A field-specific error already explains a body-level parse failure; don't repeat it.
        if (errors.Any(e => e.Field is not null))
        {
            errors.RemoveAll(e => e.Field is null);
        }

        return new ObjectResult(ApiResponse.Fail("Check the highlighted fields.", errors)) { StatusCode = StatusCodes.Status422UnprocessableEntity };
    }

    private static string? FieldName(string key)
    {
        var name = key.StartsWith("$.", StringComparison.Ordinal) ? key[2..] : key;
        name = name.Split('.', '[').Last(s => s.Length > 0);
        if (name is "$" or "request" or "")
        {
            return null;
        }

        return char.ToLowerInvariant(name[0]) + name[1..];
    }
}

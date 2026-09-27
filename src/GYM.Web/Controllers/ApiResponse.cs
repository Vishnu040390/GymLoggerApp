using Microsoft.AspNetCore.Mvc;

namespace GYM.Web.Controllers;

/// <summary>A field-level error. Field is null for errors that concern the whole request.</summary>
public sealed record ApiError(string? Field, string Message);

/// <summary>Standard response envelope for every /api/v1 response (spec §14).</summary>
public sealed record ApiResponse<T>(bool Success, string Message, T? Data, IReadOnlyList<ApiError> Errors);

public static class ApiResponse
{
    public static ApiResponse<T> Ok<T>(T data, string message = "") => new(true, message, data, []);

    public static ApiResponse<object?> Fail(string message, IEnumerable<ApiError>? errors = null, object? data = null) =>
        new(false, message, data, errors?.ToList() ?? []);
}

[ApiController]
[Produces("application/json")]
public abstract class ApiControllerBase : ControllerBase
{
    protected OkObjectResult Envelope<T>(T data, string message = "") => Ok(ApiResponse.Ok(data, message));

    protected ObjectResult CreatedEnvelope<T>(T data, string message) => StatusCode(StatusCodes.Status201Created, ApiResponse.Ok(data, message));
}

using System.Text.Json;
using GYM.Web.Controllers;

namespace GYM.Web.Middleware;

internal static class ErrorWriter
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static Task WriteAsync(HttpContext context, int status, string message, IEnumerable<ApiError>? errors = null, object? data = null)
    {
        if (context.Response.HasStarted)
        {
            return Task.CompletedTask;
        }

        context.Response.StatusCode = status;
        context.Response.ContentType = "application/json; charset=utf-8";
        return context.Response.WriteAsync(JsonSerializer.Serialize(ApiResponse.Fail(message, errors, data), Json));
    }
}

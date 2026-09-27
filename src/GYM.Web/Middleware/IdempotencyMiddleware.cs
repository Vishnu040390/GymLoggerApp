using GYM.Application.Common;
using GYM.Web.Extensions;

namespace GYM.Web.Middleware;

/// <summary>
/// Replays the stored response when a POST is retried with the same Idempotency-Key,
/// so double-clicks and network retries never create duplicate records (spec §36).
/// Server errors (5xx) are not stored, so they can be retried.
/// </summary>
internal sealed class IdempotencyMiddleware(RequestDelegate next)
{
    public const string HeaderName = "Idempotency-Key";

    public async Task InvokeAsync(HttpContext context, IIdempotencyStore store)
    {
        var userId = context.User.GetUserId();
        if (!HttpMethods.IsPost(context.Request.Method)
            || !context.Request.Path.StartsWithSegments("/api")
            || userId is null
            || !context.Request.Headers.TryGetValue(HeaderName, out var header))
        {
            await next(context);
            return;
        }

        var key = header.ToString();
        if (key.Length is 0 or > 100)
        {
            await ErrorWriter.WriteAsync(context, StatusCodes.Status400BadRequest, "The Idempotency-Key header must be 1–100 characters.");
            return;
        }

        var path = context.Request.Path.Value ?? string.Empty;
        var lookup = await store.BeginAsync(userId.Value, key, context.Request.Method, path, context.RequestAborted);
        if (lookup.State == IdempotencyState.Completed)
        {
            context.Response.StatusCode = lookup.StatusCode;
            context.Response.ContentType = "application/json; charset=utf-8";
            context.Response.Headers["Idempotent-Replayed"] = "true";
            await context.Response.WriteAsync(lookup.Body ?? string.Empty, context.RequestAborted);
            return;
        }

        if (lookup.State == IdempotencyState.InProgress)
        {
            await ErrorWriter.WriteAsync(context, StatusCodes.Status409Conflict, "This request is already being processed.");
            return;
        }

        var original = context.Response.Body;
        await using var buffer = new MemoryStream();
        context.Response.Body = buffer;
        try
        {
            await next(context);
        }
        catch
        {
            context.Response.Body = original;
            await store.AbandonAsync(lookup.RecordId, CancellationToken.None);
            throw;
        }

        buffer.Position = 0;
        var body = await new StreamReader(buffer).ReadToEndAsync(context.RequestAborted);
        if (context.Response.StatusCode >= 500)
        {
            await store.AbandonAsync(lookup.RecordId, CancellationToken.None);
        }
        else
        {
            await store.CompleteAsync(lookup.RecordId, context.Response.StatusCode, body, CancellationToken.None);
        }

        buffer.Position = 0;
        context.Response.Body = original;
        await buffer.CopyToAsync(original, context.RequestAborted);
    }
}

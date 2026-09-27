using GYM.Domain.Exceptions;
using GYM.Web.Controllers;

namespace GYM.Web.Middleware;

/// <summary>
/// Centralised error handling (spec §22): expected failures become the standard envelope
/// with a safe message; anything else is logged in full server-side and returned as a
/// generic 500 without stack traces or SQL details.
/// </summary>
internal sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (GymException ex)
        {
            if (ex.StatusCode is 401 or 403)
            {
                logger.LogWarning("Security: {Status} {Method} {Path}: {Message}", ex.StatusCode, context.Request.Method, context.Request.Path, ex.Message);
            }

            if (ex is TooManyRequestsException tooMany)
            {
                context.Response.Headers.RetryAfter = tooMany.RetryAfterSeconds.ToString(System.Globalization.CultureInfo.InvariantCulture);
            }

            await ErrorWriter.WriteAsync(context, ex.StatusCode, ex.Message, ex.Errors.Select(e => new ApiError(e.Field, e.Message)), ex.ResponseData);
        }
        catch (BadHttpRequestException ex)
        {
            var message = ex.StatusCode == StatusCodes.Status413PayloadTooLarge ? "The file is too large." : "The request could not be read.";
            await ErrorWriter.WriteAsync(context, ex.StatusCode, message);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Client went away; nothing to send.
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled error for {Method} {Path}", context.Request.Method, context.Request.Path);
            await ErrorWriter.WriteAsync(context, StatusCodes.Status500InternalServerError, "Something went wrong on our side. Try again.");
        }
    }
}

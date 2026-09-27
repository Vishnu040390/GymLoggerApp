namespace GYM.Web.Middleware;

/// <summary>
/// CSRF defence in depth (spec §23): state-changing API calls must carry
/// X-Requested-With, which a cross-site form cannot set and a cross-origin
/// script cannot send without a CORS preflight (no CORS is enabled). The auth
/// cookie is also SameSite=Strict.
/// </summary>
internal sealed class RequestedWithMiddleware(RequestDelegate next)
{
    public const string HeaderName = "X-Requested-With";

    public Task InvokeAsync(HttpContext context)
    {
        var method = context.Request.Method;
        var unsafeMethod = HttpMethods.IsPost(method) || HttpMethods.IsPut(method) || HttpMethods.IsPatch(method) || HttpMethods.IsDelete(method);
        if (unsafeMethod && context.Request.Path.StartsWithSegments("/api") && !context.Request.Headers.ContainsKey(HeaderName))
        {
            return ErrorWriter.WriteAsync(context, StatusCodes.Status400BadRequest, "The request is missing a required header.");
        }

        return next(context);
    }
}

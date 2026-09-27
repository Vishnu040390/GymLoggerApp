using GYM.Application;
using GYM.Infrastructure;
using GYM.Infrastructure.Persistence;
using GYM.Web.Configuration;
using GYM.Web.Extensions;
using GYM.Web.Middleware;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment.ContentRootPath);
builder.Services.AddGymWeb(builder.Configuration);

var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();
if (!app.Environment.IsDevelopment() && !app.Environment.IsEnvironment("Testing"))
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

// Web UI (wwwroot) and uploaded media.
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseExerciseMedia();

app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<RequestedWithMiddleware>();
app.UseAuthorization();
app.UseMiddleware<IdempotencyMiddleware>();

app.MapControllers();
app.MapHealthChecks("/health").AllowAnonymous();
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}

app.MapFallback("/api/{**path}", ctx => ErrorWriter.WriteAsync(ctx, StatusCodes.Status404NotFound, "Endpoint not found.")).AllowAnonymous();
app.MapFallbackToFile("index.html").AllowAnonymous();

await using (var scope = app.Services.CreateAsyncScope())
{
    await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().InitializeAsync();
}

await app.RunAsync();

/// <summary>Entry point; public so integration tests can host the app.</summary>
public partial class Program;

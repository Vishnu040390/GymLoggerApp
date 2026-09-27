using GYM.Infrastructure.Storage;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;

namespace GYM.Web.Configuration;

internal static class MediaFilesExtensions
{
    /// <summary>Serves uploaded exercise media from the storage folder (outside wwwroot).</summary>
    public static IApplicationBuilder UseExerciseMedia(this IApplicationBuilder app)
    {
        var options = app.ApplicationServices.GetRequiredService<IOptions<MediaStorageOptions>>().Value;
        Directory.CreateDirectory(options.RootPath);
        return app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(options.RootPath),
            RequestPath = options.RequestPath,
            ServeUnknownFileTypes = false,
            OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "public, max-age=604800",
        });
    }
}

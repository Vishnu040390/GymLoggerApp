using GYM.Application.Common;
using Microsoft.Extensions.Options;

namespace GYM.Infrastructure.Storage;

public sealed class MediaStorageOptions
{
    public const string Section = "Media";

    /// <summary>Folder for uploaded files. Relative paths resolve from the content root. Keep it outside wwwroot.</summary>
    public string RootPath { get; set; } = "App_Data/media";

    /// <summary>URL prefix the web layer serves the folder from.</summary>
    public string RequestPath { get; set; } = "/media";
}

/// <summary>
/// Stores uploads on local disk under generated names, never the uploaded file name (spec §23).
/// Swap for blob storage in production without touching the application layer.
/// </summary>
internal sealed class LocalFileStorage(IOptions<MediaStorageOptions> options) : IFileStorage
{
    private readonly MediaStorageOptions settings = options.Value;

    public async Task<string> SaveAsync(Stream content, string extension, CancellationToken ct = default)
    {
        Directory.CreateDirectory(settings.RootPath);
        var name = $"{Guid.NewGuid():N}.{extension.ToLowerInvariant()}";
        if (content.CanSeek)
        {
            content.Position = 0;
        }

        await using (var file = File.Create(Path.Combine(settings.RootPath, name)))
        {
            await content.CopyToAsync(file, ct);
        }

        return $"{settings.RequestPath.TrimEnd('/')}/{name}";
    }

    public Task DeleteAsync(string fileUrl, CancellationToken ct = default)
    {
        var prefix = settings.RequestPath.TrimEnd('/') + "/";
        if (fileUrl.StartsWith(prefix, StringComparison.Ordinal))
        {
            // GetFileName strips any directory parts, so a stored URL can never point outside the folder.
            var path = Path.Combine(settings.RootPath, Path.GetFileName(fileUrl));
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }

        return Task.CompletedTask;
    }
}

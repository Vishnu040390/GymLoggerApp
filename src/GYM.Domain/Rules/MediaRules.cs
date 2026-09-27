using GYM.Domain.Enums;

namespace GYM.Domain.Rules;

public sealed record MediaRule(MediaType Type, IReadOnlyList<string> Extensions, IReadOnlyList<string> MimeTypes, long MaxBytes);

/// <summary>Upload rules (spec §20, §23): extension, declared MIME type and size must all be valid.</summary>
public static class MediaRules
{
    public static readonly MediaRule Image = new(MediaType.Image, ["jpg", "jpeg", "png", "webp"], ["image/jpeg", "image/png", "image/webp"], 5L * 1024 * 1024);
    public static readonly MediaRule Video = new(MediaType.Video, ["mp4", "webm"], ["video/mp4", "video/webm"], 100L * 1024 * 1024);

    /// <summary>Returns the matching rule, or an error message that is safe to show.</summary>
    public static (MediaRule? Rule, string? Error, bool TooLarge) Check(string fileName, string? mimeType, long sizeBytes)
    {
        var ext = Path.GetExtension(fileName ?? string.Empty).TrimStart('.').ToLowerInvariant();
        var rule = Image.Extensions.Contains(ext) ? Image : Video.Extensions.Contains(ext) ? Video : null;
        if (rule is null)
        {
            return (null, $"{fileName}: unsupported file type. Use JPG, PNG, WebP, MP4 or WebM.", false);
        }

        if (mimeType is null || !rule.MimeTypes.Contains(mimeType.ToLowerInvariant()))
        {
            return (null, $"{fileName}: the file contents do not match a supported {rule.Type.ToString().ToLowerInvariant()} format.", false);
        }

        if (sizeBytes <= 0)
        {
            return (null, $"{fileName}: the file is empty.", false);
        }

        if (sizeBytes > rule.MaxBytes)
        {
            var label = rule.Type == MediaType.Image ? "Images" : "Videos";
            return (null, $"{fileName}: file is too large. {label} can be up to {rule.MaxBytes / (1024 * 1024)} MB.", true);
        }

        return (rule, null, false);
    }
}

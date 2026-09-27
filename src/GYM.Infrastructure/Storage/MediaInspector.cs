using GYM.Application.Common;
using GYM.Domain.Enums;

namespace GYM.Infrastructure.Storage;

/// <summary>
/// Checks the file signature (magic bytes) matches the extension, so a renamed executable
/// or HTML file is rejected even when its name and declared MIME type look valid (spec §23).
/// </summary>
internal sealed class MediaInspector : IMediaInspector
{
    public async Task<bool> MatchesAsync(Stream content, MediaType type, string extension, CancellationToken ct = default)
    {
        var header = new byte[16];
        if (content.CanSeek)
        {
            content.Position = 0;
        }

        var read = await content.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
        if (content.CanSeek)
        {
            content.Position = 0;
        }

        var h = header.AsSpan(0, read);
        return extension switch
        {
            "jpg" or "jpeg" => h.StartsWith((ReadOnlySpan<byte>)[0xFF, 0xD8, 0xFF]),
            "png" => h.StartsWith((ReadOnlySpan<byte>)[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
            "webp" => h.Length >= 12 && h[..4].SequenceEqual("RIFF"u8) && h[8..12].SequenceEqual("WEBP"u8),
            "mp4" => h.Length >= 8 && h[4..8].SequenceEqual("ftyp"u8),
            "webm" => h.StartsWith((ReadOnlySpan<byte>)[0x1A, 0x45, 0xDF, 0xA3]),
            _ => false,
        };
    }
}

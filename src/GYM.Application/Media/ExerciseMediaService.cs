using GYM.Application.Common;
using GYM.Domain.Entities;
using GYM.Domain.Enums;
using GYM.Domain.Exceptions;
using GYM.Domain.Rules;

namespace GYM.Application.Media;

/// <summary>Photos and tutorial videos: upload, preview, order, hide and delete (spec §16, §23).</summary>
public sealed class ExerciseMediaService(
    IExerciseRepository exercises,
    IExerciseMediaRepository media,
    IFileStorage storage,
    IMediaInspector inspector,
    ICurrentUser currentUser,
    IUnitOfWork unitOfWork,
    IAuditLogger audit)
{
    public async Task<IReadOnlyList<MediaDto>> ListAsync(Guid exerciseId, CancellationToken ct = default)
    {
        currentUser.RequireUserId();
        _ = await exercises.GetAsync(exerciseId, ct) ?? throw new NotFoundException("Exercise not found.");
        var list = await media.ListAsync(exerciseId, includeInactive: currentUser.IsAdmin, ct);
        return list.Select(m => m.ToDto()).ToList();
    }

    public async Task<MediaDto> UploadAsync(Guid exerciseId, UploadMediaCommand file, CancellationToken ct = default)
    {
        var adminId = currentUser.RequireAdmin();
        var exercise = await exercises.GetAsync(exerciseId, ct) ?? throw new NotFoundException("Exercise not found.");

        var (rule, error, tooLarge) = MediaRules.Check(file.FileName, file.ContentType, file.Length);
        if (rule is null)
        {
            audit.Record("MediaRejected", nameof(ExerciseMedia), exerciseId.ToString(), newValue: error);
            await unitOfWork.SaveChangesAsync(ct);
            throw tooLarge ? new PayloadTooLargeException(error!) : new UnsupportedMediaException(error!);
        }

        var extension = Path.GetExtension(file.FileName).TrimStart('.').ToLowerInvariant();
        if (!await inspector.MatchesAsync(file.Content, rule.Type, extension, ct))
        {
            var message = $"{file.FileName}: the file contents do not match a supported {rule.Type.ToString().ToLowerInvariant()} format.";
            audit.Record("MediaRejected", nameof(ExerciseMedia), exerciseId.ToString(), newValue: message);
            await unitOfWork.SaveChangesAsync(ct);
            throw new UnsupportedMediaException(message);
        }

        var url = await storage.SaveAsync(file.Content, extension, ct);
        var existing = await media.ListAsync(exerciseId, includeInactive: true, ct);
        var isImage = rule.Type == MediaType.Image;
        var item = new ExerciseMedia
        {
            ExerciseId = exerciseId,
            MediaType = rule.Type,
            FileUrl = url,
            FileName = Path.GetFileName(file.FileName),
            MimeType = file.ContentType!.ToLowerInvariant(),
            SizeBytes = file.Length,
            AltText = isImage ? Truncate(string.IsNullOrWhiteSpace(file.AltText) ? exercise.Name : file.AltText.Trim()) : null,
            Title = isImage ? null : Truncate(string.IsNullOrWhiteSpace(file.Title) ? exercise.Name + " tutorial" : file.Title.Trim()),
            DurationSeconds = isImage ? null : file.DurationSeconds,
            DisplayOrder = existing.Count + 1,
            IsActive = true,
            CreatedBy = adminId,
            ModifiedBy = adminId,
        };
        media.Add(item);
        audit.Record("UploadMedia", nameof(ExerciseMedia), null, newValue: item.FileName);
        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch
        {
            await storage.DeleteAsync(url, ct);
            throw;
        }

        return item.ToDto();
    }

    public async Task<MediaDto> UpdateAsync(Guid exerciseId, Guid mediaId, MediaUpdateRequest request, CancellationToken ct = default)
    {
        var adminId = currentUser.RequireAdmin();
        var item = await media.GetAsync(exerciseId, mediaId, ct) ?? throw new NotFoundException("Media not found.");
        if (request.AltText is not null)
        {
            var alt = request.AltText.Trim();
            if (item.MediaType == MediaType.Image && alt.Length == 0)
            {
                throw new ValidationException("altText", "Alt text is required for images.");
            }

            if (alt.Length > ValidationRules.MediaTextMax)
            {
                throw new ValidationException("altText", "Alt text must be 150 characters or less.");
            }

            item.AltText = alt;
        }

        if (request.Title is not null)
        {
            var title = request.Title.Trim();
            if (title.Length > ValidationRules.MediaTextMax)
            {
                throw new ValidationException("title", "Title must be 150 characters or less.");
            }

            item.Title = title;
        }

        if (request.IsActive is not null)
        {
            item.IsActive = request.IsActive.Value;
        }

        item.ModifiedBy = adminId;
        audit.Record("UpdateMedia", nameof(ExerciseMedia), mediaId.ToString());
        await unitOfWork.SaveChangesAsync(ct);
        return item.ToDto();
    }

    public async Task<IReadOnlyList<MediaDto>> ReorderAsync(Guid exerciseId, MediaReorderRequest request, CancellationToken ct = default)
    {
        currentUser.RequireAdmin();
        var list = await media.ListAsync(exerciseId, includeInactive: true, ct);
        var ids = request.Ids ?? [];
        if (ids.Count != list.Count || ids.Distinct().Count() != ids.Count || !ids.All(id => list.Any(m => m.Id == id)))
        {
            throw new BusinessRuleException("The media list changed. Reload and try again.");
        }

        for (var i = 0; i < ids.Count; i++)
        {
            list.First(m => m.Id == ids[i]).DisplayOrder = i + 1;
        }

        audit.Record("ReorderMedia", nameof(Exercise), exerciseId.ToString());
        await unitOfWork.SaveChangesAsync(ct);
        return list.OrderBy(m => m.DisplayOrder).Select(m => m.ToDto()).ToList();
    }

    public async Task DeleteAsync(Guid exerciseId, Guid mediaId, CancellationToken ct = default)
    {
        currentUser.RequireAdmin();
        var item = await media.GetAsync(exerciseId, mediaId, ct) ?? throw new NotFoundException("Media not found.");
        var rest = (await media.ListAsync(exerciseId, includeInactive: true, ct)).Where(m => m.Id != mediaId).OrderBy(m => m.DisplayOrder).ToList();
        media.Remove(item);
        for (var i = 0; i < rest.Count; i++)
        {
            rest[i].DisplayOrder = i + 1;
        }

        audit.Record("DeleteMedia", nameof(ExerciseMedia), mediaId.ToString(), oldValue: item.FileName);
        await unitOfWork.SaveChangesAsync(ct);
        await storage.DeleteAsync(item.FileUrl, ct);
    }

    private static string Truncate(string value) => value.Length <= ValidationRules.MediaTextMax ? value : value[..ValidationRules.MediaTextMax];
}

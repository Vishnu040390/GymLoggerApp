using GYM.Application.Common;
using GYM.Domain.Entities;
using GYM.Domain.Exceptions;
using GYM.Domain.Rules;

namespace GYM.Application.ReferenceData;

/// <summary>Categories, muscle groups and equipment used to describe exercises.</summary>
public sealed class ReferenceDataService(IReferenceDataRepository repository, ICurrentUser currentUser, IUnitOfWork unitOfWork, IAuditLogger audit)
{
    /// <summary>Route segment → entity type.</summary>
    public static bool IsKnownType(string type) => type is "categories" or "muscle-groups" or "equipment";

    public async Task<ReferenceDataDto> GetAsync(CancellationToken ct = default)
    {
        currentUser.RequireUserId();
        var usage = await repository.UsageAsync(ct);
        return new ReferenceDataDto(
            await ListAsync<Category>(usage, ct),
            await ListAsync<MuscleGroup>(usage, ct),
            await ListAsync<Equipment>(usage, ct));
    }

    public Task<ReferenceItemDto> AddAsync(string type, ReferenceRequest request, CancellationToken ct = default) => type switch
    {
        "categories" => AddAsync<Category>(request, ct),
        "muscle-groups" => AddAsync<MuscleGroup>(request, ct),
        "equipment" => AddAsync<Equipment>(request, ct),
        _ => throw new NotFoundException("Unknown reference type."),
    };

    public Task<ReferenceItemDto> UpdateAsync(string type, Guid id, ReferenceRequest request, CancellationToken ct = default) => type switch
    {
        "categories" => UpdateAsync<Category>(id, request, ct),
        "muscle-groups" => UpdateAsync<MuscleGroup>(id, request, ct),
        "equipment" => UpdateAsync<Equipment>(id, request, ct),
        _ => throw new NotFoundException("Unknown reference type."),
    };

    private async Task<IReadOnlyList<ReferenceItemDto>> ListAsync<T>(Dictionary<Guid, int> usage, CancellationToken ct) where T : ReferenceItem
    {
        var items = await repository.ListAsync<T>(ct);
        return items
            .Where(r => currentUser.IsAdmin || r.IsActive)
            .OrderBy(r => r.DisplayOrder).ThenBy(r => r.Name)
            .Select(r => new ReferenceItemDto(r.Id, r.Name, r.IsActive, r.DisplayOrder, usage.GetValueOrDefault(r.Id)))
            .ToList();
    }

    private async Task<ReferenceItemDto> AddAsync<T>(ReferenceRequest request, CancellationToken ct) where T : ReferenceItem, new()
    {
        currentUser.RequireAdmin();
        var name = await ValidateNameAsync<T>(request.Name, null, ct);
        var all = await repository.ListAsync<T>(ct);
        var item = new T { Name = name, IsActive = true, DisplayOrder = all.Count == 0 ? 1 : all.Max(x => x.DisplayOrder) + 1 };
        repository.Add(item);
        audit.Record("Create", typeof(T).Name, null, newValue: name);
        await unitOfWork.SaveChangesAsync(ct);
        return new ReferenceItemDto(item.Id, item.Name, item.IsActive, item.DisplayOrder, 0);
    }

    private async Task<ReferenceItemDto> UpdateAsync<T>(Guid id, ReferenceRequest request, CancellationToken ct) where T : ReferenceItem
    {
        currentUser.RequireAdmin();
        var item = await repository.GetAsync<T>(id, ct) ?? throw new NotFoundException("Item not found.");
        var old = $"{item.Name}|{item.IsActive}";
        if (request.Name is not null)
        {
            item.Name = await ValidateNameAsync<T>(request.Name, id, ct);
        }

        if (request.IsActive is not null)
        {
            item.IsActive = request.IsActive.Value;
        }

        audit.Record("Update", typeof(T).Name, id.ToString(), old, $"{item.Name}|{item.IsActive}");
        await unitOfWork.SaveChangesAsync(ct);
        var usage = await repository.UsageAsync(ct);
        return new ReferenceItemDto(item.Id, item.Name, item.IsActive, item.DisplayOrder, usage.GetValueOrDefault(item.Id));
    }

    private async Task<string> ValidateNameAsync<T>(string? raw, Guid? excludeId, CancellationToken ct) where T : ReferenceItem
    {
        var error = ValidationRules.ReferenceName(raw);
        if (error is not null)
        {
            throw new ValidationException("name", error);
        }

        var name = raw!.Trim();
        if (await repository.NameExistsAsync<T>(name, excludeId, ct))
        {
            throw new ConflictException($"\"{name}\" already exists.", [new FieldError("name", $"\"{name}\" already exists.")]);
        }

        return name;
    }
}

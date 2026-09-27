using GYM.Application.Common;
using GYM.Domain.Entities;
using GYM.Domain.Exceptions;
using GYM.Domain.Rules;

namespace GYM.Application.Exercises;

/// <summary>Exercise master: browsing for everyone, management for administrators (spec §16).</summary>
public sealed class ExerciseService(
    IExerciseRepository exercises,
    IReferenceDataRepository referenceData,
    IExerciseAnalyticsRepository analytics,
    ICurrentUser currentUser,
    IUnitOfWork unitOfWork,
    IAuditLogger audit)
{
    public async Task<ListResult<ExerciseDto>> ListAsync(ExerciseListQuery query, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var adminScope = currentUser.IsAdmin && query.Scope == "admin";

        // People who are not admins only ever see active exercises (spec §20).
        var status = adminScope ? query.Status ?? "all" : "active";
        bool? isActive = status switch { "active" => true, "inactive" => false, _ => null };
        var list = await exercises.ListAsync(new ExerciseFilter(isActive, query.CategoryId), ct);

        var term = query.Search?.Trim();
        var items = list
            .Where(e => string.IsNullOrEmpty(term) || Matches(e, term))
            .Select(e => e.ToDto())
            .ToList();

        if (query.Include == "last")
        {
            var entries = await analytics.CompletedEntriesAsync(userId, null, query.ExcludeWorkoutId, ct);
            var byExercise = entries.GroupBy(e => e.ExerciseId).ToDictionary(g => g.Key, g => g.OrderByDescending(e => e.WorkoutDate).ThenByDescending(e => e.StartTime).ToList());
            items = items.Select(e => byExercise.TryGetValue(e.Id, out var h)
                ? e with { Last = new LastPerformanceDto(h[0].WorkoutId, h[0].WorkoutDate, h[0].Label, h[0].Sets), SessionsCount = h.Count }
                : e with { SessionsCount = 0 }).ToList();
        }

        items = query.Sort == "name"
            ? items.OrderBy(e => e.Name, StringComparer.OrdinalIgnoreCase).ToList()
            : items.OrderBy(e => e.DisplayOrder).ThenBy(e => e.Name, StringComparer.OrdinalIgnoreCase).ToList();
        return new ListResult<ExerciseDto>(items, items.Count);
    }

    public async Task<ExerciseDto> GetAsync(Guid id, bool adminScope, CancellationToken ct = default)
    {
        currentUser.RequireUserId();
        var exercise = await exercises.GetAsync(id, ct) ?? throw new NotFoundException("Exercise not found.");

        // Inactive exercises stay readable so history can still show their instructions.
        return exercise.ToDto(withMedia: true, includeInactiveMedia: adminScope && currentUser.IsAdmin);
    }

    public async Task<ExerciseDto> CreateAsync(ExerciseRequest request, CancellationToken ct = default)
    {
        var adminId = currentUser.RequireAdmin();
        await ValidateAsync(request, null, ct);
        var exercise = new Exercise
        {
            Name = request.Name!.Trim(),
            CategoryId = request.CategoryId!.Value,
            MuscleGroupId = request.MuscleGroupId!.Value,
            EquipmentId = request.EquipmentId!.Value,
            Description = (request.Description ?? string.Empty).Trim(),
            Instructions = (request.Instructions ?? string.Empty).Trim(),
            IsActive = request.IsActive ?? true,
            DisplayOrder = request.DisplayOrder ?? await exercises.MaxDisplayOrderAsync(ct) + 10,
            CreatedBy = adminId,
            ModifiedBy = adminId,
        };
        exercises.Add(exercise);
        audit.Record("Create", nameof(Exercise), null, newValue: exercise.Name);
        await unitOfWork.SaveChangesAsync(ct);
        return (await exercises.GetAsync(exercise.Id, ct))!.ToDto(withMedia: true, includeInactiveMedia: true);
    }

    public async Task<ExerciseDto> UpdateAsync(Guid id, ExerciseRequest request, CancellationToken ct = default)
    {
        var adminId = currentUser.RequireAdmin();
        var exercise = await exercises.GetAsync(id, ct) ?? throw new NotFoundException("Exercise not found.");
        await ValidateAsync(request, id, ct);
        var old = $"{exercise.Name}|{exercise.IsActive}";
        exercise.Name = request.Name!.Trim();
        exercise.CategoryId = request.CategoryId!.Value;
        exercise.MuscleGroupId = request.MuscleGroupId!.Value;
        exercise.EquipmentId = request.EquipmentId!.Value;
        exercise.Description = (request.Description ?? string.Empty).Trim();
        exercise.Instructions = (request.Instructions ?? string.Empty).Trim();
        exercise.IsActive = request.IsActive ?? exercise.IsActive;
        exercise.DisplayOrder = request.DisplayOrder ?? exercise.DisplayOrder;
        exercise.ModifiedBy = adminId;
        audit.Record("Update", nameof(Exercise), id.ToString(), old, $"{exercise.Name}|{exercise.IsActive}");
        await unitOfWork.SaveChangesAsync(ct);
        return (await exercises.GetAsync(id, ct))!.ToDto(withMedia: true, includeInactiveMedia: true);
    }

    public async Task<ExerciseDto> SetStatusAsync(Guid id, bool isActive, CancellationToken ct = default)
    {
        var adminId = currentUser.RequireAdmin();
        var exercise = await exercises.GetAsync(id, ct) ?? throw new NotFoundException("Exercise not found.");
        exercise.IsActive = isActive;
        exercise.ModifiedBy = adminId;
        audit.Record(isActive ? "Activate" : "Deactivate", nameof(Exercise), id.ToString());
        await unitOfWork.SaveChangesAsync(ct);
        return exercise.ToDto();
    }

    private async Task ValidateAsync(ExerciseRequest r, Guid? existingId, CancellationToken ct)
    {
        var errors = new List<FieldError>();
        var nameError = ValidationRules.ExerciseName(r.Name);
        if (nameError is not null)
        {
            errors.Add(new FieldError("name", nameError));
        }

        if (r.CategoryId is null || await referenceData.GetAsync<Category>(r.CategoryId.Value, ct) is null)
        {
            errors.Add(new FieldError("categoryId", "Choose a category."));
        }

        if (r.MuscleGroupId is null || await referenceData.GetAsync<MuscleGroup>(r.MuscleGroupId.Value, ct) is null)
        {
            errors.Add(new FieldError("muscleGroupId", "Choose a muscle group."));
        }

        if (r.EquipmentId is null || await referenceData.GetAsync<Equipment>(r.EquipmentId.Value, ct) is null)
        {
            errors.Add(new FieldError("equipmentId", "Choose the equipment."));
        }

        if ((r.Description?.Length ?? 0) > ValidationRules.DescriptionMax)
        {
            errors.Add(new FieldError("description", "Description must be 2,000 characters or less."));
        }

        if ((r.Instructions?.Length ?? 0) > ValidationRules.InstructionsMax)
        {
            errors.Add(new FieldError("instructions", "Instructions must be 4,000 characters or less."));
        }

        if (r.DisplayOrder is < 0 or > 9999)
        {
            errors.Add(new FieldError("displayOrder", "Use a whole number from 0 to 9999."));
        }

        if (errors.Count > 0)
        {
            throw new ValidationException("Check the highlighted fields.", errors);
        }

        var name = r.Name!.Trim();
        if (await exercises.NameExistsAsync(name, existingId, ct))
        {
            var message = $"An exercise named \"{name}\" already exists.";
            throw new ConflictException(message, [new FieldError("name", message)]);
        }
    }

    private static bool Matches(Exercise e, string term) =>
        new[] { e.Name, e.Category?.Name, e.MuscleGroup?.Name, e.Equipment?.Name }
            .Any(v => v is not null && v.Contains(term, StringComparison.OrdinalIgnoreCase));
}

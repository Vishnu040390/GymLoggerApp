using GYM.Domain.Entities;
using GYM.Domain.Rules;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GYM.Infrastructure.Persistence.Configurations;

// Table names, constraints and delete behaviour follow spec §8, §9 and §35.
// Delete behaviour is always explicit; historical workout data is never removed
// by deleting a master record (Restrict).

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.ToTable("User");
        b.Property(x => x.Email).HasMaxLength(ValidationRules.EmailMax).IsRequired();
        b.HasIndex(x => x.Email).IsUnique();
        b.Property(x => x.PasswordHash).HasMaxLength(500).IsRequired();
        b.Property(x => x.DisplayName).HasMaxLength(ValidationRules.DisplayNameMax).IsRequired();
        b.Property(x => x.Role).HasConversion<string>().HasMaxLength(20);
    }
}

internal abstract class ReferenceItemConfiguration<T>(string table) : IEntityTypeConfiguration<T>
    where T : ReferenceItem
{
    public void Configure(EntityTypeBuilder<T> b)
    {
        b.ToTable(table);
        b.Property(x => x.Name).HasMaxLength(ValidationRules.ReferenceNameMax).IsRequired();
        b.HasIndex(x => x.Name).IsUnique();
    }
}

internal sealed class CategoryConfiguration() : ReferenceItemConfiguration<Category>("Category");

internal sealed class MuscleGroupConfiguration() : ReferenceItemConfiguration<MuscleGroup>("MuscleGroup");

internal sealed class EquipmentConfiguration() : ReferenceItemConfiguration<Equipment>("Equipment");

internal sealed class ExerciseConfiguration : IEntityTypeConfiguration<Exercise>
{
    public void Configure(EntityTypeBuilder<Exercise> b)
    {
        b.ToTable("Exercise");
        b.Property(x => x.Name).HasMaxLength(ValidationRules.ExerciseNameMax).IsRequired();
        b.HasIndex(x => x.Name).IsUnique();
        b.Property(x => x.Description).HasMaxLength(ValidationRules.DescriptionMax);
        b.Property(x => x.Instructions).HasMaxLength(ValidationRules.InstructionsMax);
        b.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.MuscleGroup).WithMany().HasForeignKey(x => x.MuscleGroupId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Equipment).WithMany().HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Media).WithOne(x => x.Exercise).HasForeignKey(x => x.ExerciseId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ExerciseMediaConfiguration : IEntityTypeConfiguration<ExerciseMedia>
{
    public void Configure(EntityTypeBuilder<ExerciseMedia> b)
    {
        b.ToTable("ExerciseMedia");
        b.Property(x => x.MediaType).HasConversion<string>().HasMaxLength(10);
        b.Property(x => x.FileUrl).HasMaxLength(500).IsRequired();
        b.Property(x => x.ThumbnailUrl).HasMaxLength(500);
        b.Property(x => x.FileName).HasMaxLength(255).IsRequired();
        b.Property(x => x.MimeType).HasMaxLength(100).IsRequired();
        b.Property(x => x.AltText).HasMaxLength(ValidationRules.MediaTextMax);
        b.Property(x => x.Title).HasMaxLength(ValidationRules.MediaTextMax);
        b.HasIndex(x => new { x.ExerciseId, x.DisplayOrder });
    }
}

internal sealed class WorkoutSessionConfiguration : IEntityTypeConfiguration<WorkoutSession>
{
    public void Configure(EntityTypeBuilder<WorkoutSession> b)
    {
        b.ToTable("WorkoutSession");
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.TimeZoneId).HasMaxLength(64);
        b.HasOne(x => x.User).WithMany(u => u.WorkoutSessions).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Exercises).WithOne(x => x.WorkoutSession).HasForeignKey(x => x.WorkoutSessionId).OnDelete(DeleteBehavior.Cascade);

        // Deliberately NOT unique: many sessions per user per day (spec §8).
        b.HasIndex(x => new { x.UserId, x.WorkoutDate });
        b.HasIndex(x => new { x.UserId, x.Status });
    }
}

internal sealed class WorkoutExerciseConfiguration : IEntityTypeConfiguration<WorkoutExercise>
{
    public void Configure(EntityTypeBuilder<WorkoutExercise> b)
    {
        b.ToTable("WorkoutExercise");
        b.HasOne(x => x.Exercise).WithMany().HasForeignKey(x => x.ExerciseId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Sets).WithOne(x => x.WorkoutExercise).HasForeignKey(x => x.WorkoutExerciseId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.WorkoutSessionId, x.DisplayOrder }).IsUnique();
        b.HasIndex(x => x.ExerciseId);
    }
}

internal sealed class WorkoutSetConfiguration : IEntityTypeConfiguration<WorkoutSet>
{
    public void Configure(EntityTypeBuilder<WorkoutSet> b)
    {
        b.ToTable("WorkoutSet");
        b.HasIndex(x => new { x.WorkoutExerciseId, x.SetNumber }).IsUnique();
    }
}

internal sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> b)
    {
        b.ToTable("AuditLog");
        b.Property(x => x.Action).HasMaxLength(50).IsRequired();
        b.Property(x => x.EntityName).HasMaxLength(50).IsRequired();
        b.Property(x => x.EntityId).HasMaxLength(100);
        b.Property(x => x.OldValue).HasMaxLength(1000);
        b.Property(x => x.NewValue).HasMaxLength(1000);
        b.HasIndex(x => x.CreatedDate);
    }
}

internal sealed class LoginAttemptConfiguration : IEntityTypeConfiguration<LoginAttempt>
{
    public void Configure(EntityTypeBuilder<LoginAttempt> b)
    {
        b.ToTable("LoginAttempt");
        b.Property(x => x.Email).HasMaxLength(ValidationRules.EmailMax).IsRequired();
        b.HasIndex(x => new { x.Email, x.AttemptedAt });
    }
}

internal sealed class IdempotencyRecordConfiguration : IEntityTypeConfiguration<IdempotencyRecord>
{
    public void Configure(EntityTypeBuilder<IdempotencyRecord> b)
    {
        b.ToTable("IdempotencyRecord");
        b.Property(x => x.Key).HasMaxLength(100).IsRequired();
        b.Property(x => x.Method).HasMaxLength(10).IsRequired();
        b.Property(x => x.Path).HasMaxLength(300).IsRequired();
        b.HasIndex(x => new { x.UserId, x.Key, x.Method, x.Path }).IsUnique();
        b.HasIndex(x => x.CreatedDate);
    }
}

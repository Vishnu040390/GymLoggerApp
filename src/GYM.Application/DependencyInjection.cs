using GYM.Application.Analytics;
using GYM.Application.Authentication;
using GYM.Application.Exercises;
using GYM.Application.Media;
using GYM.Application.ReferenceData;
using GYM.Application.Users;
using GYM.Application.WorkoutExercises;
using GYM.Application.Workouts;
using GYM.Application.WorkoutSets;
using Microsoft.Extensions.DependencyInjection;

namespace GYM.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<AuthService>();
        services.AddScoped<UserService>();
        services.AddScoped<ReferenceDataService>();
        services.AddScoped<ExerciseService>();
        services.AddScoped<ExerciseMediaService>();
        services.AddScoped<WorkoutService>();
        services.AddScoped<WorkoutExerciseService>();
        services.AddScoped<WorkoutSetService>();
        services.AddScoped<ExerciseHistoryService>();
        services.AddScoped<ExerciseAnalyticsService>();
        return services;
    }
}

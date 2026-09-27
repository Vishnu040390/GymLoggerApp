namespace GYM.Infrastructure.Persistence;

/// <summary>Starter exercise library (same content as the UX prototype).</summary>
internal static class SeedData
{
    public static readonly string[] Categories = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core"];
    public static readonly string[] MuscleGroups = ["Chest", "Lats", "Upper back", "Quads", "Hamstrings", "Glutes", "Front delts", "Side delts", "Biceps", "Triceps", "Abs"];
    public static readonly string[] Equipment = ["Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight", "Kettlebell"];

    internal sealed record ExerciseSeed(string Key, string Name, string Category, string Muscle, string Equipment, int[] From, int[] To, string Description, string Instructions, bool Active = true);

    public static readonly ExerciseSeed[] Exercises =
    [
        new("bench", "Bench Press", "Chest", "Chest", "Barbell", [11, 9, 8], [15, 13, 11],
            "A horizontal barbell press and the main compound lift for chest strength. Also trains front delts and triceps.",
            "Lie on the bench with your eyes directly under the bar.\nGrip the bar slightly wider than shoulder width and set your shoulder blades back and down.\nUnrack and lower the bar with control to mid-chest.\nPress up until your arms are straight, keeping your feet planted and glutes on the bench."),
        new("incline-db", "Incline Dumbbell Press", "Chest", "Chest", "Dumbbell", [10, 9, 8], [12, 11, 10],
            "A pressing movement on a 30–45° bench that emphasises the upper chest.",
            "Set the bench to 30–45°.\nStart with the dumbbells at shoulder height, palms facing forward.\nPress up and slightly together until your arms are straight.\nLower slowly until you feel a stretch across the chest."),
        new("pushup", "Push-Up", "Chest", "Chest", "Bodyweight", [20, 16, 14], [28, 24, 20],
            "A bodyweight press that can be done anywhere. Keep a straight line from head to heels.",
            "Place your hands slightly wider than shoulder width.\nBrace your core so your body forms a straight line.\nLower until your chest is just above the floor.\nPush back up to full arm extension."),
        new("ohp", "Overhead Press", "Shoulders", "Front delts", "Barbell", [9, 8, 7], [11, 10, 9],
            "A standing barbell press overhead for shoulder strength and core stability.",
            "Hold the bar at collarbone height with a grip just outside the shoulders.\nBrace your core and squeeze your glutes.\nPress the bar straight up, moving your head back slightly to clear it.\nLock out overhead, then lower with control."),
        new("lateral", "Lateral Raise", "Shoulders", "Side delts", "Dumbbell", [12, 12, 10], [15, 14, 12],
            "An isolation movement for the side delts that builds shoulder width.",
            "Stand tall with a dumbbell in each hand at your sides.\nRaise the dumbbells out to the side with a slight bend in the elbows.\nStop at shoulder height.\nLower slowly over two to three seconds."),
        new("dip", "Triceps Dip", "Arms", "Triceps", "Bodyweight", [8, 7, 6], [12, 10, 9],
            "A bodyweight press on parallel bars that targets the triceps and lower chest.",
            "Support yourself on the bars with straight arms.\nKeep your torso upright to emphasise the triceps.\nLower until your elbows reach about 90°.\nPress back up to straight arms."),
        new("pullup", "Pull-Up", "Back", "Lats", "Bodyweight", [6, 5, 4], [9, 8, 7],
            "A vertical pull from a dead hang. The benchmark bodyweight back exercise.",
            "Hang from the bar with an overhand grip slightly wider than shoulder width.\nPull your shoulder blades down, then drive your elbows toward your ribs.\nPull until your chin clears the bar.\nLower to a full hang with control."),
        new("row", "Barbell Row", "Back", "Upper back", "Barbell", [10, 9, 8], [12, 11, 10],
            "A bent-over horizontal pull that builds the upper back and lats.",
            "Hinge at the hips until your torso is about 45° to the floor.\nHold the bar with straight arms below your shoulders.\nRow the bar to your lower ribs, squeezing your shoulder blades together.\nLower with control without rounding your back."),
        new("pulldown", "Lat Pulldown", "Back", "Lats", "Cable", [12, 10, 10], [14, 12, 12],
            "A cable vertical pull. Useful for building up to pull-ups.",
            "Sit with your thighs secured under the pads.\nGrip the bar wider than shoulder width.\nPull the bar to your upper chest, leading with the elbows.\nLet the bar rise slowly until your arms are straight."),
        new("curl", "Barbell Curl", "Arms", "Biceps", "Barbell", [10, 9, 8], [12, 11, 10],
            "A standing curl for the biceps.",
            "Stand tall holding the bar with an underhand, shoulder-width grip.\nKeep your elbows at your sides.\nCurl the bar up to shoulder height.\nLower slowly to straight arms."),
        new("squat", "Back Squat", "Legs", "Quads", "Barbell", [8, 8, 7], [10, 10, 9],
            "The main lower-body compound lift. Trains quads, glutes and core.",
            "Set the bar across your upper back and step out of the rack.\nStand with feet about shoulder width apart, toes slightly out.\nSit down and back until your hips are below your knees.\nDrive up through your whole foot to standing."),
        new("rdl", "Romanian Deadlift", "Legs", "Hamstrings", "Barbell", [10, 9, 8], [12, 11, 10],
            "A hip hinge that loads the hamstrings and glutes through a long range.",
            "Stand holding the bar at hip height.\nPush your hips back, keeping the bar close to your legs.\nLower until you feel a strong hamstring stretch, back flat.\nDrive your hips forward to stand tall."),
        new("lunge", "Walking Lunge", "Legs", "Glutes", "Dumbbell", [10, 10, 10], [12, 12, 12],
            "A single-leg movement for glutes, quads and balance. Count reps per leg.",
            "Hold a dumbbell in each hand.\nStep forward and lower until both knees are at about 90°.\nPush through the front heel and step into the next lunge.\nAlternate legs for the full set."),
        new("legpress", "Leg Press", "Legs", "Quads", "Machine", [12, 10, 10], [15, 14, 12],
            "A machine press for the quads with less load on the lower back.",
            "Sit with your back flat against the pad.\nPlace your feet shoulder width apart on the platform.\nLower the platform until your knees reach about 90°.\nPress back up without locking your knees."),
        new("hlr", "Hanging Leg Raise", "Core", "Abs", "Bodyweight", [10, 8, 8], [14, 12, 10],
            "A hanging core exercise for the lower abs and hip flexors.",
            "Hang from the bar with straight arms.\nBrace your core to stop swinging.\nRaise your legs until they are parallel to the floor or higher.\nLower slowly."),
        new("cablecrunch", "Cable Crunch", "Core", "Abs", "Cable", [15, 12, 12], [18, 16, 15],
            "A kneeling cable crunch for loaded ab training.",
            "Kneel facing the cable stack holding the rope beside your head.\nKeep your hips still.\nCrunch down by bringing your ribs toward your hips.\nReturn slowly to the start."),
        new("kbswing", "Kettlebell Swing", "Legs", "Glutes", "Kettlebell", [15, 15, 15], [20, 20, 18],
            "An explosive hip hinge for power and conditioning.",
            "Stand with feet wider than hip width and the kettlebell in front of you.\nHike the bell back between your legs.\nSnap your hips forward to swing it to chest height.\nLet it fall back and repeat."),
        new("smith", "Smith Machine Squat", "Legs", "Quads", "Machine", [10, 10, 10], [10, 10, 10],
            "A guided squat on the Smith machine. Deactivated: the gym removed this machine.",
            "Set the bar at shoulder height.\nStep under the bar with feet slightly in front of you.\nSquat to parallel.\nDrive up to standing.", Active: false),
    ];

    public static readonly Dictionary<string, string[]> Rotation = new()
    {
        ["push"] = ["bench", "incline-db", "ohp", "lateral", "dip"],
        ["pull"] = ["pullup", "row", "pulldown", "curl", "cablecrunch"],
        ["legs"] = ["squat", "rdl", "lunge", "legpress", "hlr"],
    };
}

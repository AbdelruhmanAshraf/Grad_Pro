import { AiRequestType, KnowledgeContext } from "../knowledge/types";

/**
 * Formats a local calendar date as an ISO-like `yyyy-MM-dd` string.
 */
function getLocalDateKey(date = new Date()): string {
  return date.toLocaleDateString("en-CA");
}

/**
 * Builds a deterministic, plain-text RAG system prompt fragment from the
 * provided knowledge context and request metadata.
 *
 * The returned string is safe to serialize and inject into an LLM system
 * prompt. It never imports React or any UI-specific code.
 *
 * @param context - Aggregated knowledge context from all persisted store slices.
 * @param request - Metadata describing the current AI request.
 * @returns A plain string prompt fragment for context injection.
 */
export function buildRAGContext(
  context: KnowledgeContext,
  request: { requestType: AiRequestType; userInput?: string; date?: string }
): string {
  const dateKey = request.date || getLocalDateKey();

  const user = context.user.user;
  const profileLines: string[] = [];

  if (user) {
    if (user.name) profileLines.push(`Name: ${user.name}`);
    if (user.age) profileLines.push(`Age: ${user.age}`);
    if (user.gender) profileLines.push(`Gender: ${user.gender}`);
    if (user.weight) profileLines.push(`Weight: ${user.weight} kg`);
    if (user.height) profileLines.push(`Height: ${user.height} cm`);
    if (user.bmi) profileLines.push(`BMI: ${user.bmi} (${user.bmiCategory ?? "unknown category"})`);

    profileLines.push(`Calorie goal: ${user.calorieGoal ?? 0} kcal`);
    profileLines.push(`Protein goal: ${user.proteinGoal ?? 0} g`);
    profileLines.push(`Carbs goal: ${user.carbsGoal ?? 0} g`);
    profileLines.push(`Fat goal: ${user.fatGoal ?? 0} g`);

    if (user.dietaryPreferences?.length) {
      profileLines.push(`Dietary preferences: ${user.dietaryPreferences.join(", ")}`);
    }

    if (user.allergies?.length) {
      profileLines.push(`Allergies: ${user.allergies.join(", ")}`);
    }

    if (user.cuisinePreferences?.length) {
      profileLines.push(`Cuisine preferences: ${user.cuisinePreferences.join(", ")}`);
    }
  } else {
    profileLines.push("No user profile available.");
  }

  const daily = context.user.dailyCalories[dateKey];
  const nutritionLines: string[] = [];

  if (daily) {
    nutritionLines.push(`Calories: ${daily.totalCalories} / ${user?.calorieGoal ?? "unknown"} kcal`);
    nutritionLines.push(`Protein: ${daily.totalProtein} g`);
    nutritionLines.push(`Carbs: ${daily.totalCarbs} g`);
    nutritionLines.push(`Fat: ${daily.totalFat} g`);

    if (daily.entries.length) {
      const meals = daily.entries
        .slice()
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .map((entry) => `- ${entry.foodName} (${entry.mealTag}): ${entry.calories} kcal, ${entry.protein}g protein`);
      nutritionLines.push("Recent meals:");
      nutritionLines.push(...meals);
    }
  } else {
    nutritionLines.push("No nutrition data for this date.");
  }

  const hydrationLines: string[] = [];
  const hydration = context.progress.hydrationDaily[dateKey];
  if (hydration !== undefined) {
    hydrationLines.push(`Hydration: ${hydration} ml`);
  } else {
    hydrationLines.push("No hydration data for this date.");
  }

  const workoutLines: string[] = [];
  const todayWorkouts = context.progress.workouts
    .filter((w) => w.date === dateKey)
    .slice()
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));

  if (todayWorkouts.length) {
    for (const workout of todayWorkouts) {
      workoutLines.push(
        `- ${workout.muscleGroup}: ${workout.completionPercentage}% complete, volume ${workout.totalVolumeKg} kg`
      );
    }
  } else {
    workoutLines.push("No workouts recorded for this date.");
  }

  const requestLines: string[] = [
    `Request type: ${request.requestType}`,
  ];

  if (request.userInput) {
    requestLines.push(`User input: ${request.userInput}`);
  }

  const sections = [
    "You are Dietin, a personal nutrition and fitness assistant.",
    "",
    "USER PROFILE:",
    profileLines.join("\n"),
    "",
    "TODAY'S CONTEXT:",
    `Date: ${dateKey}`,
    "",
    "Nutrition:",
    nutritionLines.join("\n"),
    "",
    "Hydration:",
    hydrationLines.join("\n"),
    "",
    "Workouts:",
    workoutLines.join("\n"),
    "",
    "CURRENT REQUEST:",
    requestLines.join("\n"),
    "",
    "INSTRUCTIONS:",
    "Answer concisely and accurately based only on the context provided above.",
    "If the context does not contain enough information, say so clearly.",
  ];

  return sections.join("\n");
}

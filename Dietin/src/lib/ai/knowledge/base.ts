/**
 * Assembles a stable, serializable {@link KnowledgeContext} from the
 * persisted Zustand stores in the application.
 *
 * This module is intentionally free of React and UI dependencies. It reads
 * the localStorage keys written by each store's `persist` middleware and
 * maps the raw data into the typed slice interfaces defined in
 * `./types.ts`. Missing or malformed persisted data is handled gracefully
 * with safe defaults.
 */

import type {
  HydrationKnowledgeSlice,
  KnowledgeContext,
  MealKnowledgeSlice,
  NutritionKnowledgeSlice,
  ProgressKnowledgeSlice,
  UserKnowledgeSlice,
  WorkoutKnowledgeSlice,
} from "./types";

/** localStorage keys used by each persisted Zustand store. */
const STORAGE_KEYS = {
  user: "user-storage",
  progress: "progress-storage",
  workout: "workout-storage",
  meal: "meal-suggestions",
  hydration: "hydration-suggestions",
} as const;

/**
 * Safely read and parse a localStorage entry.
 *
 * @param key - The localStorage key to read.
 * @param fallback - The value to return when localStorage is unavailable,
 *                   the key is missing, or the stored value is not valid JSON.
 * @returns The parsed stored value, or `fallback` on any failure.
 */
function readStorage<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Build the user knowledge slice from the persisted `user-storage` entry.
 *
 * Persists: `user`, `dailyCalories`, `customTags`, `dailyImageAnalysis`,
 * `dailyMealAnalysis`, `lastQuotaReset`, and `yearlyMeals`.
 */
function buildUserSlice(): UserKnowledgeSlice {
  const raw = readStorage<Partial<UserKnowledgeSlice>>(STORAGE_KEYS.user, {});

  return {
    user: raw.user ?? null,
    dailyCalories: raw.dailyCalories ?? {},
    customTags: raw.customTags ?? [],
    dailyImageAnalysis: raw.dailyImageAnalysis ?? 0,
    dailyMealAnalysis: raw.dailyMealAnalysis ?? 0,
    lastQuotaReset: raw.lastQuotaReset ?? new Date().toISOString(),
    yearlyMeals: raw.yearlyMeals ?? {},
  };
}

/**
 * Build the nutrition knowledge slice.
 *
 * The `nutritionStore` does not currently use `persist`, so its values are
 * not available in localStorage. This slice returns the default runtime
 * state so the assembled context remains complete and serializable.
 */
function buildNutritionSlice(): NutritionKnowledgeSlice {
  return {
    exceededNutrient: null,
    burnedCalories: 0,
  };
}

/**
 * Build the progress knowledge slice from the persisted `progress-storage`
 * entry.
 *
 * Persists: `weights`, `measurements`, `photos`, `workouts`, `prs`,
 * `hydrationDaily`, `fitnessScores`, `weeklyReports`, `streaks`,
 * `startWeightKg`, and `startWeightDate`.
 */
function buildProgressSlice(): ProgressKnowledgeSlice {
  const raw = readStorage<Partial<ProgressKnowledgeSlice>>(
    STORAGE_KEYS.progress,
    {},
  );

  return {
    weights: raw.weights ?? [],
    measurements: raw.measurements ?? [],
    photos: raw.photos ?? [],
    workouts: raw.workouts ?? [],
    prs: raw.prs ?? {},
    hydrationDaily: raw.hydrationDaily ?? {},
    fitnessScores: raw.fitnessScores ?? [],
    weeklyReports: raw.weeklyReports ?? [],
    streaks: raw.streaks ?? {
      workout: { current: 0, longest: 0 },
      protein: { current: 0, longest: 0 },
      calories: { current: 0, longest: 0 },
      hydration: { current: 0, longest: 0 },
      visit: { current: 0, longest: 0 },
    },
    startWeightKg: raw.startWeightKg ?? null,
    startWeightDate: raw.startWeightDate ?? null,
  };
}

/**
 * Build the workout knowledge slice from the persisted `workout-storage`
 * entry.
 *
 * Persists: `favorites`.
 */
function buildWorkoutSlice(): WorkoutKnowledgeSlice {
  const raw = readStorage<Partial<WorkoutKnowledgeSlice>>(
    STORAGE_KEYS.workout,
    {},
  );

  return {
    favorites: raw.favorites ?? [],
  };
}

/**
 * Build the meal suggestion knowledge slice from the persisted
 * `meal-suggestions` entry.
 *
 * Persists: `suggestions`, `lastUpdated`, and `lastMealType`.
 */
function buildMealSlice(): MealKnowledgeSlice {
  const raw = readStorage<Partial<MealKnowledgeSlice>>(STORAGE_KEYS.meal, {});

  return {
    suggestions: raw.suggestions ?? [],
    lastUpdated: raw.lastUpdated ?? null,
    lastMealType: raw.lastMealType ?? null,
  };
}

/**
 * Build the hydration suggestion knowledge slice from the persisted
 * `hydration-suggestions` entry.
 *
 * Persists: `suggestions`, `lastUpdated`, and `lastDrinkType`.
 */
function buildHydrationSlice(): HydrationKnowledgeSlice {
  const raw = readStorage<Partial<HydrationKnowledgeSlice>>(
    STORAGE_KEYS.hydration,
    {},
  );

  return {
    suggestions: raw.suggestions ?? [],
    lastUpdated: raw.lastUpdated ?? null,
    lastDrinkType: raw.lastDrinkType ?? null,
  };
}

/**
 * Assemble a complete {@link KnowledgeContext} from all persisted local
 * Zustand stores.
 *
 * The function never throws; missing or corrupted store data is replaced
 * with safe defaults so callers always receive a fully populated,
 * serializable context.
 *
 * @returns A stable, serializable knowledge context.
 */
export function buildKnowledgeContext(): KnowledgeContext {
  return {
    user: buildUserSlice(),
    nutrition: buildNutritionSlice(),
    progress: buildProgressSlice(),
    workout: buildWorkoutSlice(),
    meal: buildMealSlice(),
    hydration: buildHydrationSlice(),
  };
}

/**
 * Serialize a {@link KnowledgeContext} to a compact, deterministic JSON
 * string.
 *
 * Object keys are sorted recursively so that equivalent contexts produce
 * identical strings regardless of property insertion order.
 *
 * @param ctx - The knowledge context to serialize.
 * @returns A compact JSON representation of `ctx`.
 */
export function serializeKnowledgeContext(ctx: KnowledgeContext): string {
  return JSON.stringify(ctx, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((sorted, k) => {
          sorted[k] = value[k];
          return sorted;
        }, {});
    }
    return value;
  });
}

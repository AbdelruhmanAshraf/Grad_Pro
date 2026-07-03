/**
 * Pure type definitions for the AI Agent's knowledge context.
 *
 * These shapes mirror the serializable, persisted slices of the application
 * stores. No runtime code, React components, or Zustand helpers belong here.
 */

/*
 * Local aliases for external domain types so this module remains self-contained
 * and compiles with `tsc --noEmit` without relying on path-mapping resolution.
 */

/** Calorie log entry persisted by the user store. */
export interface CalorieEntry {
  id: string;
  foodName: string;
  description: string;
  mealTag: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timestamp: string;
  healthScore: number;
  isUSDA?: boolean;
  usdaId?: string;
  portionSize?: number;
  portionUnit?: string;
  cholesterol?: number;
  magnesium?: number;
  sugar?: number;
  fiber?: number;
  sodium?: number;
  potassium?: number;
  vitaminA?: number;
  vitaminC?: number;
  calcium?: number;
  iron?: number;
  ingredients?: string[];
}

/** Local date key, formatted as "yyyy-MM-dd". */
export type DateKey = string;

/** A single recorded weight measurement. */
export interface WeightEntry {
  date: DateKey;
  weightKg: number;
  source?: "manual" | "import";
  note?: string;
}

/** Body circumference measurements for a given date. */
export interface BodyMeasurement {
  date: DateKey;
  waistCm?: number;
  chestCm?: number;
  armsCm?: number;
  hipsCm?: number;
  thighsCm?: number;
  neckCm?: number;
}

/** Progress photo asset descriptor. */
export interface PhotoAsset {
  path: string;
  thumbPath?: string;
  width?: number;
  height?: number;
}

/** Progress photo set for a single week. */
export interface ProgressPhoto {
  weekId: string;
  capturedAt: string;
  weightKgAtCapture?: number;
  front?: PhotoAsset;
  side?: PhotoAsset;
  back?: PhotoAsset;
}

/** A completed exercise within a workout session. */
export interface ExerciseRecord {
  name: string;
  musclesWorked: string[];
  setsCompleted: number;
  totalSets: number;
  reps: number;
  weight: number;
  restTime: number;
  rpm?: number;
  volume?: number;
}

/** A recorded workout session. */
export interface WorkoutSession {
  sessionId: string;
  date: DateKey;
  muscleGroup: string;
  completionPercentage: number;
  totalVolumeKg: number;
  exercises: ExerciseRecord[];
  createdAt?: string;
}

/** A single personal-record attempt. */
export interface PrAttempt {
  date: DateKey;
  weightKg: number;
  reps: number;
  e1rmKg: number;
  volumeKg: number;
}

/** Aggregated personal record for an exercise. */
export interface PersonalRecord {
  exercise: string;
  exerciseSlug: string;
  bestWeightKg: number;
  bestWeightReps: number;
  bestE1rmKg: number;
  bestVolumeKg: number;
  history: PrAttempt[];
  updatedAt?: string;
}

/** Daily fitness score breakdown. */
export interface FitnessScore {
  date: DateKey;
  diet: number;
  workout: number;
  hydration: number;
  consistency: number;
  overall: number;
}

/** Weekly progress summary report. */
export interface WeeklyReport {
  weekId: string;
  weekStart: DateKey;
  weekEnd: DateKey;
  weightDeltaKg: number;
  workoutsCompleted: number;
  proteinHitDays: number;
  calorieHitDays: number;
  hydrationHitDays: number;
  consistencyScoreDelta: number;
  summaryText: string;
  summaryHighlights: string[];
  shareImagePath?: string;
  generatedAt?: string;
  model?: string;
}

/** Streak counters for a single activity. */
export interface StreakInfo {
  current: number;
  longest: number;
  lastDate?: DateKey;
}

/** Supported streak categories. */
export type StreakKind =
  | "workout"
  | "protein"
  | "calories"
  | "hydration"
  | "visit";

/** Collection of streak counters. */
export type StreaksDoc = Record<StreakKind, StreakInfo> & {
  updatedAt?: string;
};

/**
 * A single mood entry persisted for the user.
 */
export interface MoodEntry {
  mood: "very-happy" | "happy" | "neutral" | "sad" | "very-sad";
  date: string;
  timestamp: number;
}

/**
 * Aggregated nutrition data for a single day (from userStore).
 */
export interface DailyCalories {
  date: string;
  entries: CalorieEntry[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

/**
 * Serializable subset of the user profile and daily meal log.
 */
export interface UserKnowledgeSlice {
  user: {
    name?: string;
    age?: number;
    gender?: string;
    height?: number;
    weight?: number;
    bmi?: number;
    bmiCategory?: string;
    calorieGoal: number;
    proteinGoal: number;
    carbsGoal: number;
    fatGoal: number;
    metabolism: number;
    profilePicture?: string;
    experienceLevel?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
    isPro?: boolean;
    isMoodTrackerEnabled?: boolean;
    onboardingCompleted?: boolean;
    healthDisclaimerAccepted?: boolean;
    /** Persisted acceptance timestamp; shape depends on the backing store. */
    healthDisclaimerAcceptedAt?: unknown;
    moodHistory?: MoodEntry[];
    dietaryPreferences?: string[];
    allergies?: string[];
    cuisinePreferences?: string[];
    aiPersonalization?: string;
  } | null;
  dailyCalories: Record<string, DailyCalories>;
  customTags: string[];
  dailyImageAnalysis: number;
  dailyMealAnalysis: number;
  lastQuotaReset: string;
  yearlyMeals: Record<number, CalorieEntry[]>;
}

/**
 * Serializable subset of the nutrition store.
 */
export interface NutritionKnowledgeSlice {
  exceededNutrient: {
    type: string;
    amount: number;
    goal: number;
  } | null;
  burnedCalories: number;
}

/**
 * Serializable subset of the progress store.
 */
export interface ProgressKnowledgeSlice {
  weights: WeightEntry[];
  measurements: BodyMeasurement[];
  photos: ProgressPhoto[];
  workouts: WorkoutSession[];
  prs: Record<string, PersonalRecord>;
  hydrationDaily: Record<DateKey, number>;
  fitnessScores: FitnessScore[];
  weeklyReports: WeeklyReport[];
  streaks: StreaksDoc;
  startWeightKg: number | null;
  startWeightDate: DateKey | null;
}

/**
 * Serializable exercise shape stored in the workout favorites list.
 */
export interface FavoriteExercise {
  id: string;
  name: string;
  force?: string;
  level: string;
  mechanic?: string;
  equipment?: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

/**
 * Serializable subset of the workout store.
 */
export interface WorkoutKnowledgeSlice {
  favorites: FavoriteExercise[];
}

/**
 * Serializable meal suggestion persisted for the AI Agent.
 */
export interface MealSuggestion {
  name: string;
  type: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  difficulty: "Easy" | "Medium" | "Hard";
  timeToMake: string;
  budget: "€" | "€€" | "€€€";
  quickRecipe: string;
  cuisine: string;
}

/**
 * Serializable subset of the meal suggestion store.
 */
export interface MealKnowledgeSlice {
  suggestions: MealSuggestion[];
  lastUpdated: string | null;
  lastMealType: "Breakfast" | "Lunch" | "Dinner" | "Snack" | null;
}

/**
 * Serializable drink suggestion persisted for the AI Agent.
 */
export interface DrinkSuggestion {
  name: string;
  type: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  difficulty: "Easy" | "Medium" | "Hard";
  timeToMake: string;
  budget: "€" | "€€" | "€€€";
  quickRecipe: string;
}

/**
 * Serializable subset of the hydration suggestion store.
 */
export interface HydrationKnowledgeSlice {
  suggestions: DrinkSuggestion[];
  lastUpdated: string | null;
  lastDrinkType: string | null;
}

/**
 * Aggregated knowledge context assembled from all persisted store slices.
 */
export interface KnowledgeContext {
  user: UserKnowledgeSlice;
  nutrition: NutritionKnowledgeSlice;
  progress: ProgressKnowledgeSlice;
  workout: WorkoutKnowledgeSlice;
  meal: MealKnowledgeSlice;
  hydration: HydrationKnowledgeSlice;
}

/**
 * Alias for the fully serializable knowledge context.
 */
export type SerializedKnowledgeContext = KnowledgeContext;

/**
 * Request types supported by the AI Agent.
 */
export type AiRequestType =
  | "meal_analysis"
  | "hydration"
  | "workout_plan"
  | "meal_suggestions";

/**
 * Knowledge context extended with request-specific metadata for an AI call.
 */
export interface AiRequestContext extends KnowledgeContext {
  requestType: AiRequestType;
  /** Optional free-text prompt or user message attached to the request. */
  userInput?: string;
}

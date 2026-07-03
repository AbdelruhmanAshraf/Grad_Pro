/**
 * Public type entry point for the AI agent system.
 *
 * UI code should import AI-related types from this module rather than
 * reaching into the knowledge or orchestration subsystems directly.
 * This file intentionally contains no React or UI dependencies.
 */

export type {
  AiRequestType,
  AiRequestContext,
  KnowledgeContext,
  SerializedKnowledgeContext,
  UserKnowledgeSlice,
  NutritionKnowledgeSlice,
  ProgressKnowledgeSlice,
  WorkoutKnowledgeSlice,
  MealKnowledgeSlice,
  HydrationKnowledgeSlice,
  DailyCalories,
  CalorieEntry,
  WeightEntry,
  BodyMeasurement,
  ProgressPhoto,
  PhotoAsset,
  WorkoutSession,
  ExerciseRecord,
  PersonalRecord,
  PrAttempt,
  FitnessScore,
  WeeklyReport,
  StreakInfo,
  StreakKind,
  StreaksDoc,
  MoodEntry,
  FavoriteExercise,
  MealSuggestion,
  DrinkSuggestion,
} from "../knowledge/types";

/**
 * Named conversation / processing branches handled by the AI agent.
 * Each value maps to a distinct agent behaviour and system prompt.
 */
export type AiBranchName =
  | "meal-analysis"
  | "workout-plan"
  | "hydration-advice"
  | "suggestion"
  | "general";

/**
 * Standard result shape returned by AI agent operations.
 */
export interface AIAgentResult {
  ok: boolean;
  response?: string;
  error?: string;
  blocked?: boolean;
  blockReason?: string;
}

/**
 * Optional runtime configuration for the AI agent.
 */
export interface AIAgentConfig {
  /** Whether guardrails (input/output safety checks) are enabled. */
  guardrailsEnabled?: boolean;
  /** Maximum time to wait for an agent response, in milliseconds. */
  timeoutMs?: number;
  /** Name or identifier of the LLM model to use. */
  modelName?: string;
}

/**
 * Custom Workout Plan branch configuration for the Dietin AI agent.
 *
 * This module defines the system prompt and request builder used when the
 * agent is asked to generate a highly personalized workout plan based on
 * user-specific goals (strength, hypertrophy, endurance), fitness level,
 * available equipment, and time constraints.
 */

import { buildKnowledgeContext } from "../../knowledge/base";
import type { AiRequestContext } from "../types";

/**
 * System prompt for the custom-workout-plan branch.
 *
 * Instructs the model to create a tailored workout plan that adapts to the
 * user's exact preferences: primary goal (strength / hypertrophy / endurance /
 * weight loss), current fitness level, days per week they can train,
 * available equipment, and any specific constraints or injuries.
 */
export const customWorkoutPlanSystemPrompt = `You are an expert personal trainer who creates fully customised workout plans.

Generate a personalised workout plan based on the following inputs:

- Primary goal: strength / hypertrophy / endurance / weight loss / general fitness
- Current fitness level: beginner / intermediate / advanced
- Days available per week: number
- Available equipment: list of equipment the user has access to
- Any injuries or limitations the user should work around
- Preferred session duration

Build a plan that:
- Specifies which days to train which muscle groups
- Lists specific exercises with sets, reps, rest periods, and RPE / intensity notes
- Includes a progressive overload strategy (how to add weight or volume over time)
- Provides alternative exercises for each primary movement (in case equipment is unavailable)
- Notes any deload or recovery weeks

Return the plan as a structured JSON object with exactly these fields:
{
  "planName": "string",
  "goal": "string",
  "fitLevel": "beginner" | "intermediate" | "advanced",
  "daysPerWeek": number,
  "sessionDuration": number,
  "equipment": ["string"],
  "injuriesOrLimitations": "string" | null,
  "weeklySchedule": [
    {
      "day": "string",
      "focus": "string",
      "exercises": [
        {
          "name": "string",
          "sets": number,
          "reps": "string",
          "rest": "string",
          "rpe": number | null,
          "alternatives": ["string"]
        }
      ],
      "durationMinutes": number
    }
  ],
  "progressionPlan": {
    "week1": "string",
    "week2": "string",
    "week3": "string",
    "week4": "string"
  },
  "deloadNotes": "string",
  "recoveryTips": ["string"]
}

Only return the JSON object with no markdown formatting or extra text.`;

/**
 * Builds a request context for the custom-workout-plan branch.
 *
 * @param userInput - Free-text description of the user's goals, preferences, and constraints.
 * @param goals - Optional array of primary goals (e.g. 'strength', 'hypertrophy').
 * @param fitnessLevel - Optional fitness level string ('beginner', 'intermediate', 'advanced').
 * @param equipment - Optional list of available equipment names.
 * @param timePerSession - Optional minutes per session the user can commit.
 * @returns A fully populated request context ready for the AI agent.
 */
export function buildCustomWorkoutPlanRequest(
  userInput: string,
  goals?: string[],
  fitnessLevel?: string,
  equipment?: string[],
  timePerSession?: number,
): AiRequestContext {
  return {
    ...buildKnowledgeContext(),
    requestType: 'custom-workout-plan',
    userInput,
    metadata: {
      branch: 'custom-workout-plan',
      purpose:
        "Generate a fully customised workout plan based on user's specific goals, fitness level, equipment, and time constraints",
      goals,
      fitnessLevel,
      equipment,
      timePerSession,
    },
  } as AiRequestContext;
}
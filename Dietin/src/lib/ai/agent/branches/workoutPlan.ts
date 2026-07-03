/**
 * Workout Plan branch configuration for the Dietin AI agent.
 *
 * This module defines the system prompt and request builder used when the
 * agent is asked to generate a full workout plan (muscle groups, exercises,
 * sets, reps, rest periods) for a given goal or preference.
 */

import { buildKnowledgeContext } from "../../knowledge/base";
import type { AiRequestContext } from "../types";

/**
 * System prompt for the workout-plan branch.
 *
 * Instructs the model to generate a structured workout plan suitable for
 * the user's stated goal, experience level, and available equipment. The
 * response should be a plan object with a weekly schedule and per-exercise
 * detail (sets, reps, rest, intensity).
 */
export const workoutPlanSystemPrompt = `You are an expert personal trainer and workout planner.

Generate a detailed workout plan based on the user's goal, fitness level, and available equipment.

Include:
- A weekly schedule (which days to train which muscle groups)
- For each exercise: name, sets, reps, rest period, and any intensity notes
- Warm-up and cool-down suggestions
- Estimated session duration
- Progression advice (how to increase difficulty over time)

Return the plan as a structured JSON object with these fields:
{
  "planName": "string",
  "goal": "string",
  "fitnessLevel": "string",
  "daysPerWeek": number,
  "sessionsPerWeek": number,
  "weeklySchedule": [
    {
      "day": "string",
      "focus": "string",
      "exercises": [
        {
          "name": "string",
          "sets": number,
          "reps": string,
          "rest": string,
          "notes": "string"
        }
      ],
      "durationMinutes": number
    }
  ],
  "warmUp": "string",
  "coolDown": "string",
  "progressionTips": ["string"]
}

Only return the JSON object with no markdown formatting or extra text.`;

/**
 * Builds a request context for the workout-plan branch.
 *
 * @param userInput - Free-text description of the user's goal, fitness level, or preferences.
 * @returns A fully populated request context ready for the AI agent.
 */
export function buildWorkoutPlanRequest(
  userInput: string,
): AiRequestContext {
  return {
    ...buildKnowledgeContext(),
    requestType: 'workout-plan',
    userInput,
    metadata: {
      branch: 'workout-plan',
      purpose:
        "Generate a structured workout plan based on user's goal, fitness level, and preferences",
    },
  } as AiRequestContext;
}
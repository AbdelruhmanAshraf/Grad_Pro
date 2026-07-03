/**
 * Workout Assistant branch configuration for the Dietin AI agent.
 *
 * This module defines the system prompt and request builder used when the
 * agent is asked to answer workout-related questions (form, technique,
 * best exercises, equipment alternatives).
 */

import { buildKnowledgeContext } from "../../knowledge/base";
import type { AiRequestContext } from "../types";

/**
 * System prompt for the workout-assistant branch.
 *
 * Instructs the model to act as a knowledgeable fitness coach and answer
 * questions about exercise form, technique, muscle targeting, equipment
 * alternatives, and common mistakes.
 */
export const workoutAssistantSystemPrompt = `You are a knowledgeable fitness coach and workout assistant.

Answer the user's workout-related question with clear, actionable advice. Topics include:

- Exercise form and technique (how to perform an exercise correctly)
- Which muscles an exercise targets (primary and secondary)
- Alternative exercises for the same muscle group when equipment is unavailable
- Common mistakes and how to fix them
- How to progress or regress an exercise (harder / easier variations)
- Training tips (breathing, tempo, mind-muscle connection)

Return the answer as a concise JSON object with these fields:
{
  "question": "string",
  "answer": "string",
  "targetMuscles": ["string"],
  "difficulty": "beginner" | "intermediate" | "advanced",
  "tips": ["string"],
  "alternatives": [
    {
      "name": "string",
      "equipment": "string",
      "difficulty": "string"
    }
  ]
}

Only return the JSON object with no markdown formatting or extra text.`;

/**
 * Builds a request context for the workout-assistant branch.
 *
 * @param userInput - A free-text question about workouts, form, or technique.
 * @returns A fully populated request context ready for the AI agent.
 */
export function buildWorkoutAssistantRequest(
  userInput: string,
): AiRequestContext {
  return {
    ...buildKnowledgeContext(),
    requestType: 'workout-assistant',
    userInput,
    metadata: {
      branch: 'workout-assistant',
      purpose:
        "Answer a workout-related question about form, technique, exercises, or training",
    },
  } as AiRequestContext;
}
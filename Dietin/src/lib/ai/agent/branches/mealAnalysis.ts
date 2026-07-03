/**
 * Meal analysis branch configuration for the Dietin AI agent.
 *
 * This module defines the system prompt and request builder used when the
 * agent is asked to estimate the nutritional content of a food or drink
 * description or image. It contains no React or UI dependencies so it can
 * be used in any JavaScript runtime.
 */

import { buildKnowledgeContext } from "../../knowledge/base";
import type { AiRequestContext, AiRequestType } from "../types";

/**
 * System prompt for the meal-analysis branch.
 *
 * Instructs the model to analyze a food or drink description or image and
 * estimate its nutritional profile. The response must be a concise JSON
 * object with the requested fields. When input is unclear or ambiguous,
 * confidence should be set to "low" and an explanation placed in notes.
 */
export const mealAnalysisSystemPrompt = `You are a nutrition analysis assistant.

Analyze the provided food or drink. If an image is included, base your estimate primarily on what is visible in the image. If only a description is provided, estimate from the text.

Estimate the following values when possible:
- calories (kcal)
- protein (g)
- carbs (g)
- fats (g)
- fiber (g)

Return a concise JSON object with exactly these fields:
{
  "foodName": "string",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fats": number,
  "fiber": number | null,
  "confidence": "high" | "medium" | "low",
  "notes": "string"
}

If the input is unclear, ambiguous, or does not describe food or drink, set confidence to "low" and explain the issue in notes. Only return the JSON object, with no markdown formatting or extra text.`;

/**
 * Builds a request context for the meal-analysis branch.
 *
 * @param userInput - A free-text description of the food or drink to analyze.
 * @param imageBase64 - Optional base64-encoded image data for the meal.
 * @returns A fully populated request context ready for the AI agent.
 */
export function buildMealAnalysisRequest(
  userInput: string,
  imageBase64?: string,
): AiRequestContext {
  return {
    ...buildKnowledgeContext(),
    requestType: 'meal-analysis' as AiRequestType,
    userInput,
    imageBase64,
    metadata: {
      branch: 'meal-analysis',
      purpose:
        "Analyze a food/drink description or image and return nutrition breakdown",
    },
  } as AiRequestContext;
}

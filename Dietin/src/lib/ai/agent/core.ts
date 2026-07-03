/// <reference types="vite/client" />

/**
 * AI Agent core orchestrator.
 *
 * Coordinates guardrails, knowledge retrieval, RAG context assembly,
 * and LLM generation into a single `process` call. This module is free
 * of React and UI dependencies so it can run in any JavaScript runtime.
 */

import { detect } from "../guardrails/llm-prompt-guard/src/index";
import { isEdible } from "../guardrails/domain";
import { buildKnowledgeContext } from "../knowledge/base";
import type { AiRequestContext, AiRequestType } from "../knowledge/types";
import { buildRAGContext } from "../orchestration/rag";
import { generateText } from "../../gemini";
import { buildMealAnalysisRequest } from "./branches/mealAnalysis";

/** Optional runtime configuration for {@link AIAgentCore}. */
export interface AIAgentCoreConfig {
  /**
   * Whether input/output guardrails are active.
   * @default true
   */
  guardrailsEnabled?: boolean;

  /**
   * Maximum time to wait for an LLM response, in milliseconds.
   * @default 30000
   */
  timeoutMs?: number;
}

/** Result shape returned by {@link AIAgentCore.process}. */
export interface AIAgentProcessResult {
  ok: boolean;
  response?: string;
  error?: string;
  blocked?: boolean;
  blockReason?: string;
}

/** Optional image attachment discovered on a request. */
interface RequestImageAttachment {
  image?: { data: string; mimeType: string };
}

/**
 * Central coordinator for Dietin AI requests.
 *
 * The core wires together:
 *   1. General prompt-injection guardrails (input + output).
 *   2. Domain guardrails for meal-analysis requests.
 *   3. Knowledge context assembly from persisted stores.
 *   4. RAG-style system prompt construction.
 *   5. Timeout-wrapped LLM generation through the Gemini adapter.
 */
export class AIAgentCore {
  private readonly guardrailsEnabled: boolean;
  private readonly timeoutMs: number;

  constructor(config: AIAgentCoreConfig = {}) {
    this.guardrailsEnabled = config.guardrailsEnabled ?? true;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  /**
   * Convenience method for meal analysis. Routes directly through
   * the agent pipeline with the correct branch configuration.
   *
   * @param userInput - A free-text description of the food or drink.
   * @param imageBase64 - Optional base64-encoded image of the meal.
   * @returns A result object describing success, blocking, or error state.
   */
  async analyzeMeal(
    userInput: string,
    imageBase64?: string,
  ): Promise<AIAgentProcessResult> {
    return this.process(buildMealAnalysisRequest(userInput, imageBase64));
  }

  /**
   * Process a single AI request end-to-end.
   *
   * @param request - The request context including type and user input.
   * @returns A result object describing success, blocking, or error state.
   */
  async process(request: AiRequestContext): Promise<AIAgentProcessResult> {
    const userInput = request.userInput ?? "";

    if (this.guardrailsEnabled && detect(userInput)) {
      return {
        ok: false,
        blocked: true,
        blockReason: "Input failed guardrail check",
      };
    }

        const mealRequestTypes: readonly AiRequestType[] = ['meal_analysis', 'meal-analysis' as AiRequestType];
    if (mealRequestTypes.includes(request.requestType) && !isEdible(userInput).ok) {
      return {
        ok: false,
        blocked: true,
        blockReason: "Input does not appear to be food or drink",
      };
    }

    try {
      const knowledge = buildKnowledgeContext();
      const systemContext = buildRAGContext(knowledge, request);

      // Pass through an optional image attachment if the caller provided one.
      // The image is intentionally omitted from the text prompt; the Gemini
      // adapter handles it through its dedicated image parameter.
      const image = (request as unknown as RequestImageAttachment).image;

      const llmPromise = generateText({
        prompt: userInput,
        system: systemContext,
        image,
      });

      const responseText = await this.withTimeout(llmPromise);

      if (this.guardrailsEnabled && detect(responseText)) {
        return {
          ok: false,
          blocked: true,
          blockReason: "Output failed guardrail check",
        };
      }

      return { ok: true, response: responseText };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }

  /**
   * Race a promise against a configurable timeout.
   *
   * @param promise - The async work to constrain.
   * @returns The resolved value, or rejects on timeout.
   */
  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("LLM request timed out")),
          this.timeoutMs,
        );
      }),
    ]);
  }
}

// -----------------------------------------------------------------------------
// Kimi 2.5 LLM adapter (JWT-gated FastAPI proxy)
// -----------------------------------------------------------------------------
// The DigitalOcean `dop_v1_…` key must never live in the browser bundle. This
// module used to hold it via `VITE_DO_AGENT_KEY` and call `inference.do-ai.run`
// directly with `dangerouslyAllowBrowser: true`. That has been replaced by a
// server-side proxy in the FastAPI backend (see
// `Dietin/ai/exercise_recognition/inference/app/llm.py`).
//
// The exported surface (`genAI`, `analyzeNutrition`, `analyzeImage`,
// `analyzeFood`, `analyzeWorkout`, `analyzeUserProfile`, `generateJSON`,
// `generateText`, `GenInput`) is preserved so the ~10 call sites keep
// compiling — the internals now do:
//
//   fetch(`${VITE_AI_BACKEND_URL}/api/llm/chat`,
//         { headers: { Authorization: `Bearer ${idToken}` },
//           body: JSON.stringify({ prompt, mode, task, image_base64, image_mime }),
//           signal: AbortController(timeout=30s) })
//   → zod-parse response (belt-and-braces on top of server Pydantic bounds).
// -----------------------------------------------------------------------------

import type { UserProfile } from './types';
import { computeProfileAnalysis } from './calculations';
import { useUserStore } from '@/stores/userStore';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  nutritionResponseSchema,
  imageDescriptionResponseSchema,
  foodValidationResponseSchema,
  type NutritionResponse,
} from '@/lib/validation/schemas';
import { logSecurityEvent } from '@/lib/securityLog';

const LLM_TIMEOUT_MS = 30_000;
const BACKEND_URL = (import.meta.env.VITE_AI_BACKEND_URL || '').replace(/\/$/, '');

export class RateLimitError extends Error {
  constructor(message = 'Too many requests') {
    super(message);
    this.name = 'RateLimitError';
  }
}

type LLMTask =
  | 'nutrition'
  | 'food_validation'
  | 'image_food_validation'
  | 'image_description'
  | 'meal_suggestion'
  | 'hydration_tip'
  | 'name_validation'
  | 'weekly_report'
  | 'generic';

interface ChatBody {
  prompt: string;
  system?: string;
  mode: 'json' | 'text';
  task: LLMTask;
  image_base64?: string;
  image_mime?: 'image/jpeg' | 'image/png' | 'image/webp';
}

interface ChatEnvelope {
  mode: 'json' | 'text';
  text?: string | null;
  json?: unknown;
}

async function idToken(): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('Not signed in');
  return u.getIdToken(false);
}

async function chat(body: ChatBody): Promise<ChatEnvelope> {
  if (!BACKEND_URL) {
    throw new Error('AI backend URL not configured (VITE_AI_BACKEND_URL).');
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const token = await idToken();
    const res = await fetch(`${BACKEND_URL}/api/llm/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.status === 429) {
      void logSecurityEvent('rate_limit_hit', `llm/${body.task}`);
      throw new RateLimitError();
    }
    if (!res.ok) {
      void logSecurityEvent('ai_failure', `llm/${body.task} status=${res.status}`);
      throw new Error(`LLM proxy returned ${res.status}`);
    }
    return (await res.json()) as ChatEnvelope;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fileToBase64Stripped(file: File): Promise<string> {
  const buf = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const idx = buf.indexOf(',');
  return idx >= 0 ? buf.slice(idx + 1) : buf;
}

function pickImageMime(file: File): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (file.type === 'image/png') return 'image/png';
  if (file.type === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

// -----------------------------------------------------------------------------
// Backwards-compatible `genAI` shim — MealAnalysis.tsx uses this shape.
// -----------------------------------------------------------------------------
type GenAIInput =
  | string
  | {
      contents?: Array<{
        role?: string;
        parts?: Array<
          | { text: string }
          | { inlineData: { data: string; mimeType: string } }
        >;
      }>;
    };

export const genAI = {
  getGenerativeModel: ({ model: _model }: { model: string }) => ({
    generateContent: async (input: GenAIInput) => {
      let prompt = '';
      let base64: string | undefined;
      let mime: 'image/jpeg' | 'image/png' | 'image/webp' | undefined;

      if (typeof input === 'string') {
        prompt = input;
      } else {
        const content = input.contents?.[0];
        const parts = content?.parts ?? [];
        for (const part of parts) {
          if ('text' in part) prompt = part.text;
          if ('inlineData' in part) {
            base64 = part.inlineData.data;
            const m = part.inlineData.mimeType;
            mime = m === 'image/png' || m === 'image/webp' ? m : 'image/jpeg';
          }
        }
      }

      const env = await chat({
        prompt,
        mode: 'text',
        task: 'generic',
        image_base64: base64,
        image_mime: mime,
      });
      const responseText = env.text ?? '';
      return {
        response: {
          text: () => responseText,
        },
      };
    },
  }),
};

// -----------------------------------------------------------------------------
// Domain functions used across the app
// -----------------------------------------------------------------------------

interface AnalysisResult {
  goal: string;
  calories: number;
  metabolism: number;
  protein: number;
  carbs: number;
  fat: number;
  estimatedWeeks: number;
}

async function checkProStatus(): Promise<boolean> {
  if (!auth.currentUser) return false;
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (userDoc.exists()) return !!userDoc.data().isPro;
    return false;
  } catch {
    return false;
  }
}

const EMPTY_NUTRITION: NutritionResponse = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  healthScore: 0,
};

export async function analyzeNutrition(
  foodDescription: string,
): Promise<NutritionResponse> {
  const { dailyMealAnalysis, incrementMealAnalysis } = useUserStore.getState();
  const isPro = await checkProStatus();

  if (!isPro && dailyMealAnalysis >= 3) {
    window.dispatchEvent(
      new CustomEvent('showErrorToast', {
        detail: {
          message:
            'Daily meal analysis limit reached (3/3). Please subscribe to DietinPro for unlimited analysis or wait 24 hours.',
        },
      }),
    );
    throw new Error('Quota reached');
  }
  if (!isPro) incrementMealAnalysis();

  // Step 1 — food validation
  try {
    const validationEnv = await chat({
      prompt: foodDescription,
      mode: 'json',
      task: 'food_validation',
    });
    const validation = foodValidationResponseSchema.safeParse(validationEnv.json);
    if (validation.success && !validation.data.isFood) {
      const errorMessage = validation.data.reason || 'Please enter a valid halal food item';
      window.dispatchEvent(
        new CustomEvent('showErrorToast', {
          detail: {
            message: errorMessage.charAt(0).toUpperCase() + errorMessage.slice(1),
          },
        }),
      );
      return { ...EMPTY_NUTRITION, warning: errorMessage };
    }
  } catch (err) {
    // Validation failure is non-fatal — fall through to nutrition analysis.
    if (err instanceof RateLimitError) throw err;
  }

  // Step 2 — nutrition analysis
  try {
    const env = await chat({
      prompt: foodDescription,
      mode: 'json',
      task: 'nutrition',
    });
    const parsed = nutritionResponseSchema.safeParse(env.json);
    if (!parsed.success) {
      void logSecurityEvent('validation_error', `analyzeNutrition zod: ${parsed.error.message}`);
      return { ...EMPTY_NUTRITION, warning: 'Failed to analyze food' };
    }
    return {
      calories: Number(parsed.data.calories.toFixed(1)),
      protein: Number(parsed.data.protein.toFixed(1)),
      carbs: Number(parsed.data.carbs.toFixed(1)),
      fat: Number(parsed.data.fat.toFixed(1)),
      healthScore: Number(parsed.data.healthScore.toFixed(1)),
      warning: parsed.data.warning,
    };
  } catch (err) {
    if (err instanceof RateLimitError) throw err;
    return { ...EMPTY_NUTRITION, warning: 'Failed to analyze food' };
  }
}

export async function analyzeUserProfile(profile: UserProfile): Promise<AnalysisResult> {
  const result = computeProfileAnalysis(profile);
  return {
    goal: result.goal,
    calories: result.calories,
    metabolism: result.metabolism,
    protein: result.protein,
    carbs: result.carbs,
    fat: result.fat,
    estimatedWeeks: result.estimatedWeeks,
  };
}

export async function analyzeImage(file: File): Promise<{ description: string }> {
  const { dailyImageAnalysis, incrementImageAnalysis } = useUserStore.getState();
  const isPro = await checkProStatus();

  if (!isPro && dailyImageAnalysis >= 1) {
    window.dispatchEvent(
      new CustomEvent('showErrorToast', {
        detail: {
          message:
            'Daily image analysis limit reached (1/1). Please subscribe to DietinPro for unlimited analysis or wait 24 hours.',
        },
      }),
    );
    throw new Error('Quota reached');
  }
  if (!isPro) incrementImageAnalysis();

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image too large (5 MB max)');
  }
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (file.type && !allowed.includes(file.type)) {
    throw new Error('Unsupported image type. Use JPEG, PNG, or WebP.');
  }

  const base64 = await fileToBase64Stripped(file);
  const mime = pickImageMime(file);

  // Step 1 — food validation
  try {
    const validationEnv = await chat({
      prompt: 'Is this image a food/meal image? Answer with a JSON object.',
      mode: 'json',
      task: 'image_food_validation',
      image_base64: base64,
      image_mime: mime,
    });
    const validation = foodValidationResponseSchema.safeParse(validationEnv.json);
    if (validation.success && !validation.data.isFood) {
      throw new Error('Please upload an image of food.');
    }
  } catch (err) {
    if (err instanceof RateLimitError) throw err;
    if (err instanceof Error && err.message.startsWith('Please upload')) throw err;
    // else: validation network failure — proceed to description
  }

  // Step 2 — description
  const env = await chat({
    prompt: 'describe the food in this image concisely',
    mode: 'text',
    task: 'image_description',
    image_base64: base64,
    image_mime: mime,
  });
  const parsed = imageDescriptionResponseSchema.safeParse({
    description: (env.text ?? '')
      .trim()
      .replace(/^(The image shows|I see|This is|In this image)/i, '')
      .trim(),
  });
  if (!parsed.success) {
    void logSecurityEvent('validation_error', `analyzeImage zod: ${parsed.error.message}`);
    throw new Error('Image analysis failed');
  }
  return { description: parsed.data.description };
}

export async function analyzeFood(description: string): Promise<{
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  healthScore: number;
} | null> {
  try {
    const env = await chat({
      prompt: description,
      mode: 'json',
      task: 'nutrition',
    });
    const parsed = nutritionResponseSchema.safeParse(env.json);
    if (!parsed.success) return null;
    return {
      calories: parsed.data.calories,
      protein: parsed.data.protein,
      carbs: parsed.data.carbs,
      fat: parsed.data.fat,
      healthScore: Math.round(parsed.data.healthScore),
    };
  } catch {
    return null;
  }
}

export async function analyzeWorkout(_workoutDescription: string): Promise<unknown> {
  const store = (useUserStore as unknown as { getState?: () => Record<string, unknown> }).getState?.() ?? {};
  const daily = typeof store.dailyWorkoutAnalysis === 'number' ? (store.dailyWorkoutAnalysis as number) : 0;
  const increment = typeof store.incrementWorkoutAnalysis === 'function'
    ? (store.incrementWorkoutAnalysis as () => void)
    : undefined;

  if (daily >= 5) {
    window.dispatchEvent(
      new CustomEvent('showErrorToast', {
        detail: {
          message:
            'Daily workout analysis limit reached. Please subscribe to DietinPro for unlimited analysis or wait 24 hours.',
        },
      }),
    );
    throw new Error('Quota reached');
  }
  increment?.();
  return null;
}

export interface GenInput {
  prompt: string;
  system?: string;
  model?: string;
  image?: { data: string; mimeType: string };
}

function coerceMime(m: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (m === 'image/png' || m === 'image/webp') return m;
  return 'image/jpeg';
}

export async function generateJSON<T = unknown>({
  prompt,
  system,
  image,
}: GenInput): Promise<T> {
  const env = await chat({
    prompt,
    system,
    mode: 'json',
    task: 'generic',
    image_base64: image?.data,
    image_mime: image ? coerceMime(image.mimeType) : undefined,
  });
  return env.json as T;
}

export async function generateText({
  prompt,
  system,
  image,
}: GenInput): Promise<string> {
  const env = await chat({
    prompt,
    system,
    mode: 'text',
    task: 'generic',
    image_base64: image?.data,
    image_mime: image ? coerceMime(image.mimeType) : undefined,
  });
  return env.text ?? '';
}

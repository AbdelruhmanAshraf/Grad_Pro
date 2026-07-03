import { z } from 'zod';

// ---------------------------------------------------------------------------
// Body metric primitives — used across profile, onboarding, hydration, etc.
// Bounds match the FastAPI Pydantic schemas so the server rejects the same
// values as the client, ensuring one source of truth for numeric limits.
// ---------------------------------------------------------------------------
export const weightKg = z
  .number()
  .finite()
  .min(1, { message: 'Weight must be at least 1 kg' })
  .max(500, { message: 'Weight must be at most 500 kg' });

export const heightCm = z
  .number()
  .finite()
  .min(50, { message: 'Height must be at least 50 cm' })
  .max(300, { message: 'Height must be at most 300 cm' });

export const ageYears = z
  .number()
  .int()
  .min(5, { message: 'Age must be at least 5' })
  .max(120, { message: 'Age must be at most 120' });

export const gender = z.enum(['MALE', 'FEMALE']);

export const activityLevel = z.enum([
  'LIGHTLY_ACTIVE',
  'MODERATELY_ACTIVE',
  'VERY_ACTIVE',
  'EXTRA_ACTIVE',
]);

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(60),
  age: ageYears,
  gender,
  height: heightCm,
  weight: weightKg,
  activityLevel,
});

// ---------------------------------------------------------------------------
// Meals — calories, macros, water
// ---------------------------------------------------------------------------
export const kcal = z
  .number()
  .finite()
  .min(0, { message: 'Calories cannot be negative' })
  .max(10000, { message: 'Calories must be under 10000' });

export const grams = z
  .number()
  .finite()
  .min(0)
  .max(2000);

export const waterMl = z
  .number()
  .finite()
  .min(0)
  .max(10000);

export const foodText = z.string().trim().min(1).max(500);

export const addMealSchema = z.object({
  name: z.string().trim().min(1).max(120),
  calories: kcal,
  protein: grams,
  carbs: grams,
  fat: grams,
});

export const hydrationSchema = z.object({
  amountMl: waterMl.refine((v) => v > 0, { message: 'Amount must be greater than 0' }),
});

// ---------------------------------------------------------------------------
// Workout start — mirrors FastAPI SessionStartRequest
// ---------------------------------------------------------------------------
export const workoutStartSchema = z.object({
  exercise: z.string().min(1).max(60).optional(),
  sets: z.number().int().min(1).max(50),
  target_reps: z.number().int().min(1).max(200),
  rest_timer: z.number().int().min(0).max(3600),
});

// ---------------------------------------------------------------------------
// AI response schemas — never trust the model. Bounds are the same as the
// FastAPI Pydantic *Out models (app/llm.py -> app/schemas.py).
// ---------------------------------------------------------------------------
export const nutritionResponseSchema = z.object({
  calories: z.number().finite().min(0).max(5000),
  protein: z.number().finite().min(0).max(500),
  carbs: z.number().finite().min(0).max(1000),
  fat: z.number().finite().min(0).max(500),
  healthScore: z.number().finite().min(0).max(100),
  warning: z.string().max(300).optional(),
});
export type NutritionResponse = z.infer<typeof nutritionResponseSchema>;

export const foodValidationResponseSchema = z.object({
  isFood: z.boolean(),
  reason: z.string().max(200).optional(),
});
export type FoodValidationResponse = z.infer<typeof foodValidationResponseSchema>;

export const imageDescriptionResponseSchema = z.object({
  description: z.string().trim().min(1).max(2000),
});
export type ImageDescriptionResponse = z.infer<typeof imageDescriptionResponseSchema>;

// ---------------------------------------------------------------------------
// Legacy compat: bounded numeric getters used by places that don't own a
// full react-hook-form. Returns a clamped number, throws on non-finite.
// ---------------------------------------------------------------------------
export function boundedNumber(
  value: unknown,
  min: number,
  max: number,
  fallback = 0,
): number {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

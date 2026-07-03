/**
 * Domain guardrails for food and drink inputs.
 *
 * Provides lightweight validation to ensure user input describes something
 * edible or drinkable before it is processed by AI features.
 */

/** Maximum allowed input length in characters. */
const MAX_INPUT_LENGTH = 4000;

/** Common non-edible keywords used to reject off-topic inputs. */
const NON_EDIBLE_KEYWORDS = [
  "car",
  "truck",
  "bus",
  "airplane",
  "boat",
  "train",
  "computer",
  "phone",
  "laptop",
  "television",
  "tv",
  "furniture",
  "chair",
  "table",
  "sofa",
  "bed",
  "desk",
  "shoe",
  "shirt",
  "pants",
  "dress",
  "jacket",
  "hat",
  "wallet",
  "bag",
  "backpack",
  "book",
  "paper",
  "pen",
  "pencil",
  "scissors",
  "knife",
  "fork",
  "spoon",
  "plate",
  "cup",
  "glass",
  "bottle",
  "napkin",
  "towel",
  "soap",
  "shampoo",
  "toothpaste",
  "lotion",
  "medicine",
  "pill",
  "vitamin",
  "supplement",
  "chemical",
  "detergent",
  "bleach",
  "gasoline",
  "oil",
  "paint",
  "plastic",
  "metal",
  "wood",
  "stone",
  "rock",
  "dirt",
  "sand",
  "glass",
  "cement",
  "brick",
  "wire",
  "battery",
  "cable",
  "charger",
  "keyboard",
  "mouse",
  "monitor",
  "screen",
  "camera",
  "watch",
  "jewelry",
  "ring",
  "necklace",
  "bracelet",
  "money",
  "coin",
  "cash",
  "card",
  "document",
  "ticket",
  "key",
  "lock",
  "door",
  "window",
  "wall",
  "floor",
  "roof",
  "building",
  "house",
  "apartment",
  "room",
  "toilet",
  "sink",
  "shower",
  "bathtub",
];

/** Result shape returned by {@link isEdible}. */
export interface EdibleCheckResult {
  ok: boolean;
  reason?: string;
  category?: "non_edible" | "empty" | "too_long" | "other";
}

/**
 * Trims whitespace and clamps the input to {@link MAX_INPUT_LENGTH}.
 *
 * @param input - Raw user input.
 * @returns Cleaned input string.
 */
export function sanitizeInput(input: string): string {
  return input.trim().slice(0, MAX_INPUT_LENGTH);
}

/**
 * Checks whether the provided input describes a food or drink item.
 *
 * Rejects empty/whitespace-only input, inputs longer than 4000 characters,
 * and strings that contain common non-edible keywords.
 *
 * @param input - Raw user input to validate.
 * @returns An {@link EdibleCheckResult} indicating acceptance or rejection.
 */
export function isEdible(input: string): EdibleCheckResult {
  if (typeof input !== "string") {
    return {
      ok: false,
      reason: "Input must be a string.",
      category: "other",
    };
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return {
      ok: false,
      reason: "Input is empty.",
      category: "empty",
    };
  }

  if (trimmed.length > MAX_INPUT_LENGTH) {
    return {
      ok: false,
      reason: `Input exceeds the maximum length of ${MAX_INPUT_LENGTH} characters.`,
      category: "too_long",
    };
  }

  const lowercased = trimmed.toLowerCase();
  const hasNonEdibleKeyword = NON_EDIBLE_KEYWORDS.some((keyword) =>
    lowercased.includes(keyword)
  );

  if (hasNonEdibleKeyword) {
    return {
      ok: false,
      reason: "Input appears to describe a non-edible item.",
      category: "non_edible",
    };
  }

  return { ok: true };
}

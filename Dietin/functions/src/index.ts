import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

admin.initializeApp();
const db = admin.firestore();

// All secrets come from process.env (loaded via functions/.env locally,
// or `firebase functions:secrets:set` in production). NEVER hardcode.
const cfg = functions.config();
const PAYMOB = {
  API_KEY: process.env.PAYMOB_API_KEY || (cfg.paymob?.api_key as string),
  HMAC_SECRET: process.env.PAYMOB_HMAC_SECRET || (cfg.paymob?.hmac_secret as string),
  INTEGRATION_ID: process.env.PAYMOB_INTEGRATION_ID || (cfg.paymob?.integration_id as string),
  IFRAME_ID:
    process.env.PAYMOB_IFRAME_ID ||
    (cfg.paymob?.iframe_id as string) ||
    (cfg.paymob?.merchant_id as string),
};
const APP = {
  RETURN_URL: process.env.APP_RETURN_URL || (cfg.app?.return_url as string),
  DOMAIN: process.env.APP_DOMAIN || (cfg.app?.domain as string),
};
const PERIOD = {
  MONTH_DAYS: Number(process.env.SUBS_MONTH_DAYS || cfg.subs?.month_days || 30),
  YEAR_DAYS: Number(process.env.SUBS_YEAR_DAYS || cfg.subs?.year_days || 365),
};

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function computeExpiry(plan: "monthly" | "annual"): Date {
  const now = new Date();
  return plan === "annual" ? addDays(now, PERIOD.YEAR_DAYS) : addDays(now, PERIOD.MONTH_DAYS);
}

// Create Paymob payment link/session
export const subscriptions_start = functions.region("us-central1").https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }
  const uid = context.auth.uid;
  const plan = (data?.plan as string) === "annual" ? "annual" : "monthly";

  if (!PAYMOB.API_KEY || !PAYMOB.INTEGRATION_ID) {
    throw new functions.https.HttpsError("failed-precondition", "Paymob not configured");
  }

  // 1) Authenticate to Paymob (get auth token)
  const authRes = await axios.post("https://accept.paymob.com/api/auth/tokens", {
    api_key: PAYMOB.API_KEY,
  });
  const token = authRes.data?.token;
  if (!token) throw new functions.https.HttpsError("internal", "Paymob auth failed");

  // 2) Create order
  const amountCents = plan === "annual" ? 4999_00 : 499_00; // example prices, replace with yours
  const orderRes = await axios.post("https://accept.paymob.com/api/ecommerce/orders", {
    auth_token: token,
    delivery_needed: false,
    amount_cents: amountCents,
    currency: "EGP",
    merchant_order_id: `${uid}-${Date.now()}`,
    items: [],
  });
  const orderId = orderRes.data?.id;
  if (!orderId) throw new functions.https.HttpsError("internal", "Order creation failed");

  // 3) Payment key
  const paymentKeyRes = await axios.post("https://accept.paymob.com/api/acceptance/payment_keys", {
    auth_token: token,
    amount_cents: amountCents,
    expiration: 3600,
    order_id: orderId,
    billing_data: {
      apartment: "NA",
      email: context.auth.token?.email || "user@example.com",
      floor: "NA",
      first_name: context.auth.token?.name || "Dietin",
      street: "NA",
      building: "NA",
      phone_number: "NA",
      shipping_method: "NA",
      postal_code: "NA",
      city: "NA",
      country: "EG",
      last_name: "User",
      state: "NA",
    },
    currency: "EGP",
    integration_id: Number(PAYMOB.INTEGRATION_ID),
    lock_order_when_paid: true,
  });
  const paymentKey = paymentKeyRes.data?.token;
  if (!paymentKey) throw new functions.https.HttpsError("internal", "Payment key failed");

  // 4) iFrame/URL (hosted payment page)
  if (!PAYMOB.IFRAME_ID) {
    throw new functions.https.HttpsError("failed-precondition", "Paymob iFrame ID not configured");
  }
  const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB.IFRAME_ID}?payment_token=${paymentKey}`;
  console.log('Paymob iframe URL:', iframeUrl);

  // store a pending record
  await db.collection("subscriptions").add({
    uid,
    plan,
    status: "pending",
    provider: "paymob",
    providerOrderId: orderId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { url: iframeUrl };
});

// Webhook: verify HMAC and set entitlement
export const webhooks_paymob = functions.region("us-central1").https.onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // Per Paymob docs, compute HMAC over specific fields
    const providedHmac = (req.query?.hmac as string) || (req.headers["hmac"] as string) || "";
    if (!providedHmac || !PAYMOB.HMAC_SECRET) {
      res.status(400).send("Missing HMAC");
      return;
    }

    // Build the concatenated string in the correct field order as per Paymob docs
    const obj = req.body?.obj || {};
    const dataStr = [
      obj?.amount_cents,
      obj?.created_at,
      obj?.currency,
      obj?.error_occured,
      obj?.has_parent_transaction,
      obj?.id,
      obj?.integration_id,
      obj?.is_3d_secure,
      obj?.is_auth,
      obj?.is_capture,
      obj?.is_refunded,
      obj?.is_standalone_payment,
      obj?.is_voided,
      obj?.order?.id,
      obj?.owner,
      obj?.pending,
      obj?.source_data?.pan,
      obj?.source_data?.sub_type,
      obj?.source_data?.type,
      obj?.success,
    ].join("");

    const crypto = await import("node:crypto");
    const calc = crypto.createHmac("sha512", PAYMOB.HMAC_SECRET).update(dataStr).digest("hex");
    // Timing-safe compare — string `!==` on a hex digest is a classic side-channel.
    const providedBuf = Buffer.from(providedHmac, "utf8");
    const calcBuf = Buffer.from(calc, "utf8");
    if (
      providedBuf.length !== calcBuf.length ||
      !crypto.timingSafeEqual(providedBuf, calcBuf)
    ) {
      console.warn("[paymob] hmac mismatch", {
        first8: providedHmac.slice(0, 8),
        order_id: obj?.order?.id,
      });
      res.status(403).send("Invalid HMAC");
      return;
    }

    const success = Boolean(obj?.success);
    const orderId = obj?.order?.id;
    const transactionId = obj?.id;
    const amountCents = Number(obj?.amount_cents ?? 0);

    // Idempotency — dedupe on Paymob transaction id. If we've seen this
    // event before, no-op. Guards against Paymob retrying the webhook and
    // us granting Pro / extending expiry twice for one payment.
    if (transactionId) {
      const eventRef = db.collection("paymob_events").doc(String(transactionId));
      const alreadyProcessed = await db.runTransaction(async (t) => {
        const snap = await t.get(eventRef);
        if (snap.exists) return true;
        t.set(eventRef, {
          orderId,
          amountCents,
          success,
          receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return false;
      });
      if (alreadyProcessed) {
        res.status(200).send("Duplicate — already processed");
        return;
      }
    }

    // Find pending subscription by providerOrderId
    const snap = await db.collection("subscriptions").where("providerOrderId", "==", orderId).limit(1).get();
    if (snap.empty) {
      res.status(200).send("No pending subscription");
      return;
    }
    const docRef = snap.docs[0].ref;
    const sub = snap.docs[0].data() as any;

    if (!success) {
      await docRef.update({ status: "failed", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      res.status(200).send("Marked failed");
      return;
    }

    // Amount check — reject if the charged amount does not match the plan.
    const expectedCents = sub.plan === "annual" ? 4999_00 : 499_00;
    if (amountCents !== expectedCents) {
      console.warn("[paymob] amount mismatch", { orderId, expected: expectedCents, got: amountCents, plan: sub.plan });
      await docRef.update({ status: "failed", failureReason: "amount_mismatch", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      res.status(400).send("Amount mismatch");
      return;
    }

    // Activate: compute expiry with server time
    const expiresAt = computeExpiry(sub.plan);
    await docRef.update({
      status: "active",
      activatedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    });

    // Materialize entitlement on users/{uid}
    await db.collection("users").doc(sub.uid).set({
      isPro: true,
      proExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      plan: sub.plan,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.status(200).send("OK");
  } catch (e) {
    console.error(e);
    res.status(500).send("Server error");
  }
});

// --------------------------------------------------------------------------- //
// Account deletion — GDPR-style "delete my account" flow.
// Callable so it uses the Firebase JWT the client already holds.
// Deletes:
//   1. Storage prefixes users/{uid}/, mealImages/{uid}/, progressPhotos/{uid}/,
//      profilePictures/{uid}/
//   2. Firestore users/{uid} and all subcollections (recursive delete)
//   3. Firestore subscription rows owned by the user
//   4. The Firebase Auth user (revokes all sessions)
// Returns { deleted: true } on success. Any partial failure is logged; the
// caller receives the first hard error so the UI can surface it.
// --------------------------------------------------------------------------- //
async function _deleteStoragePrefix(prefix: string): Promise<void> {
  try {
    const bucket = admin.storage().bucket();
    await bucket.deleteFiles({ prefix, force: true });
  } catch (err) {
    console.warn(`[delete_my_account] storage prefix ${prefix} failed:`, err);
  }
}

async function _deleteUserSubcollections(uid: string): Promise<void> {
  const userRef = db.collection("users").doc(uid);
  const subcolls = await userRef.listCollections();
  for (const subcoll of subcolls) {
    // Batched delete — Firestore allows 500 writes per batch.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const snap = await subcoll.limit(400).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
}

async function _deleteSubscriptionsFor(uid: string): Promise<void> {
  const snap = await db.collection("subscriptions").where("uid", "==", uid).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export const delete_my_account = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;

    // Storage first — even on partial failure the user's PII shrinks.
    await Promise.all([
      _deleteStoragePrefix(`users/${uid}/`),
      _deleteStoragePrefix(`mealImages/${uid}/`),
      _deleteStoragePrefix(`progressPhotos/${uid}/`),
      _deleteStoragePrefix(`profilePictures/${uid}/`),
    ]);

    // Firestore subcollections then the user doc.
    try {
      await _deleteUserSubcollections(uid);
      await db.collection("users").doc(uid).delete();
    } catch (err) {
      console.error("[delete_my_account] firestore delete failed:", err);
      throw new functions.https.HttpsError("internal", "Firestore delete failed");
    }

    // Subscription rows.
    try {
      await _deleteSubscriptionsFor(uid);
    } catch (err) {
      console.warn("[delete_my_account] subscription cleanup failed:", err);
    }

    // Finally the Auth user — revokes all sessions.
    try {
      await admin.auth().deleteUser(uid);
    } catch (err) {
      console.error("[delete_my_account] auth delete failed:", err);
      throw new functions.https.HttpsError("internal", "Auth delete failed");
    }

    console.log(`[delete_my_account] uid=${uid.slice(0, 6)}… fully deleted`);
    return { deleted: true };
  });

// Entitlement: server-evaluated
export const get_entitlement = functions.region("us-central1").https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }
  const uid = context.auth.uid;
  const userDoc = await db.collection("users").doc(uid).get();
  const u = userDoc.data() || {} as any;
  const now = admin.firestore.Timestamp.now();
  const isPro = Boolean(u.isPro) && u.proExpiresAt && u.proExpiresAt.toMillis() > now.toMillis();
  return {
    isPro,
    proExpiresAt: u.proExpiresAt || null,
    plan: u.plan || null,
  };
});

// --- GEMINI SECURITY FIX ---

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-pro";
if (!GEMINI_API_KEY) {
  console.warn("[functions] GEMINI_API_KEY missing — AI endpoints will return failed-precondition.");
}
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

function requireGemini() {
  if (!genAI) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "AI not configured: GEMINI_API_KEY missing on server."
    );
  }
  return genAI;
}

const MEAL_LIMIT = 3;
const IMAGE_LIMIT = 1;
const WORKOUT_LIMIT = 5;
const HYDRATION_LIMIT = 5;
const TEXT_GEN_LIMIT = 10;

// Sanitize Gemini text output before returning to client.
// Strips control chars, normalizes whitespace, caps length.
function sanitizeText(text: string, maxChars = 8000): string {
  if (!text) return "";
  return text
    .replace(/[ --]/g, "")
    .trim()
    .slice(0, maxChars);
}

// Strip prompt-injection escape attempts from user input before forwarding to Gemini.
// This is best-effort; the proxy endpoints also use strict system prompts + JSON-only output.
function sanitizePromptInput(input: string, maxLen = 2000): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[ -]/g, " ")
    .replace(/```/g, " ")
    .replace(/\b(system|assistant|developer)\s*:/gi, " ")
    .trim()
    .slice(0, maxLen);
}

type QuotaType = "meal" | "image" | "workout" | "hydration" | "textgen";

const QUOTA_LIMITS: Record<QuotaType, number> = {
  meal: MEAL_LIMIT,
  image: IMAGE_LIMIT,
  workout: WORKOUT_LIMIT,
  hydration: HYDRATION_LIMIT,
  textgen: TEXT_GEN_LIMIT,
};

const QUOTA_PREFIX: Record<QuotaType, string> = {
  meal: "dailyMeal",
  image: "dailyImage",
  workout: "dailyWorkout",
  hydration: "dailyHydration",
  textgen: "dailyTextGen",
};

async function checkQuota(uid: string, type: QuotaType) {
  const userRef = db.collection("users").doc(uid);
  return db.runTransaction(async (t) => {
    const doc = await t.get(userRef);
    const data = doc.data() || {};

    const now = admin.firestore.Timestamp.now();
    const isPro = Boolean(data.isPro) && data.proExpiresAt && data.proExpiresAt.toMillis() > now.toMillis();

    if (isPro) return;

    const today = new Date().toISOString().split("T")[0];
    const prefix = QUOTA_PREFIX[type];
    const dateField = `${prefix}AnalysisDate`;
    const countField = `${prefix}AnalysisCount`;

    const lastDate = data[dateField];
    let count = data[countField] || 0;

    if (lastDate !== today) {
      count = 0;
    }

    const limit = QUOTA_LIMITS[type];
    if (count >= limit) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Daily ${type} analysis limit reached. Upgrade to Pro.`
      );
    }

    t.set(userRef, {
      [dateField]: today,
      [countField]: count + 1,
    }, { merge: true });
  });
}

export const analyze_food = functions.region("us-central1").https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const rawDescription = typeof data?.description === "string" ? data.description : "";
  if (!rawDescription) throw new functions.https.HttpsError("invalid-argument", "Description required");
  if (rawDescription.length > 2000) {
    throw new functions.https.HttpsError("invalid-argument", "Description too long (max 2000 chars).");
  }
  const description = sanitizePromptInput(rawDescription, 2000);

  await checkQuota(context.auth.uid, "meal");

  try {
    const model = requireGemini().getGenerativeModel({ model: GEMINI_MODEL });

    const validationPrompt = `Please validate if this user input is a food/drink/human consumable item.'
Analyze this input: "${description}"

Rules:
1. Accept ANY language (English, Franco-Arabic like "ma7shi/ta3miya", Arabic, French, Chinese, etc.)
2. Ignore ALL spelling mistakes completely
3. Accept common food nicknames and slang
4. Accept numeric character substitutions (like 7 for ح, 3 for ع, etc.)
5. Accept any measurement units (kg, g, lbs, pieces, etc.)
6. Accept both formal and informal food descriptions
7. REJECT if portions are unrealistic (e.g. "1000kg rice", "50kg meat", anything over 10kg)
8. REJECT haram, illegal foods like:
   - Pork
   - Alcohol
   -etc. 
9. ACCEPT all regular soft drinks and beverages (like Pepsi, Coca-Cola, etc.) as they are halal
10. REJECT if the description contains non-food items
11. REJECT if the description is nonsensical or inappropriate

Is this describing consumable food/drink with realistic portions?
Answer ONLY with "yes" or "no" followed by "|" and the reason if "no".`;

    const valResult = await model.generateContent(validationPrompt);
    const valText = (await valResult.response).text().toLowerCase();

    if (!valText.includes("yes")) {
      const reason = valText.split("|")[1] || "Invalid food item";
      // Throw formatted error so client can show toast
      return { error: reason, isError: true };
    }

    const prompt = `Please analyze the nutrition facts of this food/meal:
    Calories, Protein, Carbs, Fat, Health Score (Health score based on healthiness of the food preciesly between 0 and 100)
The Meal description is: "${description}"
Return ONLY a JSON object in this exact format (no explanation, no other text):
{
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "healthScore": number
}`;

    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      throw new Error("Failed to parse JSON");
    }

    return {
      calories: Number(parsed.calories) || 0,
      protein: Number(parsed.protein) || 0,
      carbs: Number(parsed.carbs) || 0,
      fat: Number(parsed.fat) || 0,
      healthScore: Number(parsed.healthScore) || 0
    };

  } catch (e) {
    console.error("AI Error:", e);
    throw new functions.https.HttpsError("internal", "AI analysis failed");
  }
});

export const analyze_image_food = functions.region("us-central1").https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const { imageBase64, mimeType } = data || {};
  if (!imageBase64 || typeof imageBase64 !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Image required");
  }
  // base64 size cap: ~4 MB raw image (4_000_000 bytes -> ~5_400_000 chars in base64)
  if (imageBase64.length > 6_000_000) {
    throw new functions.https.HttpsError("invalid-argument", "Image too large (max ~4MB).");
  }
  const allowedMime = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  const mt = typeof mimeType === "string" && allowedMime.includes(mimeType) ? mimeType : "image/jpeg";

  await checkQuota(context.auth.uid, "image");

  try {
    const model = requireGemini().getGenerativeModel({ model: GEMINI_MODEL });

    // Basic validation helper
    const isFoodResult = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { text: 'Is this an image of food or a meal? Answer only with "yes" or "no".' },
          { inlineData: { data: imageBase64, mimeType: mt } }
        ]
      }]
    });
    if (!(await isFoodResult.response).text().toLowerCase().includes("yes")) {
      return { error: "Not a food image", isError: true };
    }

    const analysisPrompt = `Describe the food/drink in this image with precise details.ONLY IF IT IS CONSUMABLE ITEM Include:
1. Each distinct item/component
BE SUPER FUCKING DETAILED AND SPECIFIC AS POSSIBLE AND DONT INCLUDE USELESS WORDS OR EXPRESSIONS LIKE 'THE PLATE SHOWS' ONLHY THE CONMTENT AS BULLETS
2. Exact or estimated portion sizes (in oz, grams, or standard measures)
3. Preparation methods (if visible)
4. Any visible sauces, seasonings, or toppings
5. Arrangement on the plate
6. Don't include any italics, bolds, commas, fullstops, or any other formatting keep it simple and clear in lines include all the details.
7. DONT INCLUDE ANYTHING ELSE LIKE THE 'THE PLATE CONTINAINS' NO ONLY THE INGREDEIENTS AS BULLETS NO EXTRA WORDS OR PHRASES BRIEF ANSER IN YOUR ANSWER LIEK DONT INCLUDE TITLE LIKE ' OH I GOT IT' THEN THE ANSWER NO ONLY THE ANSWER
Format as a clear, detailed description focused ONLY on the food content.`;

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { text: analysisPrompt },
          { inlineData: { data: imageBase64, mimeType: mt } }
        ]
      }]
    });

    const description = sanitizeText(
      (await result.response).text()
        .trim()
        .replace(/^(The image shows|I see|This is|In this image)/i, '')
        .trim(),
      4000,
    );

    return { description };

  } catch (e) {
    console.error("AI Image Error:", e);
    throw new functions.https.HttpsError("internal", "Image analysis failed");
  }
});

// =========================================================================
// Generic Gemini Proxy
// -------------------------------------------------------------------------
// `gemini_generate`      -> returns sanitized plain text from a text prompt
// `gemini_generate_json` -> returns Gemini output strictly parsed as JSON
// Both require Firebase ID-token auth (context.auth) and enforce daily
// per-user quota under feature key "textgen".  Inputs are length-capped
// and stripped of common prompt-injection escapes; outputs are sanitized
// and length-capped before being returned to the client.
// =========================================================================

const PROMPT_MAX = 8000;
const SYSTEM_MAX = 4000;
const OUTPUT_MAX = 8000;

const ALLOWED_MODELS = new Set(["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.5-flash-8b"]);

function safeModelId(m: unknown): string {
  if (typeof m === "string" && ALLOWED_MODELS.has(m)) return m;
  return GEMINI_MODEL;
}

export const gemini_generate = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 60, memory: "256MB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Login required");
    }
    const rawPrompt = typeof data?.prompt === "string" ? data.prompt : "";
    const rawSystem = typeof data?.system === "string" ? data.system : "";
    const image = data?.image;
    if (!rawPrompt) {
      throw new functions.https.HttpsError("invalid-argument", "prompt required");
    }
    if (rawPrompt.length > PROMPT_MAX || rawSystem.length > SYSTEM_MAX) {
      throw new functions.https.HttpsError("invalid-argument", "Input too long.");
    }

    const prompt = sanitizePromptInput(rawPrompt, PROMPT_MAX);
    const system = rawSystem ? sanitizePromptInput(rawSystem, SYSTEM_MAX) : "";
    const modelId = safeModelId(data?.model);
    const imagePart = validateImagePart(image);

    await checkQuota(context.auth.uid, imagePart ? "image" : "textgen");

    try {
      const model = requireGemini().getGenerativeModel({
        model: modelId,
        systemInstruction: system || undefined,
      });
      const parts: any[] = [{ text: prompt }];
      if (imagePart) parts.push({ inlineData: imagePart });
      const result = await model.generateContent({ contents: [{ role: "user", parts }] });
      const text = sanitizeText((await result.response).text(), OUTPUT_MAX);
      return { text };
    } catch (e) {
      console.error("gemini_generate error", e);
      throw new functions.https.HttpsError("internal", "AI generation failed");
    }
  });

export const gemini_generate_json = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 60, memory: "256MB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Login required");
    }
    const rawPrompt = typeof data?.prompt === "string" ? data.prompt : "";
    const rawSystem = typeof data?.system === "string" ? data.system : "";
    const image = data?.image;
    if (!rawPrompt) {
      throw new functions.https.HttpsError("invalid-argument", "prompt required");
    }
    if (rawPrompt.length > PROMPT_MAX || rawSystem.length > SYSTEM_MAX) {
      throw new functions.https.HttpsError("invalid-argument", "Input too long.");
    }

    const prompt = sanitizePromptInput(rawPrompt, PROMPT_MAX);
    const system = rawSystem ? sanitizePromptInput(rawSystem, SYSTEM_MAX) : "";
    const modelId = safeModelId(data?.model);
    const imagePart = validateImagePart(image);

    await checkQuota(context.auth.uid, imagePart ? "image" : "textgen");

    try {
      const model = requireGemini().getGenerativeModel({
        model: modelId,
        systemInstruction: system || undefined,
        generationConfig: { responseMimeType: "application/json" },
      });
      const parts: any[] = [{ text: prompt }];
      if (imagePart) parts.push({ inlineData: imagePart });
      const result = await model.generateContent({ contents: [{ role: "user", parts }] });
      const raw = sanitizeText((await result.response).text(), OUTPUT_MAX);
      const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        throw new functions.https.HttpsError("internal", "AI returned invalid JSON.");
      }
      return { json: parsed };
    } catch (e) {
      if (e instanceof functions.https.HttpsError) throw e;
      console.error("gemini_generate_json error", e);
      throw new functions.https.HttpsError("internal", "AI generation failed");
    }
  });

function validateImagePart(image: unknown): { data: string; mimeType: string } | null {
  if (!image || typeof image !== "object") return null;
  const obj = image as { data?: unknown; mimeType?: unknown };
  const data = typeof obj.data === "string" ? obj.data : "";
  const mimeType = typeof obj.mimeType === "string" ? obj.mimeType : "";
  if (!data) return null;
  if (data.length > 6_000_000) {
    throw new functions.https.HttpsError("invalid-argument", "Image too large (max ~4MB).");
  }
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  const mt = allowed.includes(mimeType) ? mimeType : "image/jpeg";
  return { data, mimeType: mt };
}

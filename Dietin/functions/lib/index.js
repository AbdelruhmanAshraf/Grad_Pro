"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gemini_generate_json = exports.gemini_generate = exports.analyze_image_food = exports.analyze_food = exports.get_entitlement = exports.webhooks_paymob = exports.subscriptions_start = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const generative_ai_1 = require("@google/generative-ai");
admin.initializeApp();
const db = admin.firestore();
// All secrets come from process.env (loaded via functions/.env locally,
// or `firebase functions:secrets:set` in production). NEVER hardcode.
const cfg = functions.config();
const PAYMOB = {
    API_KEY: process.env.PAYMOB_API_KEY || cfg.paymob?.api_key,
    HMAC_SECRET: process.env.PAYMOB_HMAC_SECRET || cfg.paymob?.hmac_secret,
    INTEGRATION_ID: process.env.PAYMOB_INTEGRATION_ID || cfg.paymob?.integration_id,
    IFRAME_ID: process.env.PAYMOB_IFRAME_ID ||
        cfg.paymob?.iframe_id ||
        cfg.paymob?.merchant_id,
};
const APP = {
    RETURN_URL: process.env.APP_RETURN_URL || cfg.app?.return_url,
    DOMAIN: process.env.APP_DOMAIN || cfg.app?.domain,
};
const PERIOD = {
    MONTH_DAYS: Number(process.env.SUBS_MONTH_DAYS || cfg.subs?.month_days || 30),
    YEAR_DAYS: Number(process.env.SUBS_YEAR_DAYS || cfg.subs?.year_days || 365),
};
function addDays(date, days) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}
function computeExpiry(plan) {
    const now = new Date();
    return plan === "annual" ? addDays(now, PERIOD.YEAR_DAYS) : addDays(now, PERIOD.MONTH_DAYS);
}
// Create Paymob payment link/session
exports.subscriptions_start = functions.region("us-central1").https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const plan = data?.plan === "annual" ? "annual" : "monthly";
    if (!PAYMOB.API_KEY || !PAYMOB.INTEGRATION_ID) {
        throw new functions.https.HttpsError("failed-precondition", "Paymob not configured");
    }
    // 1) Authenticate to Paymob (get auth token)
    const authRes = await axios_1.default.post("https://accept.paymob.com/api/auth/tokens", {
        api_key: PAYMOB.API_KEY,
    });
    const token = authRes.data?.token;
    if (!token)
        throw new functions.https.HttpsError("internal", "Paymob auth failed");
    // 2) Create order
    const amountCents = plan === "annual" ? 499900 : 49900; // example prices, replace with yours
    const orderRes = await axios_1.default.post("https://accept.paymob.com/api/ecommerce/orders", {
        auth_token: token,
        delivery_needed: false,
        amount_cents: amountCents,
        currency: "EGP",
        merchant_order_id: `${uid}-${Date.now()}`,
        items: [],
    });
    const orderId = orderRes.data?.id;
    if (!orderId)
        throw new functions.https.HttpsError("internal", "Order creation failed");
    // 3) Payment key
    const paymentKeyRes = await axios_1.default.post("https://accept.paymob.com/api/acceptance/payment_keys", {
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
    if (!paymentKey)
        throw new functions.https.HttpsError("internal", "Payment key failed");
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
exports.webhooks_paymob = functions.region("us-central1").https.onRequest(async (req, res) => {
    try {
        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed");
            return;
        }
        // Per Paymob docs, compute HMAC over specific fields
        const providedHmac = req.query?.hmac || req.headers["hmac"] || "";
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
        const crypto = await Promise.resolve().then(() => __importStar(require("node:crypto")));
        const calc = crypto.createHmac("sha512", PAYMOB.HMAC_SECRET).update(dataStr).digest("hex");
        if (calc !== providedHmac) {
            res.status(403).send("Invalid HMAC");
            return;
        }
        const success = Boolean(obj?.success);
        const orderId = obj?.order?.id;
        // Find pending subscription by providerOrderId
        const snap = await db.collection("subscriptions").where("providerOrderId", "==", orderId).limit(1).get();
        if (snap.empty) {
            res.status(200).send("No pending subscription");
            return;
        }
        const docRef = snap.docs[0].ref;
        const sub = snap.docs[0].data();
        if (!success) {
            await docRef.update({ status: "failed", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            res.status(200).send("Marked failed");
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
    }
    catch (e) {
        console.error(e);
        res.status(500).send("Server error");
    }
});
// Entitlement: server-evaluated
exports.get_entitlement = functions.region("us-central1").https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    }
    const uid = context.auth.uid;
    const userDoc = await db.collection("users").doc(uid).get();
    const u = userDoc.data() || {};
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
const genAI = GEMINI_API_KEY ? new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY) : null;
function requireGemini() {
    if (!genAI) {
        throw new functions.https.HttpsError("failed-precondition", "AI not configured: GEMINI_API_KEY missing on server.");
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
function sanitizeText(text, maxChars = 8000) {
    if (!text)
        return "";
    return text
        .replace(/[ --]/g, "")
        .trim()
        .slice(0, maxChars);
}
// Strip prompt-injection escape attempts from user input before forwarding to Gemini.
// This is best-effort; the proxy endpoints also use strict system prompts + JSON-only output.
function sanitizePromptInput(input, maxLen = 2000) {
    if (typeof input !== "string")
        return "";
    return input
        .replace(/[ -]/g, " ")
        .replace(/```/g, " ")
        .replace(/\b(system|assistant|developer)\s*:/gi, " ")
        .trim()
        .slice(0, maxLen);
}
const QUOTA_LIMITS = {
    meal: MEAL_LIMIT,
    image: IMAGE_LIMIT,
    workout: WORKOUT_LIMIT,
    hydration: HYDRATION_LIMIT,
    textgen: TEXT_GEN_LIMIT,
};
const QUOTA_PREFIX = {
    meal: "dailyMeal",
    image: "dailyImage",
    workout: "dailyWorkout",
    hydration: "dailyHydration",
    textgen: "dailyTextGen",
};
async function checkQuota(uid, type) {
    const userRef = db.collection("users").doc(uid);
    return db.runTransaction(async (t) => {
        const doc = await t.get(userRef);
        const data = doc.data() || {};
        const now = admin.firestore.Timestamp.now();
        const isPro = Boolean(data.isPro) && data.proExpiresAt && data.proExpiresAt.toMillis() > now.toMillis();
        if (isPro)
            return;
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
            throw new functions.https.HttpsError("resource-exhausted", `Daily ${type} analysis limit reached. Upgrade to Pro.`);
        }
        t.set(userRef, {
            [dateField]: today,
            [countField]: count + 1,
        }, { merge: true });
    });
}
exports.analyze_food = functions.region("us-central1").https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    const rawDescription = typeof data?.description === "string" ? data.description : "";
    if (!rawDescription)
        throw new functions.https.HttpsError("invalid-argument", "Description required");
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
        }
        catch (e) {
            throw new Error("Failed to parse JSON");
        }
        return {
            calories: Number(parsed.calories) || 0,
            protein: Number(parsed.protein) || 0,
            carbs: Number(parsed.carbs) || 0,
            fat: Number(parsed.fat) || 0,
            healthScore: Number(parsed.healthScore) || 0
        };
    }
    catch (e) {
        console.error("AI Error:", e);
        throw new functions.https.HttpsError("internal", "AI analysis failed");
    }
});
exports.analyze_image_food = functions.region("us-central1").https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    const { imageBase64, mimeType } = data || {};
    if (!imageBase64 || typeof imageBase64 !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "Image required");
    }
    // base64 size cap: ~4 MB raw image (4_000_000 bytes -> ~5_400_000 chars in base64)
    if (imageBase64.length > 6000000) {
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
        const description = sanitizeText((await result.response).text()
            .trim()
            .replace(/^(The image shows|I see|This is|In this image)/i, '')
            .trim(), 4000);
        return { description };
    }
    catch (e) {
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
function safeModelId(m) {
    if (typeof m === "string" && ALLOWED_MODELS.has(m))
        return m;
    return GEMINI_MODEL;
}
exports.gemini_generate = functions
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
        const parts = [{ text: prompt }];
        if (imagePart)
            parts.push({ inlineData: imagePart });
        const result = await model.generateContent({ contents: [{ role: "user", parts }] });
        const text = sanitizeText((await result.response).text(), OUTPUT_MAX);
        return { text };
    }
    catch (e) {
        console.error("gemini_generate error", e);
        throw new functions.https.HttpsError("internal", "AI generation failed");
    }
});
exports.gemini_generate_json = functions
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
        const parts = [{ text: prompt }];
        if (imagePart)
            parts.push({ inlineData: imagePart });
        const result = await model.generateContent({ contents: [{ role: "user", parts }] });
        const raw = sanitizeText((await result.response).text(), OUTPUT_MAX);
        const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        }
        catch {
            throw new functions.https.HttpsError("internal", "AI returned invalid JSON.");
        }
        return { json: parsed };
    }
    catch (e) {
        if (e instanceof functions.https.HttpsError)
            throw e;
        console.error("gemini_generate_json error", e);
        throw new functions.https.HttpsError("internal", "AI generation failed");
    }
});
function validateImagePart(image) {
    if (!image || typeof image !== "object")
        return null;
    const obj = image;
    const data = typeof obj.data === "string" ? obj.data : "";
    const mimeType = typeof obj.mimeType === "string" ? obj.mimeType : "";
    if (!data)
        return null;
    if (data.length > 6000000) {
        throw new functions.https.HttpsError("invalid-argument", "Image too large (max ~4MB).");
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];
    const mt = allowed.includes(mimeType) ? mimeType : "image/jpeg";
    return { data, mimeType: mt };
}

import { applyApiCors } from "./lib/cors.js";
import { clientSafeDetail, logServerError } from "./lib/safeJsonError.js";
import {
  assertNutritionLabelRateLimit,
  validateNutritionLabelPayload,
} from "./lib/nutritionLabelRateLimit.js";

const isProd = process.env.NODE_ENV === "production";

/**
 * Plated-meal photo estimate (not nutrition-label OCR).
 * POST { imageBase64, mimeType?, mealSlot? } → macros + foodName + confidence
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    applyApiCors(req, res);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only" });
  }

  applyApiCors(req, res);
  res.setHeader("Content-Type", "application/json");

  const rate = await assertNutritionLabelRateLimit(req);
  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfterSec));
    return res.status(429).json({
      error: "Too many food photo estimates. Please wait a moment and try again.",
      retryAfterSec: rate.retryAfterSec,
    });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(500).json(
      isProd
        ? { error: "Meal photo estimate is not configured." }
        : { error: "Missing OPENAI_API_KEY" }
    );
  }

  try {
    const body = req.body || {};
    const payloadError = validateNutritionLabelPayload(body);
    if (payloadError) {
      return res.status(400).json({ error: payloadError });
    }

    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
    if (imageBase64.length < 100) {
      return res.status(400).json({ error: "Provide imageBase64 of the plated meal." });
    }

    const mealSlot =
      typeof body.mealSlot === "string" && body.mealSlot.trim()
        ? body.mealSlot.trim().slice(0, 40)
        : null;
    const mimeHint =
      typeof body.mimeType === "string" && body.mimeType.startsWith("image/")
        ? body.mimeType.trim().slice(0, 40)
        : null;

    const rawB64 = imageBase64.includes(",") ? imageBase64.split(",").pop() : imageBase64;
    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:${mimeHint || "image/jpeg"};base64,${rawB64}`;

    const system = `You estimate nutrition for a plated / prepared meal from a photo (not a packaged Nutrition Facts label).
Identify the main foods and portion sizes you can see. Estimate total macros for what is shown on the plate/bowl.
Return JSON only:
{ "foodName": string, "protein": number, "carbs": number, "fat": number, "calories": number, "confidence": "high"|"medium"|"low", "notes": string|null }
- foodName: short human label (e.g. "Grilled chicken salad", "Pasta with meatballs")
- macros: whole numbers for the visible serving
- confidence: high if clear plated food; low if blurry, empty, or not food
- notes: optional brief portion assumption
If the image is not food, set macros to 0 and confidence to "low".`;

    const userText = mealSlot
      ? `This is likely a ${mealSlot} meal. Estimate calories and macros for the food shown.`
      : "Estimate calories and macros for the plated meal shown in this photo.";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      logServerError("estimate-meal-photo OpenAI", new Error(`${response.status} ${errBody.slice(0, 200)}`));
      return res.status(502).json({ error: "Could not estimate that meal right now. Try again." });
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: "Invalid response from meal estimator." });
    }

    const protein = Math.max(0, Math.round(Number(parsed.protein) || 0));
    const carbs = Math.max(0, Math.round(Number(parsed.carbs) || 0));
    const fat = Math.max(0, Math.round(Number(parsed.fat) || 0));
    const calories = Math.max(0, Math.round(Number(parsed.calories) || 0));
    if (protein + carbs + fat + calories <= 0) {
      return res.status(422).json({
        error: "Could not estimate macros from that photo. Try a clearer shot of the plate, or type the meal.",
      });
    }

    return res.status(200).json({
      foodName: parsed.foodName ? String(parsed.foodName).slice(0, 120) : "Meal photo",
      protein,
      carbs,
      fat,
      calories,
      confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "medium",
      notes: parsed.notes ? String(parsed.notes).slice(0, 200) : null,
    });
  } catch (e) {
    logServerError("estimate-meal-photo handler", e);
    return res.status(500).json({ error: clientSafeDetail(e, "Meal estimate failed.") });
  }
}

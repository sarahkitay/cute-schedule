import { applyApiCors } from "./lib/cors.js";
import { clientSafeDetail, logServerError } from "./lib/safeJsonError.js";
import {
  assertNutritionLabelRateLimit,
  validateNutritionLabelPayload,
} from "./lib/nutritionLabelRateLimit.js";

const isProd = process.env.NODE_ENV === "production";

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
      error: "Too many label scans. Please wait a moment and try again.",
      retryAfterSec: rate.retryAfterSec,
    });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(500).json(
      isProd ? { error: "Label reading service is not configured." } : { error: "Missing OPENAI_API_KEY" }
    );
  }

  try {
    const body = req.body || {};
    const payloadError = validateNutritionLabelPayload(body);
    if (payloadError) {
      return res.status(400).json({ error: payloadError });
    }

    const { text, imageBase64 } = body;
    const hasImage = typeof imageBase64 === "string" && imageBase64.length > 100;
    const hasText = typeof text === "string" && text.trim().length > 8;

    if (!hasImage && !hasText) {
      return res.status(400).json({ error: "Provide OCR text or imageBase64." });
    }

    const system = `You are a Nutrition Facts label reader for the FDA "Nutrition Facts" panel on packaged food.
Read the panel like a document scanner: ignore the % Daily Value column on the right; use only the nutrient amounts (grams/mg) on the left.
Extract ONLY the per-serving column (ignore per-container unless that is all that exists).
Required fields - find the number next to each label:
- calories (kcal, often the large number under "Calories")
- protein (grams, line labeled "Protein")
- total fat (grams, line labeled "Total Fat" - NOT saturated fat alone)
- total carbohydrate (grams, line labeled "Total Carbohydrate" or "Total Carbs")
Return JSON only: { "protein": number, "carbs": number, "fat": number, "calories": number, "servingSize": string|null, "foodName": string|null, "confidence": "high"|"medium"|"low" }
Round macros to whole numbers. If a value is missing on the label, use 0.`;

    /** @type {import('openai').default.ChatCompletionMessageParam[]} */
    const userContent = [];
    if (hasText) {
      userContent.push({ type: "text", text: `OCR text from nutrition label:\n\n${text.trim().slice(0, 12000)}` });
    }
    if (hasImage) {
      const raw = imageBase64.includes(",") ? imageBase64.split(",").pop() : imageBase64;
      const dataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${raw}`;
      userContent.push({ type: "image_url", image_url: { url: dataUrl, detail: "high" } });
      if (!hasText) {
        userContent.unshift({
          type: "text",
          text: "Read the Nutrition Facts panel in this photo and extract per-serving macros.",
        });
      }
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: hasImage ? "gpt-4o-mini" : "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      logServerError("nutrition-label OpenAI", new Error(`${response.status} ${errBody.slice(0, 200)}`));
      return res.status(502).json({ error: "Could not read the label right now. Try again." });
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: "Invalid response from label reader." });
    }

    const protein = Math.round(Number(parsed.protein) || 0);
    const carbs = Math.round(Number(parsed.carbs) || 0);
    const fat = Math.round(Number(parsed.fat) || 0);
    const calories = Math.round(Number(parsed.calories) || 0);
    if (protein + carbs + fat + calories <= 0) {
      return res.status(422).json({
        error: "Could not find protein, carbs, fat, or calories on this label.",
      });
    }

    return res.status(200).json({
      macros: {
        protein,
        carbs,
        fat,
        calories,
        ...(parsed.servingSize ? { servingSize: String(parsed.servingSize).slice(0, 80) } : {}),
      },
      foodName: parsed.foodName ? String(parsed.foodName).slice(0, 120) : null,
      confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "medium",
    });
  } catch (e) {
    logServerError("nutrition-label handler", e);
    return res.status(500).json({ error: clientSafeDetail(e, "Label read failed.") });
  }
}

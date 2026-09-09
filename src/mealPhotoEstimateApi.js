import { apiUrl } from "./apiBase.js";

/**
 * Estimate macros for a plated meal photo (not a Nutrition Facts label).
 * @param {string} imageBase64 data URL or raw base64
 * @param {string} [mimeType]
 * @param {{ mealSlot?: string }} [opts]
 * @returns {Promise<{ foodName: string, protein: number, carbs: number, fat: number, calories: number, confidence?: string, notes?: string|null }>}
 */
export async function estimateMealFromPhotoApi(imageBase64, mimeType = "image/jpeg", opts = {}) {
  let res;
  try {
    res = await fetch(apiUrl("/api/estimate-meal-photo"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64,
        mimeType: mimeType || "image/jpeg",
        ...(opts.mealSlot ? { mealSlot: opts.mealSlot } : {}),
      }),
    });
  } catch (e) {
    const msg = String(e?.message || "");
    throw new Error(
      msg === "Load failed" || msg === "Failed to fetch"
        ? "Could not reach meal estimate. Check your connection and try again."
        : msg || "Network error while estimating the meal."
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || "Could not estimate that meal.");
    err.status = res.status;
    throw err;
  }
  return data;
}

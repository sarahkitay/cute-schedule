import { apiUrl } from "./apiBase.js";

/**
 * Parse nutrition label via server (OpenAI vision / text) when local OCR parsing fails.
 * @param {{ text?: string, imageBase64?: string }} payload
 */
export async function parseNutritionLabelWithCoachApi(payload) {
  let res;
  try {
    res = await fetch(apiUrl("/api/nutrition-label"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const msg = String(e?.message || "");
    throw new Error(
      msg === "Load failed" || msg === "Failed to fetch"
        ? "Could not reach the label reader. Your scan is still saved locally - edit the values below or try again on Wi‑Fi."
        : msg || "Network error while reading the label.",
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || "Could not read the label.");
    err.status = res.status;
    throw err;
  }
  return data;
}

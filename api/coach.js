export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY env var in Vercel (Production)",
      });
    }

    const { dayKey, today, monthly, progress } = req.body || {};
    const todayHours = today || {};

    if (!dayKey) return res.status(400).json({ error: "Missing dayKey" });

    const prompt = `
You are a calm, direct productivity coach for Sarah.
Return JSON only. No markdown. No code fences.

Day: ${dayKey}
Completion: ${progress?.done || 0}/${progress?.total || 0} (${progress?.pct || 0}%)
Today's schedule: ${JSON.stringify(todayHours)}
Monthly objectives: ${JSON.stringify(monthly || [])}

Return JSON EXACTLY in this schema:
{
  "message": "2-3 sentences. Calm, direct.",
  "highlights": ["3-5 bullets"],
  "suggestions": [{"category":"RHEA|EPC|Personal","text":"...","hour":"HH:MM"}],
  "ignoredMonthlies": [{"id":"optional","text":"..."}],
  "percentSummary": "One short line snapshot"
}
`.trim();

    // ✅ Use the Responses API (more reliable than chat/completions on newer keys)
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: "Return valid JSON only. No markdown. No code fences.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      }),
    });

    const raw = await response.json().catch(() => ({}));

    // Surface upstream OpenAI errors to the frontend (so you see why)
    if (!response.ok) {
      return res.status(response.status).json({
        error: "OpenAI request failed",
        status: response.status,
        detail: raw?.error?.message || raw,
      });
    }

    // Responses API text extraction
    const text =
      raw?.output_text ||
      raw?.output?.[0]?.content?.[0]?.text ||
      "{}";

    const cleaned = String(text).replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({
        error: "Model did not return valid JSON",
        raw: cleaned,
      });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e) });
  }
}

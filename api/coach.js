export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY env var" });
    }

    const { dayKey, today, monthly, progress } = req.body || {};
    const todayHours = today || {};

    if (!dayKey) return res.status(400).json({ error: "Missing dayKey" });

    const prompt = `
You are a calm, direct productivity coach for Sarah.
Return JSON only.

Context:
- Day: ${dayKey}
- Completion: ${progress?.done || 0}/${progress?.total || 0} (${progress?.pct || 0}%)
- Today's schedule: ${JSON.stringify(todayHours)}
- Monthly objectives: ${JSON.stringify(monthly || [])}

Return JSON in this schema EXACTLY:
{
  "message": "2-3 sentences. Calm, direct.",
  "highlights": ["3-5 bullets: today's focus"],
  "suggestions": [
    { "category": "RHEA|EPC|Personal", "text": "task text", "hour": "HH:MM" }
  ],
  "ignoredMonthlies": [
    { "id": "optional", "text": "monthly objective text" }
  ],
  "percentSummary": "One short line snapshot"
}
`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: "Return valid JSON only. No markdown. No code fences." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      }),
    });

    const raw = await r.json().catch(() => ({}));

    // If OpenAI errors, surface it (so your UI shows a real error)
    if (!r.ok) {
      return res.status(r.status).json({
        error: "OpenAI request failed",
        detail: raw?.error?.message || JSON.stringify(raw),
      });
    }

    const text = raw?.choices?.[0]?.message?.content || "{}";
    const cleaned = String(text).replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: "Model did not return valid JSON", raw: cleaned });
    }

    // Guard: if it returns empty, still give something visible
    if (!parsed.message && !Array.isArray(parsed.highlights) && !Array.isArray(parsed.suggestions)) {
      return res.status(200).json({
        message: "Add a couple more tasks and I’ll give you a tighter plan.",
        highlights: [],
        suggestions: [],
        ignoredMonthlies: [],
        percentSummary: `${progress?.done || 0}/${progress?.total || 0} done`,
      });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e) });
  }
}

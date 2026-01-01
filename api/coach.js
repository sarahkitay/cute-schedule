export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { dayKey, todayHours, monthly, progress } = req.body || {};

    // Basic guard
    if (!dayKey) return res.status(400).json({ error: "Missing dayKey" });

    // Minimal “coach” logic prompt (keep it short + non-AI sounding)
    const prompt = `
You are a calm, direct productivity coach for Sarah.
Return JSON only, no extra text.

Context:
- Day: ${dayKey}
- Completion: ${progress?.done || 0}/${progress?.total || 0} (${progress?.pct || 0}%)
- Today's schedule (grouped by hour/category): ${JSON.stringify(todayHours || {})}
- Monthly objectives: ${JSON.stringify(monthly || [])}

Goals:
1) Suggest up to 5 tasks for today that fit what's missing (RHEA/EPC/Personal balance).
2) Identify up to 3 monthly objectives that should be moved into Today and suggest an hour + category for each.
3) Call out what is being ignored (if any) in one sentence, gently.
4) Give one short “next best action” sentence.

Return JSON in this schema:
{
  "suggestedTasks": [{"category":"RHEA|EPC|Personal","text":"...","suggestedHour":"HH:MM"}],
  "moveFromMonthly": [{"monthlyId":"...","text":"...","suggestedHour":"HH:MM","category":"RHEA|EPC|Personal"}],
  "gentleNudge": "string",
  "nextBestAction": "string"
}
`;

    // ---- OpenAI example ----
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: "You output valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      }),
    });

    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || "{}";

    // If the model returns JSON in a code block, strip it
    const cleaned = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { error: "Model did not return valid JSON", raw: cleaned };
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e) });
  }
}

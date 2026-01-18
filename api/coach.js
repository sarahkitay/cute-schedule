export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only" });
  }

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  try {
    const key = process.env.OPENAI_API_KEY;

    if (!key) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY in Vercel env vars",
        hint: "Add an OpenAI key that starts with sk- or sk-proj-",
      });
    }

    const { dayKey, today, monthly, progress } = req.body || {};
    if (!dayKey) return res.status(400).json({ error: "Missing dayKey" });

    const prompt = `
You are a calm, direct productivity coach for Sarah.
Return JSON only. No markdown. No code fences.

Day: ${dayKey}
Completion: ${progress?.done || 0}/${progress?.total || 0} (${progress?.pct || 0}%)
Today's schedule: ${JSON.stringify(today || {})}
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

    async function callOpenAI(tryNum) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.4,
          messages: [
            { role: "system", content: "Return valid JSON only. No markdown. No code fences." },
            { role: "user", content: prompt },
          ],
        }),
      });

      const raw = await r.json().catch(() => ({}));
      console.log("OpenAI status:", r.status);
      if (raw?.error) console.log("OpenAI error:", raw.error);

      // Retry 429s with exponential backoff
      if (r.status === 429 && tryNum < 3) {
        const wait = 800 * Math.pow(2, tryNum); // 0.8s, 1.6s, 3.2s
        await new Promise((res) => setTimeout(res, wait));
        return callOpenAI(tryNum + 1);
      }

      return { r, raw };
    }

    const { r: response, raw } = await callOpenAI(0);

    if (!response.ok) {
      return res.status(response.status).json({
        error: "OpenAI request failed",
        status: response.status,
        detail: raw?.error?.message || raw,
        type: raw?.error?.type,
        code: raw?.error?.code,
        hint:
          response.status === 401
            ? "Invalid API key"
            : response.status === 429
            ? "Rate limit or quota. Check OpenAI Platform billing + limits."
            : undefined,
      });
    }

    const text = raw?.choices?.[0]?.message?.content || "{}";
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
    console.error("Server error:", e);
    return res.status(500).json({ error: "Server error", detail: String(e) });
  }
}

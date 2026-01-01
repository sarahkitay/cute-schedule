const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: "You are a calm productivity coach. Return ONLY valid JSON. No markdown. No code blocks."
      },
      {
        role: "user",
        content: prompt
      }
    ]
  }),
});

// Always parse safely
const raw = await response.json().catch(() => null);

// If OpenAI errors, surface it clearly to the frontend
if (!response.ok) {
  return res.status(response.status).json({
    error: "OpenAI request failed",
    status: response.status,
    detail: raw?.error?.message || raw || "Unknown OpenAI error",
  });
}

// Extract model output
const text = raw?.choices?.[0]?.message?.content;

if (!text) {
  return res.status(500).json({
    error: "OpenAI returned no content",
    raw,
  });
}

// Strip accidental formatting just in case
const cleaned = String(text)
  .replace(/```json/gi, "")
  .replace(/```/g, "")
  .trim();

// Parse JSON
let parsed;
try {
  parsed = JSON.parse(cleaned);
} catch (err) {
  return res.status(500).json({
    error: "Model returned invalid JSON",
    rawText: cleaned,
  });
}

// Success
return res.status(200).json(parsed);

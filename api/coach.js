const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Return valid JSON only. No markdown. No code fences."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.4
  }),
});

const raw = await response.json();

if (!response.ok) {
  return res.status(response.status).json({
    error: "OpenAI request failed",
    detail: raw?.error?.message || raw
  });
}

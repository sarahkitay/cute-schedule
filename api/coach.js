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

    const { dayKey, today, monthly, progress, userQuestion, conversation, patterns, notes, mode, tasks, schedule, mood } = req.body || {};
    if (!dayKey) return res.status(400).json({ error: "Missing dayKey" });

    // ADHD Coach modes: structured actions (plan / unstuck / review)
    const adhdModes = ["plan", "unstuck", "review"];
    if (mode && adhdModes.includes(mode)) {
      const tasksList = Array.isArray(tasks) ? tasks : [];
      const scheduleData = schedule || today || {};
      const systemContent = `You are an ADHD planning assistant for this app. You can only reorder existing tasks, propose time blocks, suggest micro-steps for existing tasks, or suggest breaks. You cannot invent new tasks. Return valid JSON only. No markdown. No code fences.`;
      let userContent = "";
      if (mode === "plan") {
        userContent = `Plan my day. Date: ${dayKey}. Current schedule (time -> categories -> tasks): ${JSON.stringify(scheduleData)}. Incomplete tasks: ${JSON.stringify(tasksList)}. Mood: ${mood || "not set"}.
Output a proposed order and timeboxing. Return JSON: { "summary": "2-3 sentences", "followUp": "one optional question or null", "actions": [ { "type": "TIMEBOX", "taskId": "...", "start": "HH:MM", "end": "HH:MM" }, { "type": "REORDER", "taskIds": ["id1","id2"] }, { "type": "BREAK", "start": "HH:MM", "end": "HH:MM", "label": "Short break" } ] }. Use only taskIds that exist in the input.`;
      } else if (mode === "unstuck") {
        userContent = `User is overwhelmed. Pick ONE task from: ${JSON.stringify(tasksList)}. Break it into 3 micro-steps (5-15 min to start). Return JSON: { "summary": "1-2 sentences", "taskId": "...", "taskTitle": "...", "steps": [ { "text": "...", "minutes": 5 } ], "actions": [ { "type": "MICRO_STEPS", "taskId": "...", "steps": [ { "text": "...", "minutes": 5 } ] } ] }.`;
      } else if (mode === "review") {
        userContent = `End-of-day review. Date: ${dayKey}. Completion: ${progress?.done || 0}/${progress?.total || 0}. Schedule: ${JSON.stringify(scheduleData)}. Patterns: ${JSON.stringify(patterns || {})}. Summarise wins, detect one pattern (e.g. tasks missed at 3pm), suggest one change for tomorrow. Return JSON: { "summary": "2-4 sentences", "wins": ["..."], "pattern": "one sentence", "suggestion": "one sentence", "actions": [] }.`;
      }
      const adhdMessages = [
        { role: "system", content: systemContent },
        { role: "user", content: userContent }
      ];
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.3, messages: adhdMessages }),
      });
      const raw = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(r.status).json({ error: "OpenAI request failed", detail: raw?.error?.message || raw });
      const text = raw?.choices?.[0]?.message?.content || "{}";
      const cleaned = String(text).replace(/```json|```/g, "").trim();
      let parsed;
      try { parsed = JSON.parse(cleaned); } catch { return res.status(500).json({ error: "Model did not return valid JSON", raw: cleaned }); }
      return res.status(200).json({ summary: parsed.summary || "", followUp: parsed.followUp || null, actions: Array.isArray(parsed.actions) ? parsed.actions : [] });
    }

    // Build conversation context
    let messages = [
      { role: "system", content: "You are a calm, direct productivity coach for Sarah. Return valid JSON only. No markdown. No code fences." }
    ];

    // Add conversation history if there's a question
    if (userQuestion && conversation && conversation.length > 0) {
      conversation.forEach(msg => {
        messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
      });
    }

    // Build pattern insights
    let patternInsights = "";
    if (patterns) {
      patternInsights = `\n\nPatterns I've noticed:
- You typically complete tasks best in the ${patterns.bestTime || 'morning'}
- ${patterns.leastCompletedCategory ? `You tend to skip ${patterns.leastCompletedCategory} tasks` : ''}
- Today you've completed ${patterns.todayCompletions || 0} tasks`;
    }
    
    // Notes context for habits and goals
    const notesContext = Array.isArray(notes) && notes.length > 0
      ? `\nUser's notes (use these to understand what they're working on or toward): ${JSON.stringify(notes.map(n => typeof n === 'object' && n.text != null ? n.text : String(n)))}`
      : "";

    // Build the main prompt
    const contextPrompt = `
Day: ${dayKey}
Completion: ${progress?.done || 0}/${progress?.total || 0} (${progress?.pct || 0}%)
Today's schedule: ${JSON.stringify(today || {})}
Monthly objectives: ${JSON.stringify(monthly || [])}${patternInsights}${notesContext}
`.trim();

    let prompt;
    if (userQuestion) {
      // If there's a question, answer it in the context of the schedule
      prompt = `${contextPrompt}\n\nUser question: ${userQuestion}\n\nAnswer the question thoughtfully, considering the user's schedule, progress, and patterns. Be observant and slightly opinionated - reference specific patterns when relevant. Return JSON in the schema below.`;
    } else {
      // Regular check-in - be observant and opinionated based on patterns
      prompt = `You are Sarah's observant productivity coach. You notice patterns and offer gentle opinions.\n\n${contextPrompt}\n\nProvide guidance about today's schedule. Reference patterns you've noticed when relevant. Be specific and slightly opinionated - for example, "You usually do better when you start with one small task" or "You tend to skip Personal tasks on Mondays." Avoid generic motivational language. Return JSON in the schema below.`;
    }

    const fullPrompt = `${prompt}\n\nReturn JSON EXACTLY in this schema:
{
  "message": "${userQuestion ? "2-4 sentences answering the question" : "2-3 sentences. Calm, direct."}",
  "highlights": ["3-5 bullets"],
  "suggestions": [{"category":"RHEA|EPC|Personal","text":"...","hour":"HH:MM"}],
  "ignoredMonthlies": [{"id":"optional","text":"..."}],
  "percentSummary": "One short line snapshot"
}`;

    messages.push({ role: "user", content: fullPrompt });

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
          messages: messages,
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

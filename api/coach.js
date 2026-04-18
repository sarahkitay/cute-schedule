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

    const {
      dayKey,
      today,
      monthly,
      progress,
      userQuestion,
      conversation,
      patterns,
      notes,
      mode,
      tasks,
      schedule,
      mood,
      finance,
      habits,
      habitLogSummary,
      habitToday,
      systemPrompt,
      prettyDate,
      categories,
      timeOfDay,
      emotionalState,
      completedToday,
      totalTasks,
      energyBalance,
      userProfile,
      billsDueSoon,
      subscriptions,
      coachIntelligenceText,
      coachFeedbackJson,
    } = req.body || {};
    if (!dayKey) return res.status(400).json({ error: "Missing dayKey" });

    const OUTPUT_RULES = "Return valid JSON only. No markdown. No code fences.";

    // ADHD Coach modes: structured actions (plan / unstuck / review)
    const adhdModes = ["plan", "unstuck", "review"];
    if (mode && adhdModes.includes(mode)) {
      const tasksList = Array.isArray(tasks) ? tasks : [];
      const scheduleData = schedule || today || {};
      const habitBlock =
        Array.isArray(habits) && habits.length > 0
          ? ` User habits (build = cultivate, break = reduce): ${JSON.stringify(habits)}. Recent check-ins: ${String(habitLogSummary || "none")}. Today: ${JSON.stringify(habitToday || {})}. Mention gently in review if relevant; no shame.`
          : "";
      const systemContent = `You are an ADHD-aware planning coach: emotionally steady, never shaming, and logically precise with the user's real schedule. You only reorder existing tasks, propose time blocks, suggest micro-steps for tasks already listed, or suggest breaks. Do not invent new obligations. Name overload when the task list implies it; offer one tiny on-ramp. Vary sentence shape (observational, practical); avoid therapy-speak. ${OUTPUT_RULES}`;
      let userContent = "";
      if (mode === "plan") {
        userContent = `Tone for this mode: calm strategist — clear structure over emotional processing; still kind.

Plan my day. Date: ${dayKey}. Current schedule (time -> categories -> tasks): ${JSON.stringify(scheduleData)}. Incomplete tasks: ${JSON.stringify(tasksList)}. Mood: ${mood || "not set"}.${habitBlock}
Output a proposed order and timeboxing. Return JSON: { "summary": "2-3 sentences", "followUp": "one optional question or null", "actions": [ { "type": "TIMEBOX", "taskId": "...", "start": "HH:MM", "end": "HH:MM" }, { "type": "REORDER", "taskIds": ["id1","id2"] }, { "type": "BREAK", "start": "HH:MM", "end": "HH:MM", "label": "Short break" } ] }. Use only taskIds that exist in the input.`;
      } else if (mode === "unstuck") {
        userContent = `Tone for this mode: friction-reducer — very small steps, low pressure; reduce activation energy, not maximize output.

User is overwhelmed. Pick ONE task from: ${JSON.stringify(tasksList)}.${habitBlock} Break it into 3 micro-steps (5-15 min to start). Return JSON: { "summary": "1-2 sentences", "taskId": "...", "taskTitle": "...", "steps": [ { "text": "...", "minutes": 5 } ], "actions": [ { "type": "MICRO_STEPS", "taskId": "...", "steps": [ { "text": "...", "minutes": 5 } ] } ] }.`;
      } else if (mode === "review") {
        const financeNote = finance && (finance.incomeThisMonth > 0 || finance.spentThisMonth > 0 || (finance.totalSavings || 0) > 0 || (finance.totalDebt || 0) > 0) ? ` Finance snapshot: income this month $${(finance.incomeThisMonth || 0).toFixed(2)}, spent $${(finance.spentThisMonth || 0).toFixed(2)}, savings $${(finance.totalSavings || 0).toFixed(2)}, debt $${(finance.totalDebt || 0).toFixed(2)}. If relevant, mention one gentle money habit (e.g. "You logged spending this month; that's a win.").` : "";
        userContent = `Tone for this mode: reflective pattern-noticer — precise, one real pattern, one clean adjustment for tomorrow.

End-of-day review. Date: ${dayKey}. Completion: ${progress?.done || 0}/${progress?.total || 0}. Schedule: ${JSON.stringify(scheduleData)}. Patterns: ${JSON.stringify(patterns || {})}.${financeNote}${habitBlock} Summarise wins, detect one pattern (e.g. tasks missed at 3pm), suggest one change for tomorrow. If habit data is present, you may note one observation (e.g. consistency on a build habit or compassion after a break-habit slip). Return JSON: { "summary": "2-4 sentences", "wins": ["..."], "pattern": "one sentence", "suggestion": "one sentence", "actions": [] }.`;
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
    const hasSavingsAccounts = finance && Array.isArray(finance.savingsAccounts) && finance.savingsAccounts.length > 0;
    const hasDebtAccounts = finance && Array.isArray(finance.debtAccounts) && finance.debtAccounts.length > 0;
    const hasFinance = finance && (finance.incomeThisMonth > 0 || finance.spentThisMonth > 0 || finance.totalSavings > 0 || finance.totalDebt > 0 || hasSavingsAccounts || hasDebtAccounts || (finance.subscriptions && finance.subscriptions.length > 0) || (finance.wishList && finance.wishList.length > 0) || (finance.bankStatementNotes && finance.bankStatementNotes.trim()));

    const clientPersona = String(systemPrompt || "").trim();
    const financeLayer = hasFinance
      ? " You may also comment gently on money when finance data is present: 1–2 observations and one small next step. Never shame or lecture."
      : "";

    const antiGeneric = `
Voice: observant, calm, slightly surgical — this product, not a productivity blog.

When the user asks for advice:
- First interpret what their current schedule or pacing is likely doing to them (use today's JSON: blocks, tasks, times, categories).
- Then name the mechanism in plain language (e.g. late blocks still demand decisions; mental load carries past the last task).
- Then suggest changes in scheduling vocabulary: move, shrink, swap, buffer, or remove tasks — tied to their real hours/blocks, not abstract wellness.
- If you name a low-effort wind-down or replacement activity, give at least one concrete example (journaling, plan tomorrow in 10 min, light reset/tidy, low-effort admin, reading).

Sleep / waking / fatigue:
- Assume structure may be the cause, not only "habits." Scan for heavy tasks too late, missing low-effort final block, unresolved items carried into night.
- Reframe the last 1–2 hours of the day; focus on lowering mental activation, not generic sleep hygiene.
- Avoid: "create a routine", "try to relax", "consider…", "calming activities" without a named task.

Banned sentence openers (do not start the message with these): "To help you", "You can try", "Consider", "It's important to", "In order to".

Start the message with an observation about their data OR a reframing — not a preamble about helping.

Suggestions (Coach V2): When a concrete move fits, return 0–4 items in "suggestions". Each item MUST use this shape:
{ "type":"ADD_TASK"|"BREAK"|"SPLIT_TASK"|"DEFER"|"REORDER"|"TIMEBOX", "title":"short label", "description":"optional detail", "reason":"one sentence tied to THIS user's data", "category":"one of their categories", "energyLevel":"LIGHT"|"MEDIUM"|"HEAVY", "start":"HH:MM", "end":"HH:MM or null", "durationMinutes": number, "recurring": false, "confidence": 0.0-1.0, "requiresApproval": true, "targetTaskId": "existing id or null" }.
Use ADD_TASK or BREAK for new items the app can insert after approval. Use SPLIT_TASK/DEFER/REORDER/TIMEBOX only when grounded in listed tasks (include targetTaskId). Never auto-apply — requiresApproval is always true for user-facing rows. Use [] when no concrete suggestion fits.

Anti-drift:
- Do not sound like a therapist, life coach, or inspirational quote account.
- Tie emotion words to evidence from the task list or pacing fields when you use them.
- Do not repeat the same reassurance twice in different wording.
- Prefer one concrete tradeoff when load is high: defer, shrink, swap, buffer, or stop.
- Keep under ~140 words in "message" unless the user asked for depth.`;

    const systemContent = clientPersona
      ? `${clientPersona}
You combine empathy with clear scheduling logic: anchor advice in the user's real hours, categories, and completion counts.${financeLayer}
${antiGeneric}
${OUTPUT_RULES}`
      : `You are a calm, emotionally intelligent scheduling coach who stays logical and concrete.${financeLayer}
${antiGeneric}
${OUTPUT_RULES}`;

    let messages = [{ role: "system", content: systemContent }];

    const conv = Array.isArray(conversation) ? conversation : [];
    const hasConv = conv.length > 0;
    const hasUserQuestion = Boolean(String(userQuestion || "").trim());

    // Thread turns only (short). Schedule + instructions come in the final user message — avoids duplicating the latest question in both history and prompt.
    if (hasConv) {
      for (const msg of conv) {
        const role = msg.role === "assistant" ? "assistant" : "user";
        const content = String(msg.content || "").trim();
        if (!content) continue;
        messages.push({ role, content });
      }
    }

    // Build pattern insights
    let patternInsights = "";
    if (patterns) {
      patternInsights = `\n\nPatterns I've noticed:
- You typically complete tasks best in the ${patterns.bestTime || 'morning'}
- ${patterns.leastCompletedCategory ? `You tend to skip ${patterns.leastCompletedCategory} tasks` : ''}
- Today you've completed ${patterns.todayCompletions || 0} tasks`;
    }
    
    const notesContext = Array.isArray(notes) && notes.length > 0
      ? `\nUser notes and reflections: ${JSON.stringify(
          notes.map((n) => (typeof n === "object" && n.text != null ? n.text : String(n)))
        )}.
Use these to detect recurring struggles, goals, constraints, or self-observations. If a note is relevant to today's plan, connect it to one concrete suggestion.`
      : "";

    const habitContext =
      Array.isArray(habits) && habits.length > 0
        ? `\n\nHabits (user tracks daily; direction "build" = want to do more, "break" = want to avoid):\n${JSON.stringify(habits)}\nRecent check-in log:\n${String(habitLogSummary || "none")}\nToday's entries: ${JSON.stringify(habitToday || {})}\nUse this when relevant: celebrate small wins, notice patterns, never shame slips on "break" habits.`
        : "";

    const profileBlock =
      userProfile && typeof userProfile === "object" && (userProfile.biggestChallenge || userProfile.bestEnergyTime || userProfile.oneGoal)
        ? `\n\nUser profile (honor when scheduling):\n${JSON.stringify(userProfile)}`
        : "";

    const pacingLines = [];
    if (timeOfDay) pacingLines.push(`Time of day (client local): ${timeOfDay}`);
    if (emotionalState) pacingLines.push(`Inferred load from task shape: ${emotionalState}`);
    if (typeof completedToday === "number" && typeof totalTasks === "number") {
      pacingLines.push(`Completed so far today: ${completedToday} / ${totalTasks}`);
    }
    if (mood) pacingLines.push(`Daily mood field: ${mood}`);
    if (Array.isArray(energyBalance) && energyBalance.length) {
      pacingLines.push(
        `Pacing warnings: ${energyBalance
          .map((w) => (w && typeof w === "object" && w.message ? w.message : JSON.stringify(w)))
          .join(" | ")}`
      );
    }
    const pacingBlock = pacingLines.length ? `\n\n${pacingLines.join("\n")}` : "";

    const categoriesLine =
      Array.isArray(categories) && categories.length ? `\nWorkspace categories: ${categories.join(", ")}.` : "";

    const billsBlock =
      Array.isArray(billsDueSoon) && billsDueSoon.length ? `\nUpcoming bills (soon): ${JSON.stringify(billsDueSoon)}` : "";

    const subsBlock =
      Array.isArray(subscriptions) && subscriptions.length ? `\nSubscriptions (for context): ${JSON.stringify(subscriptions)}` : "";

    const intelBlock = coachIntelligenceText
      ? `\n\nClient-derived intelligence (grounding; do not contradict the schedule JSON):\n${String(coachIntelligenceText).slice(0, 4000)}`
      : "";
    const feedbackBlock = coachFeedbackJson
      ? `\n\nRecent suggestion decisions (local only): ${String(coachFeedbackJson).slice(0, 1500)}`
      : "";

    // Finance context for gentle financial analyst
    const financeContext = hasFinance
      ? `\n\nFinance (use for money questions; be gentle and ADHD-aware):
- Income this month: $${(finance.incomeThisMonth || 0).toFixed(2)}
- Spent this month: $${(finance.spentThisMonth || 0).toFixed(2)}
- Total savings (sum of accounts): $${(finance.totalSavings || 0).toFixed(2)}
- Savings by account: ${(finance.savingsAccounts || []).map((a) => `${a.label}: $${Number(a.amount || 0).toFixed(2)}`).join("; ") || "none"}
- Total debt (sum of debts): $${(finance.totalDebt || 0).toFixed(2)}
- Debts by type: ${(finance.debtAccounts || []).map((a) => `${a.label}: $${Number(a.amount || 0).toFixed(2)}`).join("; ") || "none"}
- Subscriptions: ${(finance.subscriptions || []).map(s => `${s.name} $${s.amount}/${s.cycle === 'yearly' ? 'yr' : 'mo'}`).join(", ") || "none"}
- Wish list: ${(finance.wishList || []).map(w => w.targetAmount != null ? `${w.label} (goal $${w.targetAmount})` : w.label).join("; ") || "none"}
${finance.bankStatementNotes ? `- Bank/statement notes (use to spot biggest issues): ${String(finance.bankStatementNotes).slice(0, 1500)}` : ""}`
      : "";

    // Build the main prompt
    const contextPrompt = `
Day: ${dayKey}${prettyDate ? ` (${prettyDate})` : ""}
Completion: ${progress?.done || 0}/${progress?.total || 0} (${progress?.pct || 0}%)
Today's schedule: ${JSON.stringify(today || {})}
Monthly objectives: ${JSON.stringify(monthly || [])}${patternInsights}${notesContext}${financeContext}${habitContext}${profileBlock}${pacingBlock}${categoriesLine}${billsBlock}${subsBlock}${intelBlock}${feedbackBlock}
`.trim();

    let replyDirective;
    if (hasConv) {
      replyDirective = `Reply to the conversation above. The latest user message is what you are answering now.
Use the schedule JSON below as the single source of truth for today's plan. Anchor every claim in their blocks, tasks, times, or categories — not generic advice.
If the question is ambiguous, state one brief assumption. Return JSON in the schema below.`;
    } else if (hasUserQuestion) {
      replyDirective = `Their message:
${String(userQuestion).trim()}

Use the schedule JSON below. Anchor your answer in their real data (blocks, tasks, times). Return JSON in the schema below.`;
    } else {
      replyDirective = `You are their observant scheduling coach: warm, never shaming, and specific.
Give a brief check-in on today's schedule: name what the data suggests about load or momentum, then one or two concrete moves (order, buffer, deferral) grounded in their hours/categories. Reference patterns when relevant. Avoid generic motivational language. Return JSON in the schema below.`;
    }

    const fullPrompt = `${contextPrompt}

${replyDirective}

Return JSON EXACTLY in this schema (Coach V2):
{
  "message": "${hasConv || hasUserQuestion ? "3-5 sentences: open with observation OR reframing (never banned openers). Then mechanism in plain language, then scheduling moves (move/shrink/swap/buffer/remove) grounded in their JSON." : "2-4 sentences: attune + one clear scheduling angle from their data"}",
  "insight": "one crisp observation tied to their data, or null",
  "highlights": ["2-4 bullets grounded in their data"],
  "followUp": "one optional short grounded question, or null",
  "suggestions": [
    {
      "type": "ADD_TASK",
      "title": "string",
      "description": "optional string",
      "reason": "string",
      "category": "string",
      "energyLevel": "LIGHT|MEDIUM|HEAVY",
      "start": "HH:MM",
      "end": "HH:MM or null",
      "durationMinutes": 15,
      "recurring": false,
      "confidence": 0.82,
      "requiresApproval": true,
      "targetTaskId": null
    }
  ],
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

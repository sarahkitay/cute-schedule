/**
 * Server-side Coach V2 post-parse: enforce CoachContext pacing, strip generic lines,
 * deterministic fallback for missing_from_schedule, append neglected ADD_TASK + health note.
 *
 * @param {Record<string, unknown>} parsed
 * @param {{
 *   coachContext: Record<string, unknown> | null | undefined;
 *   coachReasoningMode?: string | null;
 *   localNowHHMM?: string;
 *   realTodayKey?: string;
 *   categories?: string[];
 *   userQuestion?: string | null;
 * }} opts
 * @returns {{ parsed: Record<string, unknown>; patched: boolean; usedDeterministicMessage: boolean }}
 */
export function validateCoachSpecificity(parsed, opts) {
  if (!parsed || typeof parsed !== "object") {
    return { parsed: parsed || {}, patched: false, usedDeterministicMessage: false };
  }

  const out = cloneCoachParsed(parsed);
  const ctx = opts.coachContext && typeof opts.coachContext === "object" ? opts.coachContext : null;
  const modeRaw = opts.coachReasoningMode;
  const mode =
    typeof modeRaw === "string" && modeRaw.trim() ? modeRaw.trim() : "general_coaching";
  const localNow = normalizeCoachLocalHHMM(opts.localNowHHMM);
  const realToday = String(opts.realTodayKey || "").trim();
  const cats = normalizeCategories(opts.categories);
  const userQ = String(opts.userQuestion || "").toLowerCase();

  const today = ctx?.today && typeof ctx.today === "object" ? ctx.today : null;
  const onPace = today?.isOnPace === true;
  const overdue = Number(today?.overdueTasks ?? 0) || 0;
  const completed = Number(today?.completedTasks ?? 0) || 0;
  const timeBand = String(ctx?.timeOfDay || "");
  const isMorning = timeBand === "morning";
  const pacingNote = String(today?.schedulePacingNote || "").trim();

  const yesterday = ctx?.yesterday && typeof ctx.yesterday === "object" ? ctx.yesterday : null;
  const ySummary = String(yesterday?.summary || "").trim();

  const monthly = ctx?.monthlyObjectives && typeof ctx.monthlyObjectives === "object" ? ctx.monthlyObjectives : null;
  const neglectedArr = Array.isArray(monthly?.neglected) ? monthly.neglected : [];
  const neglected = neglectedArr[0] && typeof neglectedArr[0] === "object" ? neglectedArr[0] : null;
  const neglectedTitle = neglected ? String(neglected.title || "").trim() : "";

  const health = ctx?.health && typeof ctx.health === "object" ? ctx.health : null;
  const healthOpp = String(health?.suggestedProgramOpportunity || "").trim();

  let patched = false;
  let usedDeterministicMessage = false;

  const highlights = Array.isArray(out.highlights) ? out.highlights : [];
  let insight =
    typeof out.insight === "string" ? out.insight : out.insight != null ? String(out.insight) : "";

  function combinedText() {
    return [out.message, insight, ...highlights.map((h) => String(h || ""))].join(" ").toLowerCase();
  }

  const BANNED_RES = [
    /\bonly one task has been completed\b/gi,
    /\bonly \d+ tasks? have been completed\b/gi,
    /\bthis suggests overwhelm\b/gi,
    /\byou may be overwhelmed\b/gi,
    /\byou are behind\b/gi,
    /\byou're behind\b/gi,
    /\byou have a lot on your plate\b/gi,
    /\bprioritize your tasks\b/gi,
    /\bbreak tasks into smaller steps\b/gi,
    /\bstay consistent\b/gi,
    /\bfocus on what matters\b/gi,
    /\btry to stay consistent\b/gi,
  ];

  function stripBannedPhrases(text) {
    let t = String(text || "");
    for (const re of BANNED_RES) {
      re.lastIndex = 0;
      if (re.test(t)) {
        patched = true;
        re.lastIndex = 0;
        t = t.replace(re, "").replace(/\s+/g, " ").trim();
      }
    }
    return t;
  }

  function mentionsNeglectedTitle(text) {
    if (!neglectedTitle) return false;
    const low = String(text || "").toLowerCase();
    const tokens = neglectedTitle
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 2);
    if (tokens.length) return tokens.some((tok) => low.includes(tok));
    return low.includes(neglectedTitle.toLowerCase());
  }

  function mentionsHealth(text) {
    return /\b(workout|gym|program|training|macro|health|lift|cardio|strength|mobility|built-in|progression|fitness|exercise|physio|sample program|running|runner)\b/i.test(
      String(text || "")
    );
  }

  function mentionsProgramUpgradeNote(text) {
    const t = String(text || "");
    return (
      mentionsHealth(t) ||
      t.includes("custom progression plan") ||
      t.includes("On the health side, you've used a built-in program recently")
    );
  }

  function pickCategory() {
    if (cats.includes("Work")) return "Work";
    if (cats.includes("Personal")) return "Personal";
    return cats[0] || "Work";
  }

  function buildNeglectedAddTask(startHHMM) {
    return {
      type: "ADD_TASK",
      title: (String(neglected?.suggestedNextAction || "").trim() || `Move "${neglectedTitle}" forward`).slice(0, 120),
      description: `Small block tied to monthly objective: ${neglectedTitle}`,
      reason: "This monthly objective has not appeared on today's schedule.",
      category: pickCategory(),
      energyLevel: "MEDIUM",
      start: startHHMM,
      end: null,
      durationMinutes: 30,
      recurring: false,
      recurrencePattern: "none",
      targetDayKey: realToday,
      weekPlanLabel: "Today",
      confidence: 0.86,
      requiresApproval: true,
      targetTaskId: null,
    };
  }

  function buildDeterministicMissing() {
    const pacing = pacingNote || "From the clock, nothing is overdue yet.";
    const y = ySummary ? `${ySummary}` : "";
    let msg = `Your schedule does not look behind right now: ${pacing}`;
    if (y) msg += ` ${y}`;
    if (neglectedTitle) {
      const nextAct =
        String(neglected?.suggestedNextAction || "").trim() || `Add a 30–40 minute block on "${neglectedTitle}".`;
      msg += ` What looks missing is direct movement on "${neglectedTitle}". I do not see a task tied to that monthly objective today, so a useful add would be ${nextAct}`;
    } else {
      msg +=
        " If you want sharper traction, name the monthly objective that matters most this month and add one short block tied to it today.";
    }
    if (healthOpp) msg += ` Also, ${healthOpp}`;
    return msg.replace(/\s+/g, " ").trim().slice(0, 4800);
  }

  function hasConcreteAction(textLower, sug) {
    if (sug.some((s) => s && typeof s === "object" && String(s.type || "").toUpperCase() === "ADD_TASK")) return true;
    return /\b(\d+\s*(?:min|minutes)|add (?:a |an )?|block|schedule|slot|slice)\b/i.test(textLower);
  }

  function meetsMissingFromScheduleRequirements(textCombined, sug) {
    const paceSnippet = pacingNote.slice(0, Math.min(24, pacingNote.length)).toLowerCase();
    const hasRecentOrPace =
      /\b(yesterday|recent|last few|past few|this week|pattern|trend|on pace|pace|morning|completion)\b/i.test(
        textCombined
      ) ||
      (paceSnippet.length > 0 && textCombined.includes(paceSnippet));
    const hasNeg = !neglectedTitle || mentionsNeglectedTitle(textCombined);
    const hasConcrete = hasConcreteAction(textCombined, sug);
    return hasRecentOrPace && hasNeg && hasConcrete;
  }

  const BANNED_IN_MESSAGE = [
    /only one task has been completed/i,
    /this suggests overwhelm/i,
    /you may be overwhelmed/i,
    /\byou are behind\b/i,
    /you're behind/i,
    /you have a lot on your plate/i,
    /prioritize your tasks/i,
    /break tasks into smaller steps/i,
    /stay consistent/i,
    /focus on what matters/i,
  ];

  function stillHasBannedMessage(msg) {
    const m = String(msg || "");
    for (const re of BANNED_IN_MESSAGE) {
      re.lastIndex = 0;
      if (re.test(m)) return true;
    }
    return false;
  }

  // 1) Strip banned phrases
  out.message = stripBannedPhrases(String(out.message || ""));
  insight = stripBannedPhrases(insight);
  for (let i = 0; i < highlights.length; i++) {
    if (typeof highlights[i] === "string") highlights[i] = stripBannedPhrases(highlights[i]);
  }

  // 2) On pace + no overdue: remove behind/overwhelm framing
  if (onPace && overdue === 0) {
    const reBehind = /\b(behind schedule|feeling behind|you are behind|you're behind|overwhelmed|overwhelm)\b/gi;
    if (reBehind.test(out.message)) {
      patched = true;
      out.message = out.message.replace(reBehind, "").replace(/\s+/g, " ").trim();
      if (pacingNote && !out.message.toLowerCase().includes(pacingNote.slice(0, 20).toLowerCase())) {
        out.message = `${pacingNote} ${out.message}`.trim();
      }
    }
  }

  // 3) Morning + low completion: soften "only … completed" patterns
  if (isMorning && completed <= 2 && onPace && overdue === 0) {
    const reOnly = /\bonly\s+\d+\s+tasks?\s+(?:ha(?:s|ve) been|is|are)\s+completed\b/gi;
    if (reOnly.test(out.message)) {
      patched = true;
      out.message = out.message.replace(reOnly, "For this time of day, that does not look behind yet");
    }
  }

  // 4) Append ADD_TASK for top neglected objective if not already suggested (before specificity check)
  if (neglectedTitle && realToday && /^\d{4}-\d{2}-\d{2}$/.test(realToday)) {
    const sug = out.suggestions;
    const already = sug.some((s) => {
      if (!s || typeof s !== "object" || String(s.type || "").toUpperCase() !== "ADD_TASK") return false;
      const blob = `${s.title || ""} ${s.reason || ""} ${s.description || ""}`.toLowerCase();
      return mentionsNeglectedTitle(blob);
    });
    if (!already) {
      const start = coerceStartStrictlyAfterLocalNow(nextQuarterHourStartAfterLocalNow(localNow), localNow);
      sug.push(buildNeglectedAddTask(start));
      patched = true;
    }
  }

  const combined = combinedText();
  const genericFail =
    mode === "missing_from_schedule" &&
    (!meetsMissingFromScheduleRequirements(combined, out.suggestions) || stillHasBannedMessage(out.message));

  if (genericFail) {
    out.message = buildDeterministicMissing();
    usedDeterministicMessage = true;
    patched = true;
  }

  // 5) Fixed health / program upgrade note only when server context flags an opportunity (never without healthOpp)
  const healthQuestionRelevant =
    mode === "health_programming" ||
    mode === "missing_from_schedule" ||
    mode === "daily_planning" ||
    mode === "schedule_check" ||
    mode === "monthly_objective_alignment" ||
    /\b(schedule|missing|plan|today|health|workout|days|what|last few|add)\b/i.test(userQ);

  const PROGRAM_NOTE =
    "On the health side, you've used a built-in program recently, so the next useful upgrade may be choosing a goal and building a custom progression plan.";

  const healthBlob = `${out.message} ${insight} ${highlights.join(" ")}`;
  if (healthOpp && healthQuestionRelevant && !mentionsProgramUpgradeNote(healthBlob)) {
    if (mode === "health_programming") {
      if (!out.message.startsWith("On the health side, you've used a built-in program")) {
        out.message = `${PROGRAM_NOTE} ${out.message.trim()}`.trim();
        patched = true;
      }
    } else if (!out.message.includes("On the health side, you've used a built-in program recently")) {
      out.message = `${out.message.trim()} ${PROGRAM_NOTE}`.trim();
      patched = true;
    }
  }

  out.highlights = highlights;
  out.insight = insight.trim() ? insight.trim() : null;
  ensureCoachV2Shape(out);
  return { parsed: out, patched, usedDeterministicMessage };
}

/** @param {unknown} raw */
export function normalizeCoachLocalHHMM(raw) {
  if (raw == null) return "09:00";
  const s = String(raw).trim();
  if (!s) return "09:00";
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "09:00";
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return "09:00";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function minutesFromHHMM(hhmm) {
  const norm = normalizeCoachLocalHHMM(hhmm);
  const [h, m] = norm.split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}

function formatHMM(total) {
  const capped = Math.max(0, Math.min(24 * 60 - 1, total));
  const h = Math.floor(capped / 60);
  const m = capped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Next clock time strictly after `normalizedHHMM`, preferring quarter-hour boundaries.
 * Never returns a time at or before the local "now" minute.
 */
export function nextQuarterHourStartAfterLocalNow(normalizedHHMM) {
  const normalized = normalizeCoachLocalHHMM(normalizedHHMM);
  const nowM = minutesFromHHMM(normalized);
  let cand = Math.ceil((nowM + 1) / 15) * 15;
  if (cand < 24 * 60 && cand > nowM) return formatHMM(cand);
  cand = Math.floor(nowM / 15) * 15 + 15;
  while (cand < 24 * 60) {
    if (cand > nowM) return formatHMM(cand);
    cand += 15;
  }
  const lastMinuteOfDay = 24 * 60 - 1;
  if (lastMinuteOfDay > nowM) return formatHMM(lastMinuteOfDay);
  return formatHMM(nowM);
}

/** @param {string} start @param {string} localNorm */
function coerceStartStrictlyAfterLocalNow(start, localNorm) {
  const s = normalizeCoachLocalHHMM(start);
  const ln = normalizeCoachLocalHHMM(localNorm);
  if (minutesFromHHMM(s) > minutesFromHHMM(ln)) return s;
  return nextQuarterHourStartAfterLocalNow(ln);
}

/** @param {unknown} categories */
function normalizeCategories(categories) {
  if (!Array.isArray(categories) || categories.length === 0) return ["Work", "Personal"];
  const cleaned = categories.map((c) => String(c || "").trim()).filter(Boolean);
  return cleaned.length ? cleaned : ["Work", "Personal"];
}

/** Deep clone plain JSON coach payload (never mutate caller's object). */
function cloneCoachParsed(parsed) {
  try {
    if (typeof structuredClone === "function") return structuredClone(parsed);
  } catch {
    /* fall through */
  }
  try {
    return JSON.parse(JSON.stringify(parsed));
  } catch {
    return {
      ...parsed,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.map((s) => (s && typeof s === "object" ? { ...s } : s))
        : [],
      highlights: Array.isArray(parsed.highlights) ? [...parsed.highlights] : [],
      ignoredMonthlies: Array.isArray(parsed.ignoredMonthlies)
        ? parsed.ignoredMonthlies.map((m) => (m && typeof m === "object" ? { ...m } : m))
        : [],
    };
  }
}

/** Ensure Coach V2 JSON fields exist for the client parser. */
function ensureCoachV2Shape(out) {
  if (typeof out.message !== "string") out.message = String(out.message ?? "");
  if (!("insight" in out) || out.insight === undefined) out.insight = null;
  else if (out.insight !== null && typeof out.insight !== "string") out.insight = String(out.insight);
  if (!Array.isArray(out.highlights)) out.highlights = [];
  if (!("followUp" in out) || out.followUp === undefined) out.followUp = null;
  else if (out.followUp !== null && typeof out.followUp !== "string") out.followUp = String(out.followUp);
  if (!Array.isArray(out.suggestions)) out.suggestions = [];
  if (!Array.isArray(out.ignoredMonthlies)) out.ignoredMonthlies = [];
  if (typeof out.percentSummary !== "string") {
    out.percentSummary = out.percentSummary != null ? String(out.percentSummary) : "";
  }
}

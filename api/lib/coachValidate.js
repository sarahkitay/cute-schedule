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
 *   conversation?: Array<{ role?: string; content?: string }> | null;
 * }} opts
 * @returns {{ parsed: Record<string, unknown>; patched: boolean; usedDeterministicMessage: boolean }}
 */
/**
 * True when the user is clearly asking for a saveable workout program draft.
 * Used by the API prompt (mandatory ADD_WORKOUT_PROGRAM) and by the validator fallback.
 * @param {string | null | undefined} userQuestion
 * @param {string | null | undefined} coachReasoningMode
 */
/**
 * Merge standalone `userQuestion` with the latest user turn in `conversation` so
 * program-intent survives when the client sends the thread without duplicating the last line in `userQuestion`.
 * @param {string | null | undefined} userQuestion
 * @param {Array<{ role?: string; content?: string }> | null | undefined} conversation
 */
export function buildProgramDraftDetectionText(userQuestion, conversation) {
  const q = String(userQuestion || "").trim();
  if (!Array.isArray(conversation) || conversation.length === 0) return q;
  for (let i = conversation.length - 1; i >= 0; i--) {
    const row = conversation[i];
    if (row && row.role === "user") {
      const last = String(row.content || "").trim();
      if (q && last && q !== last) return `${q}\n${last}`;
      return last || q;
    }
  }
  return q;
}

export function userWantsWorkoutProgramDraft(userQuestion, coachReasoningMode) {
  const q = String(userQuestion || "").toLowerCase().trim();
  if (!q) return false;
  if (/\b(python|javascript|typescript|java|kotlin|swift|ruby|rails|npm|react|vue|angular|code|software|script|curriculum|syllabus)\b/.test(q)) {
    return false;
  }

  const wantsW =
    /\b(write|draft|create|build|give me|make me|design|plan|suggest|show me|generate|outline|map out|help me(?: with| to)?|come up with|put together|need a|want a|could you|can you|i need|i want|walk me through)\b/i.test(q) &&
    /\b(program|workout|routine|exercises?|split|session|lifts?|training)\b/i.test(q);

  const bodyFocus =
    /\b(glute|glutes|leg day|legs|push day|pull day|push pull|upper body|lower body|full body|total body|core day|abs|chest day|back day|arm day|\barms?\b|biceps?|triceps?|forearm|shoulders?|delts|chest|pecs?|lats?|traps?|calves?|quads?|hamstrings?|adductors?|hiit|tabata|cardio|conditioning|mobility|warm[\s-]?up)\b/i.test(q);

  const wantsF =
    bodyFocus && /\b(workout|program|routine|session|split|exercises?|plan|day|training|lifts?|lift)\b/i.test(q);

  const casualMoveList =
    /\b(what (?:are|is)|good |best |favorite |favourite |go-to|goto|ideas for |examples? of )\b/i.test(q) &&
    bodyFocus &&
    /\b(exercises?|movements?|moves|drills|lifts?)\b/i.test(q);

  const topicTitle =
    /\b(arms?|biceps?|triceps?|legs?|glutes?|chest|back|shoulders?|core|abs|full body|upper|lower|push|pull|cardio|hiit)\b/i.test(q) &&
    /\b(program|workout|routine|split|session)\b/i.test(q);

  const asked = wantsW || wantsF || casualMoveList || topicTitle;
  if (!asked) return false;

  const mode = String(coachReasoningMode || "").trim();
  if (mode === "health_programming") return true;
  if (topicTitle) return true;
  return /\b(workout|gym|training|lift|lifting|exercises?|muscles?|reps|sets|hypertrophy|leg day|arm day|push day|pull day|bodybuilding|macros|protein)\b/i.test(q);
}

function coachUserWantsProgramDraft(userQ, mode) {
  return userWantsWorkoutProgramDraft(userQ, mode);
}

/** Model text promised a saveable program but may have omitted JSON suggestions. */
function messagePromisesSavedProgram(message) {
  const m = String(message || "").toLowerCase();
  if (!m) return false;
  const verb = /\b(add|adding|save|draft|build|create|put|log|slot|schedule|proposal|propose|we'll|we will|let's|let us)\b/.test(m);
  const noun = /\b(workout program|leg day program|arm program|training program|gym program|program to your plan|structured .*program|program under health|my programs)\b/.test(m);
  const lets = /\b(let's|let us)\b/.test(m) && /\badd\b/.test(m) && /\b(program|leg day|workout|training)\b/.test(m);
  return (verb && noun) || lets;
}

function messagePromisesWorkoutBlock(message) {
  const m = String(message || "").toLowerCase();
  if (!m) return false;
  return /\b(workout block|gym block|training block)\b/.test(m) && /\b(add|adding|let's|let us|schedule|slot|calendar|put|log)\b/.test(m);
}

function hasWorkoutishAddTask(sug) {
  return sug.some((s) => {
    if (!s || typeof s !== "object") return false;
    if (String(s.type || "").toUpperCase() !== "ADD_TASK") return false;
    const blob = `${s.title || ""} ${s.reason || ""} ${s.description || ""}`.toLowerCase();
    return /\b(workout|gym|leg day|training|lift|strength|squat|deadlift|cardio|hiit|session)\b/.test(blob);
  });
}

function countWorkoutProgramExerciseLines(s) {
  if (!s || typeof s !== "object") return 0;
  const ex = Array.isArray(s.exercises) ? s.exercises : [];
  let n = ex.filter((x) => typeof x === "string" && x.trim().length > 3).length;
  const wp = s.workoutProgram && typeof s.workoutProgram === "object" ? s.workoutProgram : null;
  if (wp && Array.isArray(wp.exercises)) {
    n = Math.max(n, wp.exercises.filter((x) => typeof x === "string" && x.trim().length > 3).length);
  }
  if (wp && Array.isArray(wp.exerciseLines)) {
    n = Math.max(n, wp.exerciseLines.filter((x) => typeof x === "string" && x.trim().length > 3).length);
  }
  return n;
}

function hasAddWorkoutProgramWithBody(sug) {
  return sug.some((s) => {
    if (!s || typeof s !== "object") return false;
    const t = String(s.type || "").toUpperCase().replace(/-/g, "_");
    if (t === "ADD_WORKOUT_PROGRAM") return countWorkoutProgramExerciseLines(s) >= 4;
    if (t === "ADD_TASK" && s.workoutProgram && typeof s.workoutProgram === "object") {
      return countWorkoutProgramExerciseLines(s) >= 4;
    }
    return false;
  });
}

function stripWeakWorkoutPrograms(sug) {
  return sug.filter((s) => {
    if (!s || typeof s !== "object") return true;
    if (String(s.type || "").toUpperCase().replace(/-/g, "_") !== "ADD_WORKOUT_PROGRAM") return true;
    return countWorkoutProgramExerciseLines(s) >= 4;
  });
}

function defaultAddWorkoutProgramForUserQuestion(userQ) {
  const q = String(userQ || "").toLowerCase();
  let name = "Coach session - full body";
  let reason =
    "Starter split you can save under Health → My programs; tweak loads to match your gym or home setup.";
  let exercises = [
    "Goblet squat warm-up 2×12 light",
    "Dumbbell Romanian deadlift 3×8–10",
    "Push-up or incline bench 3×8–12",
    "One-arm row 3×8 each arm",
    "Plank shoulder taps 3×8 each side",
    "Farmer carry 2×30 steps",
  ];
  if (/\b(glute|glutes|hips|hip thrust)\b/.test(q)) {
    name = "Glute-focused session";
    exercises = [
      "Banded glute bridges 3×15",
      "Barbell or dumbbell hip thrust 4×8–10",
      "Romanian deadlift 3×8–10",
      "Bulgarian split squat 3×8 each leg",
      "Cable pull-through 3×12",
      "Side-lying clamshell 2×15 each side",
    ];
  } else if (/\barm|\barms\b|bicep|tricep|curl|extension|hammer|preacher|skull|skullcrusher/.test(q)) {
    name = "Arm session - biceps + triceps";
    exercises = [
      "Cable or barbell curl 3×10–12",
      "Incline dumbbell curl 3×10 each",
      "Hammer curl 3×10–12",
      "Rope pushdown 3×12–15",
      "Overhead cable or DB extension 3×10–12",
      "EZ-bar skull crusher 3×8–10",
      "Wrist curl + reverse wrist curl 2×15 each",
    ];
  } else if (/\bpush\b|chest day|shoulder day|delts|\bohp\b|overhead press/.test(q)) {
    name = "Push session - chest, shoulders, triceps";
    exercises = [
      "Incline DB or barbell press 4×6–10",
      "Flat bench or push-up 3×8–12",
      "Seated or standing overhead press 3×8–10",
      "Lateral raise 3×12–15",
      "Cable fly or pec deck 3×12–15",
      "Rope pushdown 3×12–15",
    ];
  } else if (/\bpull\b|row day|lat|rear delt/.test(q)) {
    name = "Pull session - back, biceps";
    exercises = [
      "Dead hang or assisted pull-up 4×6–8",
      "Chest-supported row or one-arm row 3×8 each",
      "Lat pulldown or straight-arm pulldown 3×10–12",
      "Face pull or rear-delt fly 3×15–20",
      "Hammer curl 3×10–12",
      "Farmer carry 2×40 steps",
    ];
  } else if (/\bchest|pec/.test(q)) {
    name = "Chest emphasis";
    exercises = [
      "Barbell or DB bench press 4×6–8",
      "Incline press 3×8–10",
      "Weighted dip or bench dip 3×8–12",
      "Cable fly 3×12–15",
      "Push-up mechanical drop set 2×AMRAP",
    ];
  } else if (/\bshoulder|delts|\bohp\b/.test(q)) {
    name = "Shoulder session";
    exercises = [
      "Band pull-apart 2×20",
      "Seated DB overhead press 4×6–10",
      "Arnold press 3×8–10",
      "Lateral raise 3×12–15",
      "Rear-delt fly 3×12–15",
      "Shrug 3×12–15",
    ];
  } else if (/\bcore|abs|oblique/.test(q)) {
    name = "Core session";
    exercises = [
      "Dead bug 3×8 each side",
      "Pallof press 3×10 each side",
      "Side plank 3×30–45s each",
      "Hanging knee raise or cable crunch 3×10–15",
      "Farmer carry 2×40 steps",
    ];
  } else if (/\bhiit|tabata|conditioning|metcon/.test(q)) {
    name = "HIIT / conditioning circuit";
    exercises = [
      "Bike or row warm-up 5 min easy",
      "Kettlebell swing 5×15",
      "Goblet squat 5×12",
      "Push-up 5×10",
      "Battle rope or high knees 5×30s on / 30s off",
      "Walk 3 min easy cooldown",
    ];
  } else if (/\bfull body|total body/.test(q)) {
    name = "Full-body strength";
    exercises = [
      "Goblet squat or leg press 3×10–12",
      "Romanian deadlift 3×8–10",
      "Bench or push-up 3×8–12",
      "One-arm row 3×8 each",
      "Half-kneeling landmine press 3×8 each",
      "Plank 3×40s",
    ];
  } else if (/\bupper\b|\blat\b|\bpull-up|pulldown/.test(q)) {
    name = "Upper-body session (pull emphasis)";
    exercises = [
      "Dead hang or assisted pull-up 4×6–8",
      "Lat pulldown 3×10",
      "One-arm dumbbell row 3×8 each",
      "Face pulls 3×15",
      "Hammer curl 3×10",
      "Plank 2×45s",
    ];
  } else if (/\bleg|squat|quad|hamstring/.test(q)) {
    /** Intentionally different from built-in `sample_leg` (Leg day) so coach fallbacks are not duplicates. */
    name = "Lower-body strength B (coach draft)";
    reason =
      "Coach draft (not the built-in Leg day sample): different exercise choices; save under Health → My programs and tweak loads for your equipment.";
    exercises = [
      "Front squat or safety-bar squat 3×5–8",
      "Pause squat (2s) or tempo back squat 3×4–6",
      "Deficit Romanian deadlift or good morning 3×8–10",
      "Single-leg leg press or high box step-up 3×10 each",
      "Nordic hamstring curl (assisted) or slow RDL 3×5–8",
      "Seated or single-leg calf raise 4×12–15 each",
    ];
  }
  return {
    type: "ADD_WORKOUT_PROGRAM",
    name,
    reason,
    exercises,
    requiresApproval: true,
    confidence: 0.72,
  };
}

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
  const programBlend = buildProgramDraftDetectionText(opts.userQuestion, opts.conversation).toLowerCase();

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
    /\bbased on your (?:schedule|calendar|day)\b/gi,
    /\bgiven your (?:busy )?(?:schedule|day|calendar)\b/gi,
    /\blooking at your schedule\b/gi,
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

  function buildWorkoutBlockAddTask(startHHMM, blendLower) {
    const b = String(blendLower || "");
    let title = "Gym / strength - 45 min";
    if (/\barm|bicep|tricep/.test(b)) title = "Arms - gym block (45 min)";
    else if (/\bchest|pec/.test(b)) title = "Chest - gym block (45 min)";
    else if (/\bback|pull|lat\b/.test(b)) title = "Back / pull - gym block (45 min)";
    else if (/\bpush\b|shoulder|delts|\bohp\b/.test(b)) title = "Push / shoulders - gym block (45 min)";
    else if (/\bleg|squat|quad|hamstring|glute|lower body|\brdl\b|deadlift/.test(b)) title = "Leg day - gym block (45 min)";
    const cat = cats.includes("Personal") ? "Personal" : pickCategory();
    return {
      type: "ADD_TASK",
      title,
      description: "Warm up 5–10 min, then run your saved program or approve the coach draft below.",
      reason: "Your coach reply mentioned adding a workout block; this is a concrete calendar slot you can approve.",
      category: cat,
      energyLevel: "HEAVY",
      start: startHHMM,
      end: null,
      durationMinutes: 45,
      recurring: false,
      recurrencePattern: "none",
      targetDayKey: realToday,
      weekPlanLabel: "Today",
      confidence: 0.78,
      requiresApproval: true,
      targetTaskId: null,
    };
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
    if (
      sug.some((s) => {
        if (!s || typeof s !== "object") return false;
        const t = String(s.type || "").toUpperCase().replace(/-/g, "_");
        return t === "ADD_TASK" || t === "ADD_WORKOUT_PROGRAM";
      })
    )
      return true;
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

  // 4b) Message repair: model promised program / block without JSON - run before user-intent (4c) so we
  // can emit one bundled ADD_TASK when both are promised (avoids orphan calendar block + separate program).
  const blendForDefaults = `${programBlend} ${String(out.message || "").toLowerCase().slice(0, 500)}`.trim();
  const wantsProgRepair = messagePromisesSavedProgram(out.message) && !hasAddWorkoutProgramWithBody(out.suggestions);
  const wantsBlockRepair = messagePromisesWorkoutBlock(out.message) && !hasWorkoutishAddTask(out.suggestions);

  if (wantsProgRepair && wantsBlockRepair) {
    out.suggestions = stripWeakWorkoutPrograms(out.suggestions);
    const prog = defaultAddWorkoutProgramForUserQuestion(blendForDefaults);
    const startW = coerceStartStrictlyAfterLocalNow(nextQuarterHourStartAfterLocalNow(localNow), localNow);
    const row = buildWorkoutBlockAddTask(startW, blendForDefaults);
    row.workoutProgram = { name: prog.name, exerciseLines: prog.exercises.map((x) => String(x)) };
    row.title = `${prog.name} + calendar`;
    row.description =
      "One Approve: saves this program under Health → My programs and adds this workout block linked to it (taskType workout + program).";
    row.reason =
      "The coach message offered both a program and a calendar block; this card does both so nothing is left unattached.";
    out.suggestions.push(row);
    patched = true;
  } else if (wantsProgRepair) {
    out.suggestions = stripWeakWorkoutPrograms(out.suggestions);
    out.suggestions.push(defaultAddWorkoutProgramForUserQuestion(blendForDefaults));
    patched = true;
  } else if (wantsBlockRepair && !hasAddWorkoutProgramWithBody(out.suggestions)) {
    const startW = coerceStartStrictlyAfterLocalNow(nextQuarterHourStartAfterLocalNow(localNow), localNow);
    out.suggestions.push(buildWorkoutBlockAddTask(startW, blendForDefaults));
    patched = true;
  }

  // 4c) User asked for a workout program draft; ensure a concrete program row exists if still missing
  if (coachUserWantsProgramDraft(programBlend, mode) && !hasAddWorkoutProgramWithBody(out.suggestions)) {
    out.suggestions = stripWeakWorkoutPrograms(out.suggestions);
    out.suggestions.push(defaultAddWorkoutProgramForUserQuestion(programBlend));
    patched = true;
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

  const programDraftAsk = userWantsWorkoutProgramDraft(programBlend, mode);
  const healthBlob = `${out.message} ${insight} ${highlights.join(" ")}`;
  if (
    healthOpp &&
    healthQuestionRelevant &&
    !mentionsProgramUpgradeNote(healthBlob) &&
    !hasAddWorkoutProgramWithBody(out.suggestions) &&
    !programDraftAsk
  ) {
    if (mode !== "health_programming" && !out.message.includes("On the health side, you've used a built-in program recently")) {
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

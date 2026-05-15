// The Gentle Anchor - AI Coach System
// Core personality: Calm, Observant, Emotionally Intelligent

export function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "late-night";
}

export function inferEmotionalState(tasks, timeOfDay) {
  const completed = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const incomplete = tasks.filter((t) => !t.done);
  const heavyUndone = incomplete.filter((t) => t.energyLevel === "HEAVY").length;
  const completionRate = total > 0 ? completed / total : 0;

  if (timeOfDay === "late-night") return "closing";
  if (heavyUndone >= 3) return "overloaded";
  if (completionRate < 0.3 && total > 5) return "drained";
  if (heavyUndone >= 1 && completed === 0 && total <= 5 && total > 0) return "avoidant";
  if (completionRate > 0.7 && total > 0) return "focused";
  return "gentle";
}

/** @typedef {'supportive' | 'matter-of-fact' | 'funny' | 'harsh'} CompletionAffirmationTone */

const TONE_IDS = ["supportive", "matter-of-fact", "funny", "harsh"];

/**
 * @param {unknown} _task
 * @param {unknown} _category
 * @param {number} completedToday
 * @param {string} energyLevel
 * @param {string} emotionalState
 * @param {CompletionAffirmationTone} [tone]
 */
export function generateCompletionMessage(_task, _category, completedToday, energyLevel, emotionalState, tone = "supportive") {
  const t = TONE_IDS.includes(tone) ? tone : "supportive";
  const E = energyLevel === "LIGHT" || energyLevel === "HEAVY" ? energyLevel : "MEDIUM";

  /** @type {Record<CompletionAffirmationTone, Record<string, string[]>>} */
  const pools = {
    supportive: {
      LIGHT: [
        "Nice. That one didn't take much, but it still counts.",
        "Done. Simple as that.",
        "Quick win. Noted.",
      ],
      MEDIUM: [
        "You showed up and followed through.",
        "That's done. You handled it.",
        "You completed it. Good.",
      ],
      HEAVY: [
        "That was a heavy one. Take a breath. You earned it.",
        "Heavy task completed. You're stronger than you think.",
        "That took something from you. Rest is okay now.",
      ],
    },
    "matter-of-fact": {
      LIGHT: ["Done.", "Complete.", "Checked off.", "Finished."],
      MEDIUM: ["Task complete.", "That's done.", "Marked complete.", "One item cleared."],
      HEAVY: ["Hard one done.", "Heavy task complete.", "Finished. Pause if you need to.", "Done. That cost energy."],
    },
    funny: {
      LIGHT: ["Boom. Easiest boss fight of the day.", "Speedrun any%.", "So fast the list blinked.", "That task never stood a chance."],
      MEDIUM: ["Another one bites the dust. (Respectfully.)", "The to-do list just took an L.", "Task defeated. XP gained.", "You vs. task: you won. Obviously."],
      HEAVY: ["That was the final level energy. You still cleared it.", "Beast mode: engaged. Beast mode: tired now.", "Big task down. Treat yourself like a houseplant: water and light.", "You wrestled a bear. The bear was paperwork. You still won."],
    },
    harsh: {
      LIGHT: ["Finally. That one was barely a warm-up.", "Done. Don't act surprised, you were supposed to.", "Checked off. Next.", "Easy mode. Still counts."],
      MEDIUM: ["Done. The bar was on the floor and you cleared it anyway.", "One down. The rest are still watching.", "Finished. Don't coast; stack another.", "Complete. discipline > motivation."],
      HEAVY: ["That one hurt. Good. Growth rarely feels cozy.", "Brutal task. You didn't negotiate with it; you finished it.", "Hard win. Now stop acting like you didn't earn a breather.", "Done. That was ugly work. Ugly work still builds."],
    },
  };

  const baseMessages = pools[t][E] || pools[t].MEDIUM;
  let message = baseMessages[Math.floor(Math.random() * baseMessages.length)];

  const suffix = {
    supportive: {
      overloaded: " Clearing even one thing when you're overloaded matters.",
      drained: " Momentum can be quiet. This still moves you forward.",
      closing: " Late-day wins count the same as morning ones.",
      avoidant: " Starting can be the hardest part when something feels weighty.",
      focusedStack: " You're stacking real progress.",
      enoughToday: " You did enough for today.",
    },
    "matter-of-fact": {
      overloaded: " One less item on a long list.",
      drained: " Still forward.",
      closing: " Timestamp doesn't change the outcome.",
      avoidant: " Motion started.",
      focusedStack: " Count it.",
      enoughToday: " Consider pausing if the list is long.",
    },
    funny: {
      overloaded: " Your brain had seventeen tabs open; you closed one.",
      drained: " Low battery mode, still shipped.",
      closing: " Night shift MVP.",
      avoidant: " You touched the scary thing. It was paper.",
      focusedStack: " You're on a streak. Hydrate.",
      enoughToday: " Hero arc needs a snack break.",
    },
    harsh: {
      overloaded: " Stop marinating in guilt. Use the win.",
      drained: " Tired isn't an excuse; you still executed.",
      closing: " Late doesn't mean lazy if it's done.",
      avoidant: " You stopped negotiating with the task. Good.",
      focusedStack: " Don't get cocky; stay consistent.",
      enoughToday: " Quit while you're ahead before you overfill the day.",
    },
  };

  const S = suffix[t];
  if (emotionalState === "overloaded") message += S.overloaded;
  else if (emotionalState === "drained") message += S.drained;
  else if (emotionalState === "closing") message += S.closing;
  else if (emotionalState === "avoidant") message += S.avoidant;
  else if (emotionalState === "focused" && completedToday >= 2) message += S.focusedStack;

  if (completedToday >= 3 && emotionalState !== "focused") message += S.enoughToday;

  return message;
}

export function generateReminderMessage(timeOfDay, _taskCount) {
  const messages = {
    morning: "When you're ready, here's what you planned for today.",
    afternoon: "Quick check-in. Do you want to keep going or slow it down?",
    evening: "Anything you want to wrap up, or are we closing the day?",
    "late-night": "You don't need to finish anything tonight."
  };
  
  return messages[timeOfDay] || messages.morning;
}

export function generateMissedTaskMessage(delayCount, _task) {
  if (delayCount === 1) {
    return "Today shifted. Want to move this or soften it?";
  } else if (delayCount >= 2) {
    return "This keeps asking for more energy than it has. We can change the plan.";
  }
  return "Nothing is wrong. Plans change. What would help?";
}

export function generateReleaseMessage() {
  const messages = [
    "Letting go is also a choice.",
    "Released. That's okay.",
    "You chose to release it. That's valid.",
    "Some things don't need to happen. This might be one."
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

export function generateWindDownMessage(allDone) {
  if (allDone) {
    return {
      quote: "The day is complete.\nYou carried what you could.\nThe rest can wait.",
      tone: "poetic"
    };
  }
  return {
    quote: "It's okay to stop.\nRest is not a reward.\nYou are allowed to pause.",
    tone: "poetic"
  };
}

export const GROUNDING_QUOTES = [
  "The list is longer than your current bandwidth sometimes. That is information, not a verdict.",
  "Two heavy tasks still open can make the whole day feel louder than it is.",
  "Nothing you did today was wasted.",
  "Consistency is quiet.",
  "Progress happens in pauses too.",
  "Enough is a decision.",
  "Small steps still move you forward.",
  "You can change the shape of the day without proving anything.",
  "What you already moved counts when you recalibrate what is realistic next.",
  "Softness is not weakness.",
  "Tomorrow is another day.",
  "The calendar is a tool, not a scoreboard.",
  "One honest next step beats a heroic fantasy list."
];

export function getRandomQuote() {
  return GROUNDING_QUOTES[Math.floor(Math.random() * GROUNDING_QUOTES.length)];
}

// System prompt for AI coach (sent to /api/coach as systemPrompt; keep in sync with server fallbacks in api/coach.js)
export const GENTLE_ANCHOR_PROMPT = `
You are "The Gentle Anchor": a calm, emotionally intelligent planning companion who is also sharp at prioritization.

Core stance:
- Regulate first, plan second.
- Be warm, but not generic.
- Be observant, not lofty.
- Prefer clarity over comfort-talk.
- Prefer one realistic move over a long list.

What you do:
- Read the user's real schedule, completion count, task weight, timing, categories, habits, notes, and patterns.
- Name what the data suggests about load, momentum, friction, or pacing.
- Offer one clear next move, and optionally one backup.
- When load is high, think in tradeoffs: defer, shrink, swap, buffer, or stop.
- When the user is stuck, reduce activation energy before offering ambition.
- When the day is nearly done, protect closure and rest.

Notes and profile (recurring struggles):
- If notes or profile data mention a recurring struggle, use that context when shaping advice for the day.
- Examples:
  - If the user mentions trouble waking up early, consider bedtime, first-task difficulty, and morning load.
  - If the user mentions overwhelm, reduce activation energy and shrink the first step.
  - If the user mentions avoidance, suggest one visible starter action rather than a full plan.
- When relevant, connect today's schedule to the struggle in one specific, practical way.

Emotional stance:
- Never shame, push, or moralize.
- Validate briefly, then orient.
- If you mention a feeling, tie it to evidence in the schedule.
- Do not overuse reassurance phrases.
- Do not lean on the same pattern statistic every message (e.g. "you usually do better in the morning"). Mention timing tendencies only when it genuinely changes the plan; otherwise stay conversational and specific to what they just said.
- Do not sound like a therapist, wellness influencer, or inspirational quote account.

Language rules:
- Use short, grounded sentences.
- Use one question at a time, or none.
- Avoid: should, fail, behind, overdue, optimize, crush it, grind, maximize.
- Prefer phrases like: "Here's what the schedule shows", "What feels doable", "We can adjust", "This may be a lighter move", "That looks like a lot for one day".
- Most replies should feel specific enough that they could only apply to this user on this day.
- Do not start replies with: "To help you", "You can try", "Consider", "It's important to", "In order to". Start with an observation about their plan or a reframing.

Advice discipline (when they ask for help):
- Do not give generic lifestyle tips. Interpret what their schedule shape is likely doing first, then name a simple mechanism, then suggest moves in scheduling language: move, shrink, swap, buffer, remove tasks, tied to blocks and times they actually have.
- When the app sends finance snapshots, health/training summaries, habits, or notes alongside the schedule, use those as first-class inputs: cite real numbers or labels so the reply could not apply to a random stranger.
- Avoid vague wellness phrasing: "create a routine", "try to relax", "calming activities" without naming a concrete task (e.g. 10 min plan tomorrow, journal, light reset, low-effort admin, reading).
- Sleep / waking / fatigue: treat late heavy tasks, missing low-effort final block, and open loops at night as structural; reframe the last 1–2 hours toward lower activation, not generic sleep hygiene.
- When a concrete addable step fits, you may describe 1–3 tiny tasks the product could add if the user approves (category + time + short label).

Style by context:
- Morning: orienting, steady, lightly energizing.
- Afternoon: practical, reducing noise, protecting momentum.
- Evening: selective, realistic, less ambitious.
- Late night: closing, permission-giving, minimal.

Additional behavior rules:
- Prefer observations tied to the user's actual schedule over generic reassurance.
- Do not repeat the same reassurance twice in different wording.
- When possible, include one concrete tradeoff: defer, shrink, swap, buffer, or stop.
- Avoid sounding lofty, mystical, or overly poetic unless the user is winding down at night.
- Keep most replies under 120 words unless the user asks a deeper question.

Structured replies (Coach V2):
- The host app expects JSON with: message, insight (one grounded observation or null), highlights, followUp (or null), suggestions (typed objects with type, title, reason, category, energyLevel, start, durationMinutes, recurring, confidence, requiresApproval), ignoredMonthlies, percentSummary.
- Suggestions must stay optional and never invent obligations unrelated to their notes, schedule, finance, or stated goals.
- Workout programs (ADD_WORKOUT_PROGRAM): use a specific title (e.g. "Arms - volume + pump"), 5-8 real exercise lines with sets/reps, and a "message" that opens with their stated goal or one fact from their health summary - never "Based on your schedule" or "Given your day" unless you immediately tie it to a named task and time.

You prefer less but done over more but stressed.
`;

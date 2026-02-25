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
  const completed = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const heavyCount = tasks.filter(t => t.energyLevel === "HEAVY" && !t.done).length;
  const completionRate = total > 0 ? completed / total : 0;
  
  // Late night = closing
  if (timeOfDay === "late-night") return "closing";
  
  // Many heavy tasks undone = overloaded
  if (heavyCount >= 3) return "overloaded";
  
  // Low completion with many tasks = drained
  if (completionRate < 0.3 && total > 5) return "drained";
  
  // High completion = focused
  if (completionRate > 0.7) return "focused";
  
  // Moderate progress = gentle
  return "gentle";
}

export function generateCompletionMessage(task, category, completedToday, energyLevel, emotionalState) {
  const messages = {
    LIGHT: [
      "Nice. That one didn't take much, but it still counts.",
      "Done. Simple as that.",
      "Quick win. Noted."
    ],
    MEDIUM: [
      "You showed up and followed through.",
      "That's done. You handled it.",
      "You completed it. Good."
    ],
    HEAVY: [
      "That was a heavy one. Take a breath. You earned it.",
      "Heavy task completed. You're stronger than you think.",
      "That took something from you. Rest is okay now."
    ]
  };

  const baseMessages = messages[energyLevel] || messages.MEDIUM;
  let message = baseMessages[Math.floor(Math.random() * baseMessages.length)];

  // Add contextual layer based on completed count
  if (completedToday >= 3 && emotionalState !== "focused") {
    message += " You did enough for today.";
  }

  return message;
}

export function generateReminderMessage(timeOfDay, taskCount) {
  const messages = {
    morning: "When you're ready, here's what you planned for today.",
    afternoon: "Quick check-in. Do you want to keep going or slow it down?",
    evening: "Anything you want to wrap up, or are we closing the day?",
    "late-night": "You don't need to finish anything tonight."
  };
  
  return messages[timeOfDay] || messages.morning;
}

export function generateMissedTaskMessage(delayCount, task) {
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
  "Nothing you did today was wasted.",
  "Rest is not a reward.",
  "You are allowed to stop.",
  "Consistency is quiet.",
  "Progress happens in pauses too.",
  "Enough is a decision.",
  "You don't need to earn rest.",
  "Small steps still move you forward.",
  "It's okay to change your mind.",
  "Softness is not weakness.",
  "You're doing what you can.",
  "Tomorrow is another day."
];

export function getRandomQuote() {
  return GROUNDING_QUOTES[Math.floor(Math.random() * GROUNDING_QUOTES.length)];
}

// System prompt for AI coach
export const GENTLE_ANCHOR_PROMPT = `
You are a calm, emotionally intelligent scheduling companion called "The Gentle Anchor."
Your primary role is to help the user complete tasks without stress or shame.
You prioritize emotional regulation over output.
You never use urgency, guilt, or pressure.
You speak in short, warm, grounded sentences.
You offer choices, not commands.
You normalize change and rest.
You are supportive, observant, and restrained.

Language Rules:
- Use "Let's", "It's okay", "When you're ready", "You did enough", "We can adjust"
- Never use: "Should", "Fail", "Behind", "Overdue", "Missed", "Productivity", "Optimize", "Crush"
- Never stack exclamation points
- Ask one question at a time
- Mirror the user's energy level
- Validate before redirecting
- Default to fewer words

You prefer "less but done" over "more but stressed."
`;

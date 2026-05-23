/** Curated habit icons (emoji) — stored on each habit as `icon` id. */
export const HABIT_ICONS = [
  { id: "alarm", emoji: "⏰", label: "Alarm / wake up" },
  { id: "sun", emoji: "☀️", label: "Morning" },
  { id: "moon", emoji: "🌙", label: "Sleep / wind down" },
  { id: "water", emoji: "💧", label: "Water" },
  { id: "food", emoji: "🍎", label: "Food / nutrition" },
  { id: "walk", emoji: "🚶", label: "Walk / steps" },
  { id: "run", emoji: "🏃", label: "Exercise" },
  { id: "stretch", emoji: "🧘", label: "Stretch / yoga" },
  { id: "strength", emoji: "💪", label: "Strength" },
  { id: "read", emoji: "📖", label: "Read" },
  { id: "write", emoji: "📝", label: "Journal / write" },
  { id: "meditate", emoji: "🧠", label: "Mindfulness" },
  { id: "phone", emoji: "📵", label: "Screen break" },
  { id: "teeth", emoji: "🪥", label: "Dental" },
  { id: "meds", emoji: "💊", label: "Medicine" },
  { id: "money", emoji: "💰", label: "Money / budget" },
  { id: "heart", emoji: "❤️", label: "Self-care" },
  { id: "home", emoji: "🏠", label: "Home / chores" },
  { id: "star", emoji: "⭐", label: "General" },
  { id: "sparkle", emoji: "✨", label: "Glow up" },
];

export const DEFAULT_HABIT_ICON = "star";

const ICON_BY_ID = Object.fromEntries(HABIT_ICONS.map((i) => [i.id, i]));

export function normalizeHabitIcon(raw) {
  const id = String(raw || "").trim();
  return ICON_BY_ID[id] ? id : DEFAULT_HABIT_ICON;
}

export function habitIconEmoji(iconId) {
  return ICON_BY_ID[normalizeHabitIcon(iconId)]?.emoji || "⭐";
}

export function habitIconLabel(iconId) {
  return ICON_BY_ID[normalizeHabitIcon(iconId)]?.label || "Habit";
}

/** Best-effort match when adding a habit from text only. */
export function suggestHabitIconFromLabel(label) {
  const t = String(label || "").toLowerCase();
  if (/\b(wake|waking|alarm|on time|morning routine)\b/.test(t)) return "alarm";
  if (/\b(sleep|bed|wind.?down|night)\b/.test(t)) return "moon";
  if (/\b(water|hydrat|drink)\b/.test(t)) return "water";
  if (/\b(eat|meal|food|vegetable|fruit|macro)\b/.test(t)) return "food";
  if (/\b(walk|step)\b/.test(t)) return "walk";
  if (/\b(run|cardio|workout|gym|lift|exercise)\b/.test(t)) return "run";
  if (/\b(stretch|yoga|mobility)\b/.test(t)) return "stretch";
  if (/\b(read|book)\b/.test(t)) return "read";
  if (/\b(journal|write|note)\b/.test(t)) return "write";
  if (/\b(meditat|mindful|breath)\b/.test(t)) return "meditate";
  if (/\b(phone|screen|scroll|social)\b/.test(t)) return "phone";
  if (/\b(tooth|brush|floss|dental)\b/.test(t)) return "teeth";
  if (/\b(med|pill|vitamin)\b/.test(t)) return "meds";
  if (/\b(money|save|budget|finance)\b/.test(t)) return "money";
  if (/\b(clean|chore|laundry|dishes)\b/.test(t)) return "home";
  return DEFAULT_HABIT_ICON;
}

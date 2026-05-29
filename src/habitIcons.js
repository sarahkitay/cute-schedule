/** Curated habit icon ids stored on each habit as `icon`. */
export const HABIT_ICONS = [
  { id: "alarm", abbr: "Wk", label: "Alarm / wake up" },
  { id: "sun", abbr: "Am", label: "Morning" },
  { id: "moon", abbr: "Pm", label: "Sleep / wind down" },
  { id: "water", abbr: "H2O", label: "Water" },
  { id: "food", abbr: "Fd", label: "Food / nutrition" },
  { id: "walk", abbr: "Wl", label: "Walk / steps" },
  { id: "run", abbr: "Ex", label: "Exercise" },
  { id: "stretch", abbr: "Yg", label: "Stretch / yoga" },
  { id: "strength", abbr: "St", label: "Strength" },
  { id: "read", abbr: "Rd", label: "Read" },
  { id: "write", abbr: "Jr", label: "Journal / write" },
  { id: "meditate", abbr: "Md", label: "Mindfulness" },
  { id: "phone", abbr: "Sc", label: "Screen break" },
  { id: "teeth", abbr: "Dn", label: "Dental" },
  { id: "meds", abbr: "Rx", label: "Medicine" },
  { id: "money", abbr: "$", label: "Money / budget" },
  { id: "heart", abbr: "Hr", label: "Self-care" },
  { id: "home", abbr: "Hm", label: "Home / chores" },
  { id: "general", abbr: "Hb", label: "General" },
];

const ICON_BY_ID = Object.fromEntries(HABIT_ICONS.map((i) => [i.id, i]));

const LEGACY_ICON_IDS = {
  star: "general",
  sparkle: "general",
};

export const DEFAULT_HABIT_ICON = "general";

export function normalizeHabitIcon(raw) {
  const id = String(raw || "").trim() || DEFAULT_HABIT_ICON;
  const mapped = LEGACY_ICON_IDS[id] || id;
  return ICON_BY_ID[mapped] ? mapped : DEFAULT_HABIT_ICON;
}

export function habitIconAbbr(iconId) {
  return ICON_BY_ID[normalizeHabitIcon(iconId)]?.abbr || "Hb";
}

/** @deprecated Use habitIconAbbr */
export function habitIconEmoji(iconId) {
  return habitIconAbbr(iconId);
}

export function habitIconLabel(iconId) {
  return ICON_BY_ID[normalizeHabitIcon(iconId)]?.label || "Habit";
}

/** Suggest an icon id from habit label text. */
export function suggestHabitIconFromLabel(label) {
  const t = String(label || "").toLowerCase();
  if (/\b(wake|waking|alarm|on time|morning routine)\b/.test(t)) return "alarm";
  if (/\b(water|hydrat|drink)\b/.test(t)) return "water";
  if (/\b(read|book)\b/.test(t)) return "read";
  if (/\b(write|journal)\b/.test(t)) return "write";
  if (/\b(meditat|mindful|breath)\b/.test(t)) return "meditate";
  if (/\b(run|gym|workout|exercise)\b/.test(t)) return "run";
  if (/\b(walk|steps)\b/.test(t)) return "walk";
  if (/\b(sleep|bed|night)\b/.test(t)) return "moon";
  if (/\b(phone|screen|scroll)\b/.test(t)) return "phone";
  if (/\b(med|pill|vitamin)\b/.test(t)) return "meds";
  if (/\b(money|budget|save)\b/.test(t)) return "money";
  if (/\b(brush|teeth|floss)\b/.test(t)) return "teeth";
  if (/\b(eat|meal|food|diet)\b/.test(t)) return "food";
  return DEFAULT_HABIT_ICON;
}

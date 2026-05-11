/** @typedef {'loss' | 'gain' | 'maintain'} HealthGoal */
/** @typedef {'female' | 'male' | 'other'} HealthSex */

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const DEFAULT_NAV_VISIBILITY = Object.freeze({
  today: true,
  list: true,
  monthly: true,
  coach: true,
  notes: true,
  finance: true,
  health: false,
});

export function normalizeNavVisibility(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const out = { ...DEFAULT_NAV_VISIBILITY };
  for (const k of Object.keys(DEFAULT_NAV_VISIBILITY)) {
    if (typeof o[k] === "boolean") out[k] = o[k];
  }
  out.today = true;
  return out;
}

/** Bottom dock order for every tab except Today (Today is always first). */
export const DOCK_ORDERABLE_IDS = Object.freeze(["list", "monthly", "coach", "notes", "finance", "health"]);

export function normalizeDockOrder(raw) {
  const defaults = [...DOCK_ORDERABLE_IDS];
  if (!Array.isArray(raw)) return defaults;
  const seen = new Set();
  const out = [];
  for (const id of raw) {
    if (typeof id === "string" && DOCK_ORDERABLE_IDS.includes(id) && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  for (const id of defaults) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

export function emptyWeekPlan() {
  return { mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: "" };
}

export function createDefaultHealth() {
  return {
    profile: {
      age: null,
      sex: "female",
      heightCm: null,
      weightKg: null,
      goal: "maintain",
      activity: 1.375,
      weeklyWorkoutTarget: 3,
      goalWeightKg: null,
    },
    macroTargets: null,
    macroLog: {},
    weightLog: [],
    weekPlans: {},
    savedRoutines: [],
    weekRepeatEnabled: false,
    weekRepeatTemplate: null,
    workoutProgress: {},
  };
}

export function normalizeHealth(raw) {
  const base = createDefaultHealth();
  if (!raw || typeof raw !== "object") return base;
  const p = raw.profile && typeof raw.profile === "object" ? raw.profile : {};
  const goal = p.goal === "loss" || p.goal === "gain" || p.goal === "maintain" ? p.goal : base.profile.goal;
  const sex = p.sex === "male" || p.sex === "other" || p.sex === "female" ? p.sex : base.profile.sex;
  const activity =
    typeof p.activity === "number" && p.activity >= 1.2 && p.activity <= 1.725 ? p.activity : base.profile.activity;
  return {
    profile: {
      age: typeof p.age === "number" && p.age > 0 && p.age < 120 ? p.age : p.age != null && !Number.isNaN(Number(p.age)) ? Math.round(Number(p.age)) : null,
      sex,
      heightCm:
        typeof p.heightCm === "number" && p.heightCm > 50 && p.heightCm < 300
          ? p.heightCm
          : p.heightCm != null && !Number.isNaN(Number(p.heightCm))
            ? Math.round(Number(p.heightCm))
            : null,
      weightKg:
        typeof p.weightKg === "number" && p.weightKg > 20 && p.weightKg < 400
          ? p.weightKg
          : p.weightKg != null && !Number.isNaN(Number(p.weightKg))
            ? Number(p.weightKg)
            : null,
      goal,
      activity,
      weeklyWorkoutTarget:
        typeof p.weeklyWorkoutTarget === "number" && p.weeklyWorkoutTarget >= 1 && p.weeklyWorkoutTarget <= 14
          ? Math.round(p.weeklyWorkoutTarget)
          : base.profile.weeklyWorkoutTarget,
      goalWeightKg:
        typeof p.goalWeightKg === "number" && p.goalWeightKg > 20 && p.goalWeightKg < 400
          ? p.goalWeightKg
          : p.goalWeightKg != null && !Number.isNaN(Number(p.goalWeightKg))
            ? Number(p.goalWeightKg)
            : null,
    },
    macroTargets:
      raw.macroTargets && typeof raw.macroTargets === "object"
        ? {
            calories: Math.max(800, Math.round(Number(raw.macroTargets.calories) || 0)) || null,
            proteinG: Math.max(0, Math.round(Number(raw.macroTargets.proteinG) || 0)),
            carbsG: Math.max(0, Math.round(Number(raw.macroTargets.carbsG) || 0)),
            fatG: Math.max(0, Math.round(Number(raw.macroTargets.fatG) || 0)),
          }
        : null,
    macroLog: raw.macroLog && typeof raw.macroLog === "object" ? { ...raw.macroLog } : {},
    weightLog: Array.isArray(raw.weightLog)
      ? raw.weightLog
          .map((e) =>
            e && typeof e === "object" && e.at && typeof e.kg === "number"
              ? { at: String(e.at), kg: Number(e.kg) }
              : null
          )
          .filter(Boolean)
          .slice(-365)
      : [],
    weekPlans: raw.weekPlans && typeof raw.weekPlans === "object" ? { ...raw.weekPlans } : {},
    savedRoutines: Array.isArray(raw.savedRoutines)
      ? raw.savedRoutines
          .map((r) => {
            if (!r || typeof r !== "object" || !r.id) return null;
            const days = r.days && typeof r.days === "object" ? { ...emptyWeekPlan(), ...r.days } : emptyWeekPlan();
            return { id: String(r.id), name: String(r.name || "Routine").slice(0, 80), days };
          })
          .filter(Boolean)
      : [],
    weekRepeatEnabled: raw.weekRepeatEnabled === true,
    weekRepeatTemplate:
      raw.weekRepeatTemplate && typeof raw.weekRepeatTemplate === "object"
        ? { ...emptyWeekPlan(), ...raw.weekRepeatTemplate }
        : null,
    workoutProgress: raw.workoutProgress && typeof raw.workoutProgress === "object" ? { ...raw.workoutProgress } : {},
  };
}

export function healthProfileComplete(health) {
  const p = health?.profile || {};
  return (
    typeof p.age === "number" &&
    p.age > 0 &&
    typeof p.heightCm === "number" &&
    p.heightCm > 0 &&
    typeof p.weightKg === "number" &&
    p.weightKg > 0 &&
    (p.goal === "loss" || p.goal === "gain" || p.goal === "maintain")
  );
}

function bmrMifflinStJeor(weightKg, heightCm, age, sex) {
  const w = Number(weightKg);
  const h = Number(heightCm);
  const a = Number(age);
  if (!w || !h || !a) return null;
  const base = 10 * w + 6.25 * h - 5 * a;
  if (sex === "male") return base + 5;
  if (sex === "female") return base - 161;
  return base - 78;
}

/** @returns {{ calories: number, proteinG: number, carbsG: number, fatG: number } | null} */
export function computeMacroTargetsFromProfile(profile) {
  if (!profile || typeof profile !== "object") return null;
  const { age, heightCm, weightKg, sex, goal, activity } = profile;
  if (!age || !heightCm || !weightKg) return null;
  const act = typeof activity === "number" && activity >= 1.2 ? activity : 1.375;
  const bmr = bmrMifflinStJeor(weightKg, heightCm, age, sex);
  if (bmr == null || !Number.isFinite(bmr)) return null;
  let tdee = bmr * act;
  if (goal === "loss") tdee -= 500;
  else if (goal === "gain") tdee += 300;
  const calories = Math.max(1200, Math.round(tdee));
  const proteinG = Math.round((calories * 0.3) / 4);
  const fatG = Math.round((calories * 0.35) / 9);
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));
  return { calories, proteinG, carbsG, fatG };
}

export function mondayKeyForDayKey(dayKey) {
  const d = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function addDaysToDayKey(dayKey, delta) {
  const d = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Map mon..sun to calendar dayKey for week starting mondayKey */
export function dayKeysForWeek(mondayKey) {
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const keys = {};
  for (let i = 0; i < 7; i++) {
    keys[order[i]] = addDaysToDayKey(mondayKey, i);
  }
  return keys;
}

export function getWeekPlan(health, mondayKey) {
  const plans = health?.weekPlans || {};
  const raw = plans[mondayKey];
  if (!raw || typeof raw !== "object") return emptyWeekPlan();
  return { ...emptyWeekPlan(), ...raw };
}

/** When week repeat is on, all weeks use the shared template; otherwise per-week plans. */
export function getEffectiveWeekPlan(health, mondayKey) {
  const h = normalizeHealth(health);
  if (h.weekRepeatEnabled && h.weekRepeatTemplate && typeof h.weekRepeatTemplate === "object") {
    return { ...emptyWeekPlan(), ...h.weekRepeatTemplate };
  }
  return getWeekPlan(h, mondayKey);
}

/** Split day plan text into exercise lines for the workout runner UI. */
export function dayPlanToExerciseLines(text) {
  const raw = String(text || "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return raw.map((line, idx) => ({ id: `ex-${idx}`, idx, text: line }));
}

export function workoutProgressKey(weekMonday, dayKey, lineIdx) {
  return `${weekMonday}|${dayKey}|${lineIdx}`;
}

export function getWorkoutLineProgress(health, key) {
  const h = normalizeHealth(health);
  const row = h.workoutProgress && typeof h.workoutProgress === "object" ? h.workoutProgress[key] : null;
  if (!row || typeof row !== "object") return { done: false, weight: "", duration: "", breakMin: "", notes: "" };
  return {
    done: !!row.done,
    weight: String(row.weight || ""),
    duration: String(row.duration || ""),
    breakMin: String(row.breakMin || ""),
    notes: String(row.notes || ""),
  };
}

export const WORKOUT_SAMPLES = [
  {
    id: "sample_full_body",
    name: "Full body (5 patterns)",
    blurb: "One session hitting squat, hinge, push, pull, carry / core.",
    days: {
      mon: `Full body - movement patterns
• Squat pattern: Goblet squat 3×8–12
• Hinge: Romanian deadlift 3×8–10
• Horizontal push: Push-ups or DB bench 3×8–12
• Horizontal pull: Ring row or cable row 3×10–15
• Carry / core: Farmer carry 2×40 steps + dead bug 2×10`,
      tue: "",
      wed: "",
      thu: "",
      fri: "",
      sat: "",
      sun: "",
    },
  },
  {
    id: "sample_leg",
    name: "Leg day",
    blurb: "Quad, hinge, single-leg, calves.",
    days: {
      mon: "",
      tue: `Leg day
• Back squat or leg press 4×6–10
• Romanian deadlift 3×8–10
• Split squat or lunge 3×8 each leg
• Leg curl 3×12–15
• Standing calf raise 4×12–15`,
      wed: "",
      thu: "",
      fri: "",
      sat: "",
      sun: "",
    },
  },
  {
    id: "sample_upper",
    name: "Upper body",
    blurb: "Vertical + horizontal push & pull.",
    days: {
      mon: "",
      tue: "",
      wed: `Upper body
• Pull-up or lat pulldown 4×6–10
• Overhead press or DB shoulder press 3×8–12
• DB row 3×8–12 each arm
• Incline DB press 3×10–12
• Face pull + triceps pushdown 2×15 each`,
      thu: "",
      fri: "",
      sat: "",
      sun: "",
    },
  },
];

export function formatHealthForCoach(health) {
  const h = normalizeHealth(health);
  const lines = [];
  const p = h.profile;
  if (healthProfileComplete(h)) {
    lines.push(
      `Body stats: age ${p.age}, ${p.heightCm}cm, ${p.weightKg}kg, goal ${p.goal}, activity x${p.activity}.`
    );
  }
  if (h.macroTargets?.calories) {
    lines.push(
      `Macro targets: ~${h.macroTargets.calories} kcal; P ${h.macroTargets.proteinG}g / C ${h.macroTargets.carbsG}g / F ${h.macroTargets.fatG}g.`
    );
  }
  const lastW = (h.weightLog || []).slice(-3);
  if (lastW.length) {
    lines.push(`Recent weights (kg): ${lastW.map((e) => `${e.kg}@${e.at.slice(0, 10)}`).join(", ")}`);
  }
  if (p.goalWeightKg && p.weightKg) {
    lines.push(`Goal weight: ${p.goalWeightKg}kg (from current ${p.weightKg}kg).`);
  }
  const mon = mondayKeyForDayKey(new Date().toISOString().slice(0, 10));
  const plan = getEffectiveWeekPlan(h, mon);
  const bits = DAY_KEYS.map((k) => (plan[k] && String(plan[k]).trim() ? `${k}: ${String(plan[k]).trim().slice(0, 120)}` : "")).filter(Boolean);
  if (bits.length) lines.push(`This week's plan notes: ${bits.join(" | ")}`);
  return lines.length ? lines.join("\n") : "Health module not filled in yet.";
}

function iterTasksInDay(day, fn) {
  if (!day?.hours || typeof day.hours !== "object") return;
  for (const hourKey of Object.keys(day.hours)) {
    const slot = day.hours[hourKey];
    if (!slot || typeof slot !== "object") continue;
    for (const cat of Object.keys(slot)) {
      const arr = slot[cat];
      if (!Array.isArray(arr)) continue;
      for (const t of arr) {
        if (t && typeof t === "object") fn(t, hourKey, cat);
      }
    }
  }
}

/** @returns {{ scheduleDays: number, completed: number, target: number, blendPct: number }} */
export function computeWorkoutConsistency(appState, centerDayKey, health) {
  const mon = mondayKeyForDayKey(centerDayKey);
  const dayKeys = [];
  for (let i = 0; i < 7; i++) dayKeys.push(addDaysToDayKey(mon, i));
  const days = appState?.days || {};
  const scheduled = new Set();
  let completed = 0;
  for (const dk of dayKeys) {
    const day = days[dk];
    if (!day) continue;
    let sawWorkout = false;
    iterTasksInDay(day, (t) => {
      if (t.taskType === "workout") {
        sawWorkout = true;
        if (t.done) completed += 1;
      }
    });
    if (sawWorkout) scheduled.add(dk);
  }
  const target = Math.max(1, Math.min(14, health?.profile?.weeklyWorkoutTarget || 3));
  const scheduleDays = scheduled.size;
  const scheduleScore = scheduleDays / 7;
  const completeScore = Math.min(1, completed / target);
  const blendPct = Math.round(100 * (0.5 * scheduleScore + 0.5 * completeScore));
  return { scheduleDays, completed, target, blendPct };
}
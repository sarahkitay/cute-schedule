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
  health: true,
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

/** Bottom dock order for every tab except Today (Today is always first). Health defaults early so it stays on the bar; users can hide it to show the Today home card instead. */
export const DOCK_ORDERABLE_IDS = Object.freeze(["list", "health", "monthly", "coach", "notes", "finance"]);

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

/** @typedef {{ name: string, setsReps: string, weightNote: string }} ExerciseBlock */

/** @param {unknown} x @returns {ExerciseBlock | null} */
export function normalizeExerciseBlock(x) {
  if (x == null) return null;
  if (typeof x === "object" && x !== null) {
    const name = String(x.name || "").trim();
    const setsReps = String(x.setsReps || "").trim();
    const weightNote = String(x.weightNote || "").trim();
    if (!name && !setsReps && !weightNote) return null;
    return {
      name: name.slice(0, 160),
      setsReps: setsReps.slice(0, 160),
      weightNote: weightNote.slice(0, 160),
    };
  }
  const s = String(x).trim();
  if (!s) return null;
  return { name: s.slice(0, 200), setsReps: "", weightNote: "" };
}

/** One line for tasks / coach (legacy-friendly). */
export function formatExerciseBlockLine(b) {
  const x = normalizeExerciseBlock(b);
  if (!x) return "";
  return [x.name, x.setsReps, x.weightNote].filter(Boolean).join(" | ");
}

/** @param {unknown} p @returns {{ id: string, name: string, exercises: ExerciseBlock[] } | null} */
export function normalizeProgramRecord(p) {
  if (!p || typeof p !== "object" || !p.id) return null;
  const exercises = Array.isArray(p.exercises)
    ? p.exercises.map(normalizeExerciseBlock).filter(Boolean).slice(0, 120)
    : [];
  return {
    id: String(p.id).slice(0, 80),
    name: String(p.name || "Program").slice(0, 100),
    exercises,
  };
}

function migrateSavedRoutinesToPrograms(savedRoutines) {
  if (!Array.isArray(savedRoutines) || !savedRoutines.length) return [];
  const out = [];
  for (const r of savedRoutines) {
    if (!r || typeof r !== "object" || !r.id) continue;
    const lines = [];
    for (const k of DAY_KEYS) {
      const txt = String(r.days?.[k] || "")
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
      lines.push(...txt);
    }
    if (!lines.length) continue;
    const rec = normalizeProgramRecord({
      id: `mig-${r.id}`,
      name: r.name || "Imported routine",
      exercises: lines.map((t) => ({ name: t, setsReps: "", weightNote: "" })),
    });
    if (rec) out.push(rec);
  }
  return out;
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
    programs: [],
    weekRoutineProgramIds: [],
    weekRoutineCursor: 0,
    /** Legacy field; rotation is always sequential through `weekRoutineProgramIds` (see `resolveProgramForTask`). */
    workoutRotationMode: "queue",
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
    macroLog: (() => {
      const ml = raw.macroLog && typeof raw.macroLog === "object" ? raw.macroLog : {};
      const out = {};
      for (const k of Object.keys(ml)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
        out[k] = normalizeMacroDayEntry(ml[k], k);
      }
      return out;
    })(),
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
    programs: (() => {
      if (Array.isArray(raw.programs)) {
        return raw.programs.map((p) => normalizeProgramRecord(p)).filter(Boolean);
      }
      return migrateSavedRoutinesToPrograms(raw.savedRoutines);
    })(),
    weekRoutineProgramIds: Array.isArray(raw.weekRoutineProgramIds)
      ? raw.weekRoutineProgramIds.map((x) => String(x)).filter(Boolean).slice(0, 21)
      : [],
    weekRoutineCursor:
      typeof raw.weekRoutineCursor === "number" && Number.isFinite(raw.weekRoutineCursor)
        ? Math.max(0, Math.round(raw.weekRoutineCursor))
        : 0,
    workoutRotationMode: "queue",
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

const LB_PER_KG = 2.2046226218487757;

/** @returns {{ feet: number | "", inches: number | "" }} */
export function cmToFeetInches(cm) {
  if (cm == null || !Number.isFinite(Number(cm)) || Number(cm) <= 0) return { feet: "", inches: "" };
  const totalIn = Number(cm) / 2.54;
  let feet = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  if (inches < 0) inches = 0;
  return { feet, inches };
}

/**
 * @param {number | "" | null | undefined} feet
 * @param {number | "" | null | undefined} inches 0–11 typical
 * @returns {number | null} height in cm, or null if empty / invalid
 */
export function feetInchesToCm(feet, inches) {
  const ftEmpty = feet === "" || feet == null;
  const inEmpty = inches === "" || inches == null;
  if (ftEmpty && inEmpty) return null;
  const ft = ftEmpty ? 0 : Number(feet);
  const inc = inEmpty ? 0 : Number(inches);
  if (!Number.isFinite(ft) || !Number.isFinite(inc) || ft < 0 || inc < 0) return null;
  const totalIn = ft * 12 + inc;
  if (totalIn <= 0) return null;
  return Math.round(totalIn * 2.54);
}

export function kgToLb(kg) {
  if (kg == null || !Number.isFinite(Number(kg))) return null;
  return Number(kg) * LB_PER_KG;
}

export function lbToKg(lb) {
  if (lb == null || !Number.isFinite(Number(lb)) || Number(lb) <= 0) return null;
  return Number(lb) / LB_PER_KG;
}

/** @param {number | null | undefined} kg @returns {string} */
export function formatWeightLbFromKg(kg) {
  if (kg == null || !Number.isFinite(Number(kg))) return "";
  const lb = kgToLb(kg);
  if (lb == null) return "";
  const n = Math.round(lb * 10) / 10;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
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

/**
 * Example day structures (rough USDA-style totals). Scaled to the user’s calorie target in
 * {@link suggestMealPlansForTargets}; macro % may differ slightly from the calculator split.
 * @type {{ id: string, name: string, blurb: string, meals: { slot: string, lines: string[], protein: number, carbs: number, fat: number, calories: number }[] }[]}
 */
const MEAL_PLAN_TEMPLATES = [
  {
    id: "balanced",
    name: "Balanced plates",
    blurb: "Steady breakfast, protein at lunch, fish and complex carbs at dinner.",
    meals: [
      {
        slot: "Breakfast",
        lines: ["Oatmeal (~1 cup cooked)", "Eggs (2 large)", "Banana (1 medium)"],
        protein: 19,
        carbs: 55,
        fat: 14,
        calories: 399,
      },
      {
        slot: "Snack",
        lines: ["Protein shake (~12 oz)"],
        protein: 25,
        carbs: 3,
        fat: 2,
        calories: 130,
      },
      {
        slot: "Lunch",
        lines: ["Chicken breast (~4 oz cooked)", "White rice (~1 cup cooked)", "Broccoli (~1 cup)"],
        protein: 42,
        carbs: 51,
        fat: 5,
        calories: 423,
      },
      {
        slot: "Dinner",
        lines: ["Salmon (~6 oz cooked)", "Sweet potato (1 medium baked)", "Side salad (~2 cups veg + light dressing)"],
        protein: 42,
        carbs: 32,
        fat: 26,
        calories: 504,
      },
    ],
  },
  {
    id: "high_protein",
    name: "Higher protein",
    blurb: "Extra dairy and fish; still includes carbs for training days.",
    meals: [
      {
        slot: "Breakfast",
        lines: ["Greek yogurt (~170g)", "Eggs (2 large)", "Egg whites (~½ cup)"],
        protein: 42,
        carbs: 8,
        fat: 10,
        calories: 312,
      },
      {
        slot: "Snack",
        lines: ["Protein shake (~12 oz)", "Cottage cheese (~½ cup 2%)"],
        protein: 39,
        carbs: 8,
        fat: 4,
        calories: 220,
      },
      {
        slot: "Lunch",
        lines: ["Chicken breast (~4 oz cooked)", "White rice (~½ cup cooked)", "Broccoli (~1 cup)"],
        protein: 37,
        carbs: 28,
        fat: 5,
        calories: 320,
      },
      {
        slot: "Dinner",
        lines: ["Tuna (~5 oz can in water)", "Quinoa (~1 cup cooked)", "Broccoli (~1 cup)"],
        protein: 45,
        carbs: 45,
        fat: 5,
        calories: 403,
      },
    ],
  },
  {
    id: "practical",
    name: "Practical / on-the-go",
    blurb: "Simple foods that pack for work or school; sandwich midday, lighter dinner.",
    meals: [
      {
        slot: "Breakfast",
        lines: ["Oatmeal (~1 cup cooked)", "Peanut butter (2 tbsp)", "Apple (1 medium)"],
        protein: 15,
        carbs: 58,
        fat: 20,
        calories: 435,
      },
      {
        slot: "Snack",
        lines: ["Greek yogurt (~170g)"],
        protein: 17,
        carbs: 6,
        fat: 0,
        calories: 100,
      },
      {
        slot: "Lunch",
        lines: ["Turkey sandwich (deli + 2 slices bread)"],
        protein: 22,
        carbs: 34,
        fat: 8,
        calories: 320,
      },
      {
        slot: "Dinner",
        lines: ["Salmon (~6 oz cooked)", "Sweet potato (1 medium baked)", "Side salad (~2 cups veg + light dressing)"],
        protein: 42,
        carbs: 32,
        fat: 26,
        calories: 504,
      },
    ],
  },
  {
    id: "plant_forward",
    name: "Plant-forward",
    blurb: "More plants and tofu at lunch; fish at dinner for omega-3s.",
    meals: [
      {
        slot: "Breakfast",
        lines: ["Oatmeal (~1 cup cooked)", "Blueberries (~1 cup)", "Soy milk (1 cup)"],
        protein: 16,
        carbs: 52,
        fat: 9,
        calories: 339,
      },
      {
        slot: "Snack",
        lines: ["Apple (1 medium)", "Almonds (~1 oz / 23 nuts)"],
        protein: 6,
        carbs: 31,
        fat: 14,
        calories: 259,
      },
      {
        slot: "Lunch",
        lines: ["Tofu firm (~6 oz)", "Quinoa (~1 cup cooked)", "Broccoli (~1 cup)"],
        protein: 29,
        carbs: 48,
        fat: 10,
        calories: 403,
      },
      {
        slot: "Dinner",
        lines: ["Salmon (~6 oz cooked)", "White rice (~½ cup cooked)", "Side salad (~2 cups veg + light dressing)"],
        protein: 39,
        carbs: 45,
        fat: 18,
        calories: 503,
      },
    ],
  },
];

/**
 * Scale example meal plans to the user’s calculator targets (by calories; macros scale together).
 * @param {{ calories: number, proteinG: number, carbsG: number, fatG: number } | null | undefined} targets
 * @returns {{ id: string, name: string, blurb: string, meals: { slot: string, lines: string[], protein: number, carbs: number, fat: number, calories: number }[], totals: { protein: number, carbs: number, fat: number, calories: number }, vsTargetsPct: { calories: number | null, protein: number | null, carbs: number | null, fat: number | null } }[]}
 */
export function suggestMealPlansForTargets(targets) {
  if (!targets || typeof targets !== "object") return [];
  const tCal = Math.max(0, Math.round(Number(targets.calories) || 0));
  if (tCal < 1000) return [];
  const tP = Math.max(0, Math.round(Number(targets.proteinG) || 0));
  const tC = Math.max(0, Math.round(Number(targets.carbsG) || 0));
  const tF = Math.max(0, Math.round(Number(targets.fatG) || 0));

  const pct = (actual, target) => {
    if (target <= 0) return actual > 0 ? 100 : null;
    return Math.round((100 * actual) / target);
  };

  return MEAL_PLAN_TEMPLATES.map((tpl) => {
    const baseCal = tpl.meals.reduce((s, m) => s + m.calories, 0);
    if (baseCal <= 0) return null;
    const f = tCal / baseCal;
    const meals = tpl.meals.map((m) => ({
      slot: m.slot,
      lines: [...m.lines],
      protein: Math.max(0, Math.round(m.protein * f)),
      carbs: Math.max(0, Math.round(m.carbs * f)),
      fat: Math.max(0, Math.round(m.fat * f)),
      calories: Math.max(0, Math.round(m.calories * f)),
    }));
    const totCalBefore = meals.reduce((s, m) => s + m.calories, 0);
    const drift = tCal - totCalBefore;
    if (meals.length && drift !== 0) {
      const last = meals[meals.length - 1];
      last.calories = Math.max(0, last.calories + drift);
    }
    const totals = meals.reduce(
      (acc, m) => ({
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fat: acc.fat + m.fat,
        calories: acc.calories + m.calories,
      }),
      { protein: 0, carbs: 0, fat: 0, calories: 0 }
    );
    return {
      id: tpl.id,
      name: tpl.name,
      blurb: tpl.blurb,
      meals,
      totals,
      vsTargetsPct: {
        calories: pct(totals.calories, tCal),
        protein: pct(totals.protein, tP),
        carbs: pct(totals.carbs, tC),
        fat: pct(totals.fat, tF),
      },
    };
  }).filter(Boolean);
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

/** Built-in templates (same ids work on tasks as `workoutProgramId`). */
export const PROGRAM_LIBRARY = [
  {
    id: "sample_full_body",
    name: "Full body",
    blurb: "Power, core, hinge, press, row, squat pattern in one balanced session.",
    exercises: [
      { name: "Med ball slams", setsReps: "3×10", weightNote: "" },
      { name: "Hanging leg raises", setsReps: "3×12", weightNote: "" },
      { name: "Romanian deadlifts (RDL)", setsReps: "3×8-10", weightNote: "" },
      { name: "Overhead press (barbell or DB)", setsReps: "3×8-10", weightNote: "" },
      { name: "Seated cable rows", setsReps: "3×10-12", weightNote: "" },
      { name: "Dumbbell goblet squats", setsReps: "3×10-12", weightNote: "" },
    ],
  },
  {
    id: "sample_leg",
    name: "Leg day",
    blurb: "Squat pattern, hinge, single-leg, isolation calves.",
    exercises: [
      { name: "Back squat or leg press", setsReps: "4×6-10", weightNote: "" },
      { name: "Romanian deadlift", setsReps: "3×8-10", weightNote: "" },
      { name: "Walking lunges or Bulgarian split squat", setsReps: "3×8 each leg", weightNote: "" },
      { name: "Leg curl", setsReps: "3×12-15", weightNote: "" },
      { name: "Leg extension", setsReps: "3×12-15", weightNote: "" },
      { name: "Standing calf raises", setsReps: "4×12-15", weightNote: "" },
    ],
  },
  {
    id: "sample_upper",
    name: "Upper body",
    blurb: "Vertical pull, vertical push, rows, incline press, arms.",
    exercises: [
      { name: "Pull-ups or lat pulldown", setsReps: "4×6-10", weightNote: "" },
      { name: "Overhead DB shoulder press", setsReps: "3×8-12", weightNote: "" },
      { name: "One-arm dumbbell row", setsReps: "3×8-12 each", weightNote: "" },
      { name: "Incline DB bench press", setsReps: "3×10-12", weightNote: "" },
      { name: "Face pulls", setsReps: "3×15", weightNote: "" },
      { name: "Triceps rope pushdown", setsReps: "3×12-15", weightNote: "" },
    ],
  },
];

const GYM_WORD = /\b(gym|workouts?|exercises?|lifting|train(?:ing)?)\b/i;

export function textHintsWorkoutTask(text) {
  return GYM_WORD.test(String(text || "").trim());
}

export function getProgramById(health, id) {
  if (!id) return null;
  const h = normalizeHealth(health);
  const u = (h.programs || []).find((p) => p.id === id);
  const raw = u || PROGRAM_LIBRARY.find((p) => p.id === id);
  return raw ? normalizeProgramRecord(raw) : null;
}

/** User programs first, then built-ins (for pickers). */
export function listSelectablePrograms(health) {
  const h = normalizeHealth(health);
  const user = (h.programs || []).filter((p) => p && p.id);
  const seen = new Set(user.map((p) => p.id));
  const rest = PROGRAM_LIBRARY.filter((p) => !seen.has(p.id))
    .map((p) => normalizeProgramRecord(p))
    .filter(Boolean);
  return [...user, ...rest];
}

/**
 * @param {unknown} task
 * @returns {{ program: { id: string, name: string, exercises: ExerciseBlock[] } | null, advanceQueue: boolean }}
 */
export function resolveProgramForTask(health, task) {
  const h = normalizeHealth(health);
  const mode = task?.workoutProgramMode || (task?.workoutProgramId ? "specific" : "auto");
  if (task?.workoutProgramId) {
    const p = getProgramById(h, task.workoutProgramId);
    if (p && p.exercises?.length) {
      return { program: p, advanceQueue: mode === "queue" || mode === "auto" };
    }
    if (mode === "specific") return { program: null, advanceQueue: false };
  }
  if (mode === "specific") return { program: null, advanceQueue: false };

  const ids = (h.weekRoutineProgramIds || []).map(String).filter(Boolean);
  const valid = ids.filter((id) => {
    const p = getProgramById(h, id);
    return p && p.exercises?.length;
  });
  if (valid.length > 0) {
    const cur = Number(h.weekRoutineCursor) || 0;
    const idx = ((cur % valid.length) + valid.length) % valid.length;
    const p = getProgramById(h, valid[idx]);
    return { program: p, advanceQueue: true };
  }
  const firstUser = (h.programs || []).find((p) => p.exercises?.length);
  if (firstUser) return { program: firstUser, advanceQueue: false };
  const cur = Number(h.weekRoutineCursor) || 0;
  const lib = PROGRAM_LIBRARY;
  const li = lib.length ? ((cur % lib.length) + lib.length) % lib.length : 0;
  const rawLib = lib[li];
  return { program: rawLib ? normalizeProgramRecord(rawLib) : null, advanceQueue: !!lib.length };
}

/** Patch object for `setHealth(prev => ({ ...normalizeHealth(prev), ... }))` after starting a queue/auto workout. */
export function bumpWeekRoutineCursor(health) {
  const h = normalizeHealth(health);
  const ids = (h.weekRoutineProgramIds || []).map(String).filter(Boolean);
  const valid = ids.filter((id) => {
    const p = getProgramById(h, id);
    return p && p.exercises?.length;
  });
  const mod = valid.length > 0 ? valid.length : Math.max(1, PROGRAM_LIBRARY.length);
  const next = ((Number(h.weekRoutineCursor) || 0) + 1) % mod;
  return { weekRoutineCursor: next };
}

export function guidedSessionProgressKey(taskId, programId, lineIdx) {
  return `guided:${String(taskId)}:${String(programId)}:${Number(lineIdx)}`;
}

function macroFieldNumber(v) {
  if (v === "" || v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** @param {unknown} m @returns {{ id: string, label: string, food: string, protein: number, carbs: number, fat: number, calories: number, savedAt: string } | null} */
export function normalizeMacroMeal(m) {
  if (!m || typeof m !== "object" || !m.id) return null;
  return {
    id: String(m.id).slice(0, 64),
    label: String(m.label || "").slice(0, 80),
    food: String(m.food || "").slice(0, 200),
    protein: Math.round(macroFieldNumber(m.protein)),
    carbs: Math.round(macroFieldNumber(m.carbs)),
    fat: Math.round(macroFieldNumber(m.fat)),
    calories: Math.round(macroFieldNumber(m.calories)),
    savedAt: typeof m.savedAt === "string" ? m.savedAt : new Date().toISOString(),
  };
}

/**
 * One day of macro logging: array of meals/snacks (each saved separately; totals sum for progress).
 * @param {unknown} raw
 * @param {string} dayKey YYYY-MM-DD for stable legacy ids
 */
export function normalizeMacroDayEntry(raw, dayKey = "") {
  if (!raw || typeof raw !== "object") return { meals: [] };
  if (Array.isArray(raw.meals)) {
    const meals = raw.meals.map(normalizeMacroMeal).filter(Boolean).slice(0, 80);
    return { meals };
  }
  const p = macroFieldNumber(raw.protein);
  const c = macroFieldNumber(raw.carbs);
  const f = macroFieldNumber(raw.fat);
  const cal = macroFieldNumber(raw.calories);
  if (p + c + f + cal <= 0) return { meals: [] };
  return {
    meals: [
      {
        id: `legacy-${dayKey || "day"}`,
        label: "Earlier log",
        food: "",
        protein: Math.round(p),
        carbs: Math.round(c),
        fat: Math.round(f),
        calories: Math.round(cal),
        savedAt: "1970-01-01T00:00:00.000Z",
      },
    ],
  };
}

/** @returns {{ protein: number, carbs: number, fat: number, calories: number }} */
export function sumMacroDayTotals(dayEntry) {
  const d = dayEntry && typeof dayEntry === "object" && Array.isArray(dayEntry.meals) ? dayEntry : { meals: [] };
  return (d.meals || []).reduce(
    (acc, m) => ({
      protein: acc.protein + (m.protein || 0),
      carbs: acc.carbs + (m.carbs || 0),
      fat: acc.fat + (m.fat || 0),
      calories: acc.calories + (m.calories || 0),
    }),
    { protein: 0, carbs: 0, fat: 0, calories: 0 }
  );
}

/** Lowercase, trim, collapse spaces — used to match repeated food descriptions in macro log. */
export function normalizeMacroFoodKey(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * Latest macros per normalized food string (most recent `savedAt` wins).
 * @param {unknown} macroLog
 * @returns {Map<string, { protein: number, carbs: number, fat: number, calories: number, savedAt: string, displayFood: string }>}
 */
export function getMacroFoodHistoryLookup(macroLog) {
  /** @type {Map<string, { protein: number, carbs: number, fat: number, calories: number, savedAt: string, displayFood: string }>} */
  const map = new Map();
  const ml = macroLog && typeof macroLog === "object" ? macroLog : {};
  for (const dk of Object.keys(ml)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dk)) continue;
    const day = ml[dk];
    const meals = day?.meals;
    if (!Array.isArray(meals)) continue;
    for (const raw of meals) {
      const nm = normalizeMacroMeal(raw);
      if (!nm) continue;
      const fk = normalizeMacroFoodKey(nm.food);
      if (fk.length < 2) continue;
      if (nm.protein + nm.carbs + nm.fat + nm.calories <= 0) continue;
      const displayFood = String(nm.food || "").trim().slice(0, 200) || fk;
      const prev = map.get(fk);
      if (!prev || String(nm.savedAt).localeCompare(String(prev.savedAt)) > 0) {
        map.set(fk, {
          protein: nm.protein,
          carbs: nm.carbs,
          fat: nm.fat,
          calories: nm.calories,
          savedAt: nm.savedAt,
          displayFood,
        });
      }
    }
  }
  return map;
}

/**
 * Rough single-serving estimates for quick fills (not medical advice).
 * Order matters: first matching preset wins — put specific phrases before broad ones
 * (e.g. "brown rice" before "rice", "almond milk" uses its own keys so plain "milk" stays dairy).
 */
export const MACRO_GENERIC_PRESETS = [
  { keys: ["banana"], label: "Banana (1 medium)", protein: 1, carbs: 27, fat: 0, calories: 105 },
  { keys: ["apple"], label: "Apple (1 medium)", protein: 0, carbs: 25, fat: 0, calories: 95 },
  { keys: ["orange"], label: "Orange (1 medium)", protein: 1, carbs: 15, fat: 0, calories: 62 },
  { keys: ["pear"], label: "Pear (1 medium)", protein: 1, carbs: 28, fat: 0, calories: 102 },
  { keys: ["grapes"], label: "Grapes (~1 cup)", protein: 1, carbs: 27, fat: 0, calories: 104 },
  { keys: ["blueberries"], label: "Blueberries (~1 cup)", protein: 1, carbs: 21, fat: 0, calories: 84 },
  { keys: ["strawberries"], label: "Strawberries (~1 cup sliced)", protein: 1, carbs: 12, fat: 0, calories: 49 },
  { keys: ["watermelon"], label: "Watermelon (~2 cups diced)", protein: 2, carbs: 22, fat: 0, calories: 91 },
  { keys: ["egg white", "egg whites"], label: "Egg whites (~½ cup)", protein: 13, carbs: 1, fat: 0, calories: 68 },
  { keys: ["egg", "eggs"], label: "Eggs (2 large)", protein: 12, carbs: 1, fat: 10, calories: 144 },
  { keys: ["bacon"], label: "Bacon (2 strips)", protein: 6, carbs: 0, fat: 7, calories: 87 },
  { keys: ["sausage"], label: "Breakfast sausage (2 links)", protein: 12, carbs: 1, fat: 18, calories: 210 },
  { keys: ["oatmeal", "oats"], label: "Oatmeal (~1 cup cooked)", protein: 6, carbs: 27, fat: 4, calories: 150 },
  { keys: ["cereal"], label: "Cold cereal (~1 cup + ½ cup 2% milk)", protein: 8, carbs: 38, fat: 4, calories: 220 },
  { keys: ["waffle"], label: "Frozen waffle (1)", protein: 4, carbs: 15, fat: 7, calories: 150 },
  { keys: ["pancake"], label: "Pancakes (2 medium)", protein: 5, carbs: 22, fat: 4, calories: 150 },
  { keys: ["bagel"], label: "Bagel (plain, medium)", protein: 10, carbs: 55, fat: 2, calories: 280 },
  { keys: ["croissant"], label: "Croissant (1 medium)", protein: 5, carbs: 26, fat: 12, calories: 231 },
  { keys: ["toast", "bread"], label: "Bread (2 slices)", protein: 6, carbs: 28, fat: 2, calories: 160 },
  { keys: ["tortilla"], label: "Flour tortilla (10\")", protein: 4, carbs: 26, fat: 3, calories: 150 },
  { keys: ["pita"], label: "Pita bread (1 pocket)", protein: 6, carbs: 33, fat: 1, calories: 165 },
  { keys: ["rice", "white rice", "jasmine rice"], label: "White rice (~1 cup cooked)", protein: 4, carbs: 45, fat: 1, calories: 205 },
  { keys: ["brown rice"], label: "Brown rice (~1 cup cooked)", protein: 5, carbs: 45, fat: 2, calories: 216 },
  { keys: ["wild rice"], label: "Wild rice (~1 cup cooked)", protein: 7, carbs: 35, fat: 1, calories: 166 },
  { keys: ["quinoa"], label: "Quinoa (~1 cup cooked)", protein: 8, carbs: 39, fat: 4, calories: 222 },
  { keys: ["pasta", "spaghetti"], label: "Pasta (~1 cup cooked)", protein: 8, carbs: 43, fat: 1, calories: 221 },
  { keys: ["sweet potato"], label: "Sweet potato (1 medium baked)", protein: 4, carbs: 24, fat: 0, calories: 103 },
  { keys: ["baked potato", "russet"], label: "Baked potato (1 medium)", protein: 5, carbs: 37, fat: 0, calories: 164 },
  { keys: ["fries", "french fries"], label: "French fries (medium fast-food)", protein: 4, carbs: 48, fat: 17, calories: 378 },
  { keys: ["broccoli"], label: "Broccoli (~1 cup chopped)", protein: 3, carbs: 6, fat: 0, calories: 31 },
  { keys: ["spinach"], label: "Spinach (~2 cups raw)", protein: 2, carbs: 2, fat: 0, calories: 14 },
  { keys: ["salad"], label: "Garden salad (~2 cups veg + 2 tbsp ranch)", protein: 4, carbs: 8, fat: 14, calories: 160 },
  { keys: ["carrots"], label: "Baby carrots (~10)", protein: 1, carbs: 8, fat: 0, calories: 35 },
  { keys: ["hummus"], label: "Hummus (~¼ cup)", protein: 5, carbs: 9, fat: 5, calories: 100 },
  { keys: ["black beans"], label: "Black beans (~½ cup canned, drained)", protein: 8, carbs: 20, fat: 1, calories: 110 },
  { keys: ["lentils"], label: "Lentils (~1 cup cooked)", protein: 18, carbs: 40, fat: 1, calories: 230 },
  { keys: ["chickpeas", "garbanzo"], label: "Chickpeas (~½ cup cooked)", protein: 7, carbs: 22, fat: 2, calories: 135 },
  { keys: ["tofu"], label: "Tofu firm (~6 oz)", protein: 18, carbs: 3, fat: 9, calories: 150 },
  { keys: ["edamame"], label: "Edamame (~1 cup shelled)", protein: 18, carbs: 14, fat: 8, calories: 188 },
  { keys: ["chicken noodle soup", "chicken noodle"], label: "Chicken noodle soup (1 cup canned)", protein: 7, carbs: 15, fat: 3, calories: 120 },
  { keys: ["chicken breast"], label: "Chicken breast (~4 oz cooked)", protein: 35, carbs: 0, fat: 4, calories: 187 },
  { keys: ["chicken thigh"], label: "Chicken thigh (~4 oz cooked, skinless)", protein: 26, carbs: 0, fat: 10, calories: 186 },
  { keys: ["rotisserie chicken", "chicken"], label: "Chicken (~4 oz cooked, mixed)", protein: 30, carbs: 0, fat: 8, calories: 200 },
  { keys: ["turkey breast"], label: "Turkey breast (~3 oz deli)", protein: 19, carbs: 1, fat: 3, calories: 100 },
  { keys: ["ground beef"], label: "Ground beef (~4 oz cooked, 85% lean)", protein: 22, carbs: 0, fat: 17, calories: 240 },
  { keys: ["steak"], label: "Steak (~6 oz cooked, sirloin)", protein: 42, carbs: 0, fat: 12, calories: 300 },
  { keys: ["pork chop"], label: "Pork chop (~6 oz cooked)", protein: 39, carbs: 0, fat: 14, calories: 290 },
  { keys: ["salmon"], label: "Salmon (~6 oz cooked)", protein: 34, carbs: 0, fat: 12, calories: 241 },
  { keys: ["tuna"], label: "Tuna (~5 oz can in water)", protein: 33, carbs: 0, fat: 1, calories: 150 },
  { keys: ["shrimp"], label: "Shrimp (~4 oz cooked)", protein: 24, carbs: 1, fat: 0, calories: 112 },
  { keys: ["cod", "tilapia", "white fish"], label: "White fish (~6 oz cooked)", protein: 36, carbs: 0, fat: 3, calories: 180 },
  { keys: ["greek yogurt", "yogurt"], label: "Greek yogurt (~170g)", protein: 17, carbs: 6, fat: 0, calories: 100 },
  { keys: ["cottage cheese"], label: "Cottage cheese (~½ cup 2%)", protein: 14, carbs: 5, fat: 2, calories: 90 },
  { keys: ["cream cheese"], label: "Cream cheese (2 tbsp)", protein: 2, carbs: 2, fat: 10, calories: 100 },
  { keys: ["cheddar", "cheese"], label: "Cheddar (~1 oz)", protein: 7, carbs: 0, fat: 9, calories: 113 },
  { keys: ["mozzarella"], label: "Mozzarella (~1 oz)", protein: 7, carbs: 1, fat: 6, calories: 85 },
  { keys: ["milk", "dairy milk"], label: "Milk (1 cup 2%)", protein: 8, carbs: 12, fat: 5, calories: 122 },
  { keys: ["almond milk"], label: "Almond milk (1 cup unsweetened)", protein: 1, carbs: 1, fat: 3, calories: 30 },
  { keys: ["oat milk"], label: "Oat milk (1 cup)", protein: 3, carbs: 16, fat: 5, calories: 120 },
  { keys: ["soy milk"], label: "Soy milk (1 cup)", protein: 7, carbs: 9, fat: 4, calories: 105 },
  { keys: ["protein shake", "protein powder"], label: "Protein shake (~12 oz)", protein: 25, carbs: 3, fat: 2, calories: 130 },
  { keys: ["protein bar"], label: "Protein bar (typical)", protein: 20, carbs: 25, fat: 7, calories: 250 },
  { keys: ["granola bar"], label: "Granola bar (1)", protein: 2, carbs: 24, fat: 6, calories: 140 },
  { keys: ["avocado"], label: "Avocado (½ medium)", protein: 2, carbs: 4, fat: 11, calories: 120 },
  { keys: ["olive oil"], label: "Olive oil (1 tbsp)", protein: 0, carbs: 0, fat: 14, calories: 120 },
  { keys: ["butter"], label: "Butter (1 tbsp)", protein: 0, carbs: 0, fat: 12, calories: 102 },
  { keys: ["peanut butter"], label: "Peanut butter (2 tbsp)", protein: 8, carbs: 6, fat: 16, calories: 190 },
  { keys: ["almonds"], label: "Almonds (~1 oz / 23 nuts)", protein: 6, carbs: 6, fat: 14, calories: 164 },
  { keys: ["trail mix"], label: "Trail mix (~¼ cup)", protein: 4, carbs: 9, fat: 7, calories: 100 },
  { keys: ["popcorn"], label: "Air-popped popcorn (~3 cups)", protein: 3, carbs: 19, fat: 1, calories: 93 },
  { keys: ["pretzels"], label: "Pretzels (~1 oz handful)", protein: 3, carbs: 22, fat: 1, calories: 110 },
  { keys: ["chips", "potato chips"], label: "Potato chips (~1 oz bag)", protein: 2, carbs: 15, fat: 10, calories: 160 },
  { keys: ["sushi roll"], label: "Sushi roll (California, ~8 pcs)", protein: 9, carbs: 38, fat: 7, calories: 255 },
  { keys: ["burrito"], label: "Bean & cheese burrito (typical)", protein: 14, carbs: 52, fat: 12, calories: 380 },
  { keys: ["taco"], label: "Ground beef tacos (2 hard shell)", protein: 18, carbs: 24, fat: 18, calories: 340 },
  { keys: ["burger"], label: "Cheeseburger (fast-food single)", protein: 17, carbs: 33, fat: 14, calories: 320 },
  { keys: ["pizza"], label: "Pizza (1 slice cheese, 14\")", protein: 12, carbs: 36, fat: 10, calories: 285 },
  { keys: ["hot dog"], label: "Hot dog (1 bun + frank)", protein: 11, carbs: 24, fat: 15, calories: 290 },
  { keys: ["sandwich"], label: "Turkey sandwich (deli + 2 slices bread)", protein: 22, carbs: 34, fat: 8, calories: 320 },
  { keys: ["ramen"], label: "Instant ramen (1 package prepared)", protein: 10, carbs: 52, fat: 15, calories: 380 },
  { keys: ["soup", "tomato soup", "vegetable soup"], label: "Soup (~1 cup, tomato or veg)", protein: 2, carbs: 12, fat: 3, calories: 90 },
  { keys: ["chili"], label: "Chili (~1 cup with beans & beef)", protein: 18, carbs: 25, fat: 12, calories: 280 },
  { keys: ["lasagna"], label: "Lasagna (~1 piece home-style)", protein: 20, carbs: 35, fat: 18, calories: 380 },
  { keys: ["ice cream"], label: "Ice cream (~½ cup vanilla)", protein: 3, carbs: 16, fat: 7, calories: 140 },
  { keys: ["dark chocolate"], label: "Dark chocolate (~1 oz 70%)", protein: 2, carbs: 13, fat: 12, calories: 170 },
  { keys: ["cookie"], label: "Chocolate chip cookie (1 large)", protein: 2, carbs: 28, fat: 12, calories: 220 },
  { keys: ["donut"], label: "Glazed donut (1 medium)", protein: 3, carbs: 31, fat: 14, calories: 260 },
  { keys: ["beer"], label: "Beer (12 oz)", protein: 1, carbs: 13, fat: 0, calories: 150 },
  { keys: ["wine"], label: "Wine (5 oz)", protein: 0, carbs: 4, fat: 0, calories: 125 },
];

/**
 * Suggest macros from past logs (exact or similar food text) or generic presets.
 * @param {unknown} macroLog
 * @param {string} inputRaw
 * @returns {{ source: "history", matchKind: "exact" | "similar", displayLabel: string, protein: number, carbs: number, fat: number, calories: number } | { source: "generic", displayLabel: string, protein: number, carbs: number, fat: number, calories: number } | null}
 */
export function findMacroSuggestionForInput(macroLog, inputRaw) {
  const key = normalizeMacroFoodKey(inputRaw);
  if (key.length < 2) return null;
  const lookup = getMacroFoodHistoryLookup(macroLog);
  const exact = lookup.get(key);
  if (exact) {
    return {
      source: "history",
      matchKind: "exact",
      displayLabel: exact.displayFood,
      protein: exact.protein,
      carbs: exact.carbs,
      fat: exact.fat,
      calories: exact.calories,
    };
  }
  let best = null;
  let bestScore = 0;
  for (const [histKey, row] of lookup) {
    let score = 0;
    if (histKey.includes(key) && key.length >= 3) score = 60 + Math.min(histKey.length, 40);
    else if (key.includes(histKey) && histKey.length >= 4) score = 50 + Math.min(histKey.length, 40);
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  if (best && bestScore >= 50) {
    return {
      source: "history",
      matchKind: "similar",
      displayLabel: best.displayFood,
      protein: best.protein,
      carbs: best.carbs,
      fat: best.fat,
      calories: best.calories,
    };
  }
  for (const preset of MACRO_GENERIC_PRESETS) {
    for (const kw of preset.keys) {
      const nk = normalizeMacroFoodKey(kw);
      if (nk.length < 3) continue;
      if (key === nk || key.includes(nk) || nk.includes(key)) {
        return {
          source: "generic",
          displayLabel: preset.label,
          protein: preset.protein,
          carbs: preset.carbs,
          fat: preset.fat,
          calories: preset.calories,
        };
      }
    }
  }
  return null;
}

export function formatHealthForCoach(health) {
  const h = normalizeHealth(health);
  const lines = [];
  const p = h.profile;
  if (healthProfileComplete(h)) {
    const { feet, inches } = cmToFeetInches(p.heightCm);
    const hStr = feet === "" ? `${p.heightCm}cm` : `${feet}ft ${inches}in (~${p.heightCm}cm)`;
    const wLb = formatWeightLbFromKg(p.weightKg);
    lines.push(
      `Body stats: age ${p.age}, height ${hStr}, weight ${wLb ? `${wLb} lb` : ""} (~${p.weightKg}kg), goal ${p.goal}, activity x${p.activity}.`
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
    const gLb = formatWeightLbFromKg(p.goalWeightKg);
    const cLb = formatWeightLbFromKg(p.weightKg);
    lines.push(`Goal weight: ${gLb} lb (~${p.goalWeightKg}kg) from current ${cLb} lb (~${p.weightKg}kg).`);
  }
  const progs = (h.programs || []).filter((p) => p.exercises?.length);
  if (progs.length) {
    lines.push(
      `Saved workout programs: ${progs
        .map((p) => {
          const ex = p.exercises
            .slice(0, 6)
            .map((b) => formatExerciseBlockLine(b))
            .join("; ");
          return `${p.name} (${p.exercises.length} moves): ${ex}${p.exercises.length > 6 ? "…" : ""}`;
        })
        .join(" | ")}`
    );
  }
  const wr = (h.weekRoutineProgramIds || [])
    .map((id) => getProgramById(h, id))
    .filter(Boolean)
    .map((p) => p.name);
  if (wr.length) {
    lines.push(
      `Weekly gym rotation: ${wr.join(" → ")}. The next guided workout uses the program at the current position, then advances (wraps to the first after the last).`
    );
  }

  const mon = mondayKeyForDayKey(new Date().toISOString().slice(0, 10));
  const plan = getEffectiveWeekPlan(h, mon);
  const bits = DAY_KEYS.map((k) => (plan[k] && String(plan[k]).trim() ? `${k}: ${String(plan[k]).trim().slice(0, 120)}` : "")).filter(Boolean);
  if (bits.length) lines.push(`Legacy week notes (if any): ${bits.join(" | ")}`);
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
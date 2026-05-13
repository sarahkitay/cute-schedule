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
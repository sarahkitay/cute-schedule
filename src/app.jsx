import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactDOM, { flushSync } from "react-dom";
import { 
  StarIcon, StarEmptyIcon, TrashIcon, SparkleIcon, MoonIcon, CelebrateIcon, WindDownIcon,
  SettingsIcon, CloseIcon, ChevronLeftIcon, ChevronRightIcon, RepeatIcon, CalendarIcon,
  LightEnergyIcon, MediumEnergyIcon, HeavyEnergyIcon, GoodFeelingIcon, NeutralFeelingIcon, HardFeelingIcon, DumbbellIcon, MenuIcon,
  CheckIcon, FinanceIcon, BulletIcon
} from "./Icons";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { apiUrl } from "./apiBase";
import {
  notificationService,
  bootstrapNativePushOnStartup,
  resyncIosTaskLocalNotifications,
  refreshNativeNotificationDiagnostics,
} from "./notifications";
import {
  buildTaskPushReminderEntriesForTask,
  normalizeTaskReminderFields,
  TASK_REMINDER_BEFORE_OPTIONS,
  taskForPushReminders,
} from "./taskReminderModel.js";
import { generateCompletionMessage, checkEnergyBalance } from "./completionRitual";
import { 
  getTimeOfDay, 
  inferEmotionalState, 
  generateWindDownMessage,
  getRandomQuote,
  GENTLE_ANCHOR_PROMPT
} from "./gentleAnchor";
import cloudStorage from "./cloudStorage";
import { THEMES } from "./themes";
import { OnboardingFlow } from "./OnboardingFlow";
import { FeatureWalkthrough } from "./FeatureWalkthrough";
import { HealthPage } from "./HealthPage";
import { WorkoutProgramPickerModal } from "./WorkoutProgramPickerModal";
import {
  bumpWeekRoutineCursor,
  formatHealthForCoach,
  healthProfileComplete,
  listSelectablePrograms,
  normalizeHealth,
  normalizeNavVisibility,
  normalizeDockOrder,
  normalizeExerciseBlock,
  normalizeProgramRecord,
  resolveProgramForTask,
  textHintsWorkoutTask,
} from "./health/healthModel";
import {
  COACH_SUGGESTION_SOURCE,
  buildCoachIntelligenceSnapshot,
  formatIntelligenceForApi,
  generateCoachV2Fallback,
  isAffirmationToCoach,
  loadCoachLearning,
  parseCoachApiPayload,
  applyLiveDaySuggestionGuards,
  recordCoachSuggestedTaskAbandoned,
  recordCoachSuggestedTaskCompleted,
  recordCoachSuggestedTaskPostponed,
  recordSuggestionAccepted,
  recordSuggestionDeclined,
} from "./coach";
import {
  aggregateTopExpensesAcrossMonths,
  appendTaskBehaviorEvent,
  averageOverArchivedMonths,
  buildFinanceHintsForCoach,
  buildScheduleStreakCoachLine,
  computeCalendarCompletionStreak,
  rollingSevenDaySchedulePerfect,
  DEFAULT_GROCERY_KEYWORDS,
  financeDecalForCurrentMonth,
  financeMonthKeyFromDayKey,
  formatTaskBehaviorForCoach,
  rollFinanceMonthsForward,
  processMissedEndOfDayBacklog,
  subscribeTaskBehaviorDirty,
  summarizeTaskBehaviorForHome,
  normalizeGroceryKeywordsFromProfile,
  taskMatchesGroceryKeywords,
} from "./groceryTaskCoachHelpers.js";
import {
  subscribeAuthState,
  completeAuthRedirectIfNeeded,
  migrateLegacyDeviceScheduleIfNeeded,
  signInWithApple,
  signUpWithEmail,
  signInWithEmail as emailPasswordSignIn,
  authSignOut,
  deleteCurrentUserAccount,
  isFirebaseEnabled,
  ensureSignedIn,
} from "./firebase";

/** ====== Config ====== **/
const DEFAULT_CATEGORIES = ["Work", "School", "Personal"];
const CUSTOM_CATEGORIES_KEY = "cute_schedule_categories_v1";
const STORAGE_KEY = "cute_schedule_v3";
const COACH_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const COACH_STORAGE_KEY = "cute_schedule_coach_meta_v1";
const THEME_STORAGE_KEY = "cute_schedule_theme_v1";
/** Legacy payloads may include moodboard; we no longer persist custom background images. */
const EMPTY_MOODBOARD = Object.freeze({ imageUrl: "", text: "" });
const ACCOUNT_DELETE_CONFIRM_PHRASE = "DELETE";

/** True when running inside the Capacitor iOS/Android shell (not the browser site). */
function isCapacitorNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

const COACH_USER_PROFILE_KEY = "cute_schedule_coach_profile_v1";
const NOTES_STORAGE_KEY = "cute_schedule_notes_v1";
const PATTERNS_STORAGE_KEY = "cute_schedule_patterns_v1";
const HABITS_STORAGE_KEY = "cute_schedule_habits_v1";
const ONBOARDING_DONE_KEY = "cute_schedule_onboarding_done_v1";
const FULL_WALKTHROUGH_DONE_KEY = "cute_schedule_full_walkthrough_done_v1";
const QUICK_WALKTHROUGH_DONE_KEY = "cute_schedule_quick_walkthrough_done_v1";
const BIRTHDAY_NOTIF_KEY = "cute_schedule_birthday_notif_date_v1";

function readOnboardingDone() {
  try {
    return localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

const patternsDirtyListeners = new Set();
function notifyPatternsDirty() {
  patternsDirtyListeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

function defaultHabitTracker() {
  return { habits: [], log: {} };
}

function loadHabitTrackerFromDisk() {
  try {
    const raw = localStorage.getItem(HABITS_STORAGE_KEY);
    if (!raw) return defaultHabitTracker();
    const o = JSON.parse(raw);
    const rawHabits = Array.isArray(o.habits) ? o.habits : [];
    return {
      habits: rawHabits.map(normalizeHabitRow).filter(Boolean),
      log: o.log && typeof o.log === "object" ? o.log : {},
    };
  } catch {
    return defaultHabitTracker();
  }
}

function findTaskInAppState(appState, dayKey, hourKey, category, taskId) {
  const list = appState?.days?.[dayKey]?.hours?.[hourKey]?.[category];
  if (!Array.isArray(list)) return null;
  return list.find((t) => t.id === taskId) || null;
}

function buildHabitSummaryForCoach(tracker, dayKey, lastN = 7) {
  const habits = tracker?.habits || [];
  const log = tracker?.log || {};
  if (habits.length === 0) return null;
  const lines = [];
  const d = new Date(dayKey + "T12:00:00");
  for (let i = 0; i < lastN; i++) {
    const x = new Date(d);
    x.setDate(x.getDate() - i);
    const k = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    const dayLog = log[k];
    if (!dayLog || typeof dayLog !== "object") continue;
    const parts = [];
    for (const h of habits) {
      const v = dayLog[h.id];
      if (v === "yes" || v === "no") {
        parts.push(`${h.label} (${h.direction === "break" ? "break bad habit" : "build habit"}): ${v === "yes" ? "positive" : "slip / not today"}`);
      }
    }
    if (parts.length) lines.push(`${k}: ${parts.join("; ")}`);
  }
  return lines.length ? lines.join("\n") : "No check-ins logged yet this week.";
}

/** Compact 7-day view for coach: where hours had tasks / heavy load (client-only). */
function buildCoachWeekAtAGlance(days, categories, centerKey) {
  if (!days || typeof days !== "object" || !centerKey) return [];
  const d0 = new Date(`${centerKey}T12:00:00`);
  if (Number.isNaN(d0.getTime())) return [];
  const start = new Date(d0);
  start.setDate(start.getDate() - 6);
  const rows = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dayNum = String(d.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${dayNum}`;
    const day = days[key];
    const hours = (day && day.hours) || {};
    const blocks = [];
    for (const hk of Object.keys(hours).sort()) {
      const byCat = hours[hk] || {};
      let total = 0;
      let openHeavy = 0;
      for (const cat of categories) {
        const arr = Array.isArray(byCat[cat]) ? byCat[cat] : [];
        for (const t of arr) {
          total += 1;
          if (!t.done && t.energyLevel === "HEAVY") openHeavy += 1;
        }
      }
      if (total > 0) blocks.push({ hour: hk, total, openHeavy });
    }
    rows.push({
      date: key,
      weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()],
      blocks,
    });
  }
  return rows;
}
const FINANCE_STORAGE_KEY = "cute_schedule_finance_v1";
const PROFILE_STORAGE_KEY = "cute_schedule_profile_v1";
const HEALTH_STORAGE_KEY = "cute_schedule_health_v1";

/** Defaults for Notifications dashboard (task/habit push + in-app habit cadence). */
const NOTIFICATION_PREFS_DEFAULTS = Object.freeze({
  taskPushEnabled: true,
  habitPushEnabled: true,
  taskRemindBeforeEnabled: true,
  taskRemindAtStartEnabled: true,
  taskRemindBeforeMinutes: 5,
  /** daily | hourly | every30 | custom - custom uses each habit’s Hourly / Choose times from saved data */
  habitReminderMode: "custom",
  habitQuietStart: "09:00",
  habitQuietEnd: "22:00",
  habitDailyTime: "09:00",
});

function normalizeNotificationPrefs(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const mode =
    o.habitReminderMode === "daily" ||
    o.habitReminderMode === "hourly" ||
    o.habitReminderMode === "every30" ||
    o.habitReminderMode === "custom"
      ? o.habitReminderMode
      : "custom";
  const clampMin = (v, d) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return d;
    return Math.min(120, Math.max(1, n));
  };
  const tq = (k, def) => {
    const v = o[k];
    return typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : def;
  };
  return {
    taskPushEnabled: typeof o.taskPushEnabled === "boolean" ? o.taskPushEnabled : NOTIFICATION_PREFS_DEFAULTS.taskPushEnabled,
    habitPushEnabled: typeof o.habitPushEnabled === "boolean" ? o.habitPushEnabled : NOTIFICATION_PREFS_DEFAULTS.habitPushEnabled,
    taskRemindBeforeEnabled:
      typeof o.taskRemindBeforeEnabled === "boolean" ? o.taskRemindBeforeEnabled : NOTIFICATION_PREFS_DEFAULTS.taskRemindBeforeEnabled,
    taskRemindAtStartEnabled:
      typeof o.taskRemindAtStartEnabled === "boolean" ? o.taskRemindAtStartEnabled : NOTIFICATION_PREFS_DEFAULTS.taskRemindAtStartEnabled,
    taskRemindBeforeMinutes: clampMin(o.taskRemindBeforeMinutes ?? NOTIFICATION_PREFS_DEFAULTS.taskRemindBeforeMinutes, 5),
    habitReminderMode: mode,
    habitQuietStart: tq("habitQuietStart", NOTIFICATION_PREFS_DEFAULTS.habitQuietStart),
    habitQuietEnd: tq("habitQuietEnd", NOTIFICATION_PREFS_DEFAULTS.habitQuietEnd),
    habitDailyTime: tq("habitDailyTime", NOTIFICATION_PREFS_DEFAULTS.habitDailyTime),
  };
}

/** Defaults for new-task reminders (per-task overrides in task details). */
const PROFILE_REMINDER_DEFAULTS = {
  defaultTaskRemindersOn: true,
  defaultRemindBeforeMinutes: 10,
  defaultRemindAtStart: true,
};

const PROFILE_COMPLETION_DEFAULTS = {
  completionAffirmationsOn: true,
  /** @type {'supportive' | 'matter-of-fact' | 'funny' | 'harsh'} */
  completionAffirmationTone: "supportive",
};

const COMPLETION_TONE_IDS = ["supportive", "matter-of-fact", "funny", "harsh"];

function normalizeSavedGroceryLists(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const items = Array.isArray(x.items)
        ? x.items
            .map((it) => ({
              id: it.id || uid(),
              text: String(it.text || "").trim(),
              done: !!it.done,
            }))
            .filter((it) => it.text)
        : [];
      return {
        id: x.id || uid(),
        title: String(x.title || "Saved list").trim() || "Saved list",
        savedAt: typeof x.savedAt === "string" ? x.savedAt : new Date().toISOString(),
        items,
      };
    })
    .filter(Boolean)
    .slice(0, 40);
}

function normalizeGroceryKeywordArray(raw) {
  if (Array.isArray(raw)) {
    const out = [...new Set(raw.map((k) => String(k).trim().toLowerCase()).filter(Boolean))];
    return out.length ? out : null;
  }
  if (typeof raw === "string" && raw.trim()) {
    const out = [...new Set(raw.split(/[,;\n]+/).map((k) => k.trim().toLowerCase()).filter(Boolean))];
    return out.length ? out : null;
  }
  return null;
}

function loadProfileFromDisk() {
  const base = {
    userName: "",
    userBirthday: "",
    ...PROFILE_REMINDER_DEFAULTS,
    ...PROFILE_COMPLETION_DEFAULTS,
    navVisibility: normalizeNavVisibility(null),
    dockOrder: normalizeDockOrder(null),
    notificationPrefs: normalizeNotificationPrefs(null),
    groceryKeywords: null,
    grocerySavedLists: [],
    logMissedTasksEod: true,
  };
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return base;
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") return base;
    const toneRaw = typeof p.completionAffirmationTone === "string" ? p.completionAffirmationTone.trim() : "";
    const completionAffirmationTone = COMPLETION_TONE_IDS.includes(toneRaw)
      ? /** @type {'supportive' | 'matter-of-fact' | 'funny' | 'harsh'} */ (toneRaw)
      : PROFILE_COMPLETION_DEFAULTS.completionAffirmationTone;
    const gkw = normalizeGroceryKeywordArray(p.groceryKeywords);
    return {
      userName: typeof p.userName === "string" ? p.userName : "",
      userBirthday: typeof p.userBirthday === "string" ? p.userBirthday : "",
      defaultTaskRemindersOn: p.defaultTaskRemindersOn !== false,
      defaultRemindBeforeMinutes:
        typeof p.defaultRemindBeforeMinutes === "number" &&
        Number.isFinite(p.defaultRemindBeforeMinutes) &&
        p.defaultRemindBeforeMinutes > 0
          ? Math.round(p.defaultRemindBeforeMinutes)
          : PROFILE_REMINDER_DEFAULTS.defaultRemindBeforeMinutes,
      defaultRemindAtStart: p.defaultRemindAtStart !== false,
      completionAffirmationsOn: typeof p.completionAffirmationsOn === "boolean" ? p.completionAffirmationsOn : true,
      completionAffirmationTone,
      navVisibility: normalizeNavVisibility(p.navVisibility),
      dockOrder: normalizeDockOrder(p.dockOrder),
      notificationPrefs: normalizeNotificationPrefs(p.notificationPrefs),
      groceryKeywords: gkw,
      grocerySavedLists: normalizeSavedGroceryLists(p.grocerySavedLists),
      logMissedTasksEod: typeof p.logMissedTasksEod === "boolean" ? p.logMissedTasksEod : true,
    };
  } catch {
    return base;
  }
}

function mergeCloudProfile(prev, incoming) {
  const inc = incoming && typeof incoming === "object" ? incoming : {};
  const base = { ...PROFILE_REMINDER_DEFAULTS, ...PROFILE_COMPLETION_DEFAULTS, ...prev };
  const toneRaw = typeof inc.completionAffirmationTone === "string" ? inc.completionAffirmationTone.trim() : "";
  const completionAffirmationTone = COMPLETION_TONE_IDS.includes(toneRaw)
    ? /** @type {'supportive' | 'matter-of-fact' | 'funny' | 'harsh'} */ (toneRaw)
    : COMPLETION_TONE_IDS.includes(String(base.completionAffirmationTone))
      ? /** @type {'supportive' | 'matter-of-fact' | 'funny' | 'harsh'} */ (base.completionAffirmationTone)
      : PROFILE_COMPLETION_DEFAULTS.completionAffirmationTone;
  return {
    userName: typeof inc.userName === "string" ? inc.userName : base.userName,
    userBirthday: typeof inc.userBirthday === "string" ? inc.userBirthday : base.userBirthday,
    defaultTaskRemindersOn:
      typeof inc.defaultTaskRemindersOn === "boolean" ? inc.defaultTaskRemindersOn : base.defaultTaskRemindersOn,
    defaultRemindBeforeMinutes:
      typeof inc.defaultRemindBeforeMinutes === "number" && inc.defaultRemindBeforeMinutes > 0
        ? Math.round(inc.defaultRemindBeforeMinutes)
        : base.defaultRemindBeforeMinutes,
    defaultRemindAtStart:
      typeof inc.defaultRemindAtStart === "boolean" ? inc.defaultRemindAtStart : base.defaultRemindAtStart,
    completionAffirmationsOn:
      typeof inc.completionAffirmationsOn === "boolean"
        ? inc.completionAffirmationsOn
        : typeof base.completionAffirmationsOn === "boolean"
          ? base.completionAffirmationsOn
          : true,
    completionAffirmationTone,
    navVisibility: normalizeNavVisibility({
      ...normalizeNavVisibility(base.navVisibility),
      ...(typeof inc.navVisibility === "object" && inc.navVisibility ? inc.navVisibility : {}),
    }),
    dockOrder: normalizeDockOrder(
      Array.isArray(inc.dockOrder) && inc.dockOrder.length ? inc.dockOrder : base.dockOrder
    ),
    notificationPrefs: normalizeNotificationPrefs({
      ...normalizeNotificationPrefs(base.notificationPrefs),
      ...(typeof inc.notificationPrefs === "object" && inc.notificationPrefs ? inc.notificationPrefs : {}),
    }),
    groceryKeywords: normalizeGroceryKeywordArray(inc.groceryKeywords) ?? base.groceryKeywords ?? null,
    grocerySavedLists: normalizeSavedGroceryLists(inc.grocerySavedLists).length
      ? normalizeSavedGroceryLists(inc.grocerySavedLists)
      : normalizeSavedGroceryLists(base.grocerySavedLists || []),
    logMissedTasksEod:
      typeof inc.logMissedTasksEod === "boolean" ? inc.logMissedTasksEod : base.logMissedTasksEod !== false,
  };
}

function loadHealthFromDisk() {
  try {
    const raw = localStorage.getItem(HEALTH_STORAGE_KEY);
    if (!raw) return normalizeHealth(null);
    return normalizeHealth(JSON.parse(raw));
  } catch {
    return normalizeHealth(null);
  }
}

const ROUTINE_TEMPLATE_KEY = "cute_schedule_routine_template_v1";
const ROUTINE_MORNING_TEMPLATE_KEY = "cute_schedule_routine_morning_v1";
const ROUTINE_SCHEDULE_KEY = "cute_schedule_routine_schedule_v1"; // { morning: 'every' | [0..6], night: 'every' | [0..6] }

const ENERGY_LEVELS = {
  LIGHT: { icon: LightEnergyIcon, label: "Light", color: "#90EE90" },
  MEDIUM: { icon: MediumEnergyIcon, label: "Medium", color: "#FFD700" },
  HEAVY: { icon: HeavyEnergyIcon, label: "Heavy", color: "#FF6B6B" }
};

const REPEAT_OPTIONS = {
  NONE: "none",
  DAILY: "daily",
  WEEKLY: "weekly",
  OPTIONAL: "optional"
};

const BEDTIME_ROUTINE = [
  { id: "skincare", text: "Skincare routine" },
  { id: "teeth", text: "Brush your teeth" },
  { id: "tea", text: "Make tea" },
  { id: "chill", text: "Read in bed" },
];

/** Legacy default copy removed "draw"; normalize persisted lists that still match. */
function normalizeBedtimeRoutineTemplate(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((r) => {
    if (!r || typeof r !== "object") return r;
    const text = String(r.text || "").trim();
    if (r.id === "chill" && text === "Read or draw in bed") return { ...r, text: "Read in bed" };
    return r;
  });
}

const MORNING_ROUTINE = [
  { id: "wake", text: "Wake up & stretch" },
  { id: "water", text: "Drink water" },
  { id: "breakfast", text: "Eat breakfast" },
];

/** dayOfWeek 0=Sun..6=Sat; schedule is 'every' or array of 0-6 */
function routineAppliesToday(schedule, dayOfWeek) {
  if (!schedule || schedule === "every") return true;
  return Array.isArray(schedule) && schedule.includes(dayOfWeek);
}


/** ====== Helpers ====== **/
function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/** Task has a workout program (picker result or explicit workout type). */
function taskHasWorkoutProgramAttachment(t) {
  if (!t || t.done) return false;
  if (t.taskType === "workout") return true;
  if (t.workoutProgramId) return true;
  const m = t.workoutProgramMode;
  return m === "queue" || m === "auto" || m === "specific";
}

/** Task has a saved shopping / errand checklist (not only keyword-matched text). */
function taskHasAssociatedGroceryList(t) {
  if (!t?.groceryList || typeof t.groceryList !== "object") return false;
  return Array.isArray(t.groceryList.items);
}

function sumSavingsAccounts(accounts) {
  return (accounts || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
}

function sumDebtAccounts(accounts) {
  return (accounts || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
}

/** Normalize finance from disk/API; migrates legacy totals into account lists. */
function normalizeFinanceLoaded(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const incomeEntries = data.incomeEntries || [];
  const expenseEntries = data.expenseEntries || [];
  let savingsAccounts = Array.isArray(data.savingsAccounts)
    ? data.savingsAccounts.map((a) => ({
        id: a.id || uid(),
        label: String(a.label || "Account").trim() || "Account",
        amount: Number(a.amount) || 0,
      }))
    : [];
  let totalSavings = Number(data.totalSavings) || 0;
  if (savingsAccounts.length === 0 && totalSavings > 0) {
    savingsAccounts = [{ id: uid(), label: "Savings", amount: totalSavings }];
  }
  totalSavings = sumSavingsAccounts(savingsAccounts);
  let debtAccounts = Array.isArray(data.debtAccounts)
    ? data.debtAccounts.map((a) => ({
        id: a.id || uid(),
        label: String(a.label || "Debt").trim() || "Debt",
        amount: Number(a.amount) || 0,
      }))
    : [];
  let totalDebt = Number(data.totalDebt) || 0;
  if (debtAccounts.length === 0 && totalDebt > 0) {
    debtAccounts = [{ id: uid(), label: "Debt", amount: totalDebt }];
  }
  totalDebt = sumDebtAccounts(debtAccounts);
  const monthOverviews = Array.isArray(data.monthOverviews) ? data.monthOverviews : [];
  const debtPayments = Array.isArray(data.debtPayments) ? data.debtPayments : [];
  const creditScoreEntries = Array.isArray(data.creditScoreEntries)
    ? data.creditScoreEntries
        .map((e) => ({
          id: e.id || uid(),
          score: Math.round(Number(e.score) || 0),
          dateISO: typeof e.dateISO === "string" ? e.dateISO : new Date().toISOString(),
        }))
        .filter((e) => e.score > 0)
    : [];
  const financeActiveMonthKey =
    typeof data.financeActiveMonthKey === "string" && /^\d{4}-\d{2}$/.test(data.financeActiveMonthKey)
      ? data.financeActiveMonthKey
      : null;
  return {
    incomeEntries,
    expenseEntries,
    savingsAccounts,
    totalSavings,
    debtAccounts,
    totalDebt,
    totalInvestments: Number(data.totalInvestments) || 0,
    wishList: data.wishList || [],
    subscriptions: data.subscriptions || [],
    bills: data.bills || [],
    bankStatementNotes: data.bankStatementNotes || "",
    monthOverviews,
    debtPayments,
    creditScoreEntries,
    financeActiveMonthKey,
  };
}

function getStoredCategories() {
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length > 0 ? arr : null;
  } catch {
    return null;
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Migrate old RHEA/EPC/Personal to custom categories (Work, Personal by default). Preserves all days. */
function migrateState(saved, categories) {
  if (!saved) return saved;
  const daysSource = saved.days && typeof saved.days === "object" ? saved.days : {};
  if (!categories || categories.length === 0) return { ...saved, days: daysSource };
  const newDays = {};
  Object.entries(daysSource).forEach(([dayKey, day]) => {
    const hours = day.hours || {};
    const newHours = {};
    Object.entries(hours).forEach(([hourKey, byCat]) => {
      if (!byCat || typeof byCat !== "object" || Array.isArray(byCat)) {
        newHours[hourKey] = byCat;
        return;
      }
      const hasLegacy = "RHEA" in byCat || "EPC" in byCat;
      if (!hasLegacy) {
        newHours[hourKey] = byCat;
        return;
      }
      const slot = categories.reduce((acc, c) => ({ ...acc, [c]: [] }), {});
      if (categories[0]) slot[categories[0]] = [...(byCat.RHEA || []), ...(byCat.EPC || [])];
      if (categories[1]) slot[categories[1]] = [...(byCat.Personal || [])];
      for (let i = 2; i < categories.length; i++) slot[categories[i]] = [];
      newHours[hourKey] = slot;
    });
    newDays[dayKey] = { ...day, hours: newHours };
  });
  return { ...saved, days: Object.keys(newDays).length ? newDays : daysSource };
}

function emptySlot(categories) {
  return (categories || []).reduce((acc, c) => ({ ...acc, [c]: [] }), {});
}

function mergeSubscriptionTasksIntoHours(hours, dayKey, subscriptions, categories) {
  const cats = Array.isArray(categories) && categories.length ? categories : DEFAULT_CATEGORIES;
  const firstCat = cats[0];
  const dayOfMonth = parseInt(String(dayKey).slice(8), 10);
  if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31) return hours;
  const subsDue = (subscriptions || []).filter((s) => s.dueDay != null && s.dueDay === dayOfMonth);
  if (subsDue.length === 0) return hours;
  const synthetic = subsDue.map((s) => ({
    id: "sub-" + s.id,
    text: `Pay ${s.name} ($${Number(s.amount).toFixed(2)})`,
    done: false,
    energyLevel: "MEDIUM",
    isSubscription: true,
  }));
  const nextHours = { ...hours };
  const at09 = nextHours["09:00"] || emptySlot(cats);
  nextHours["09:00"] = { ...at09, [firstCat]: [...(at09[firstCat] || []), ...synthetic] };
  return nextHours;
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("cute_schedule: localStorage save failed", e);
  }
}

/** True if persisted state has tasks or monthly rows (avoid Firestore load overwriting newer local data). */
function savedStateHasScheduleData(state) {
  if (!state || typeof state !== "object") return false;
  if (Array.isArray(state.monthly) && state.monthly.length > 0) return true;
  const days = state.days;
  if (!days || typeof days !== "object") return false;
  return Object.values(days).some((day) => {
    const hours = day?.hours || {};
    return Object.values(hours).some((byCat) =>
      Object.values(byCat || {}).some((arr) => Array.isArray(arr) && arr.length > 0)
    );
  });
}

/**
 * When Firestore load wins (shouldApplyCloudAppState=true), merge any tasks the user added
 * in this session that aren't yet in the cloud snapshot, so they aren't silently dropped.
 */
function mergeSessionTasksIntoCloud(cloudState, sessionState) {
  if (!sessionState?.days) return cloudState;
  // Build a set of IDs already present in the cloud snapshot
  const cloudIds = new Set();
  for (const day of Object.values(cloudState.days || {})) {
    for (const byCat of Object.values(day.hours || {})) {
      if (!byCat || typeof byCat !== "object") continue;
      for (const arr of Object.values(byCat)) {
        if (Array.isArray(arr)) arr.forEach((t) => t?.id && cloudIds.add(t.id));
      }
    }
  }
  // Walk session state and collect tasks whose IDs are absent from the cloud
  let result = cloudState;
  for (const [dayKey, day] of Object.entries(sessionState.days || {})) {
    for (const [hourKey, byCat] of Object.entries(day.hours || {})) {
      if (!byCat || typeof byCat !== "object") continue;
      for (const [cat, tasks] of Object.entries(byCat)) {
        if (!Array.isArray(tasks)) continue;
        const fresh = tasks.filter((t) => t?.id && !cloudIds.has(t.id));
        if (fresh.length === 0) continue;
        const cloudDay = result.days?.[dayKey] || { hours: {} };
        const cloudHour = cloudDay.hours?.[hourKey] || {};
        const existing = Array.isArray(cloudHour[cat]) ? cloudHour[cat] : [];
        result = {
          ...result,
          days: {
            ...result.days,
            [dayKey]: {
              ...cloudDay,
              hours: {
                ...(cloudDay.hours || {}),
                [hourKey]: { ...cloudHour, [cat]: [...existing, ...fresh] },
              },
            },
          },
        };
      }
    }
  }
  return result;
}

/** Hour-slot tasks only for one calendar day (not monthly). */
function countTasksInDay(day) {
  if (!day?.hours || typeof day.hours !== "object") return 0;
  let n = 0;
  for (const byCat of Object.values(day.hours)) {
    if (!byCat || typeof byCat !== "object") continue;
    for (const arr of Object.values(byCat)) {
      if (Array.isArray(arr)) n += arr.length;
    }
  }
  return n;
}

/**
 * Firestore may have an older snapshot for "today" (empty hours) while another day (e.g. Wed) is up to date.
 * For each date key, if localStorage has MORE tasks than cloud for that date, keep the local day so today isn't wiped.
 */
function mergeCloudDaysWithRicherLocalDisk(cloudDays, localDays) {
  const c = cloudDays && typeof cloudDays === "object" ? { ...cloudDays } : {};
  for (const [dayKey, localDay] of Object.entries(localDays || {})) {
    const nL = countTasksInDay(localDay);
    if (nL === 0) continue;
    const nC = countTasksInDay(c[dayKey]);
    if (nL > nC) {
      c[dayKey] = {
        ...(c[dayKey] || {}),
        ...(localDay || {}),
        hours: { ...(localDay?.hours || {}) },
        morningRoutine: localDay?.morningRoutine?.length ? localDay.morningRoutine : c[dayKey]?.morningRoutine,
      };
    }
  }
  return c;
}

/** Count day tasks + monthly rows so we can prefer the richer snapshot (Firestore vs disk). */
function countScheduleTasks(state) {
  if (!state || typeof state !== "object") return 0;
  let n = 0;
  const days = state.days;
  if (days && typeof days === "object") {
    for (const day of Object.values(days)) {
      n += countTasksInDay(day);
    }
  }
  if (Array.isArray(state.monthly)) n += state.monthly.length;
  return n;
}

function normalizeText(s) {
  return String(s || "").trim();
}

/** Normalize `<input type="time">` / parsed values to `HH:mm` for stable `hours` keys. */
function normalizeTimeKey(raw) {
  const s = String(raw || "").trim();
  const parts = s.split(":");
  if (parts.length < 2) return "09:00";
  let h = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return "09:00";
  h = Math.min(23, Math.max(0, h));
  m = Math.min(59, Math.max(0, m));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Convert 24-hour to 12-hour time
function to12Hour(time24) {
  const [h, m] = time24.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return time24;

  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

/** 3-hour window key for time-block color: 06 Dawn, 09 Morning, 12 Noon, 15 Afternoon, 18 Evening, 21 Night */
function getTimeBlockKey(hourKey) {
  const [h] = (hourKey || "09:00").split(":").map(Number);
  const hour = isNaN(h) ? 9 : h;
  if (hour >= 0 && hour < 6) return "21";  // night extends to early morning
  if (hour >= 6 && hour < 9) return "06";
  if (hour >= 9 && hour < 12) return "09";
  if (hour >= 12 && hour < 15) return "12";
  if (hour >= 15 && hour < 18) return "15";
  if (hour >= 18 && hour < 21) return "18";
  return "21";
}

function addDaysKey(dayKeyStr, deltaDays) {
  const [y, m, d] = dayKeyStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return todayKey(dt);
}

/** Stable habit row incl. reminder fields (local + cloud). */
function normalizeHabitRow(h) {
  if (!h || typeof h !== "object" || h.id == null) return null;
  const sch = h.reminderSchedule;
  const reminderSchedule = sch === "hourly" || sch === "hours" ? sch : "none";
  const rawHours = Array.isArray(h.reminderHours) ? h.reminderHours : [];
  const reminderHours =
    reminderSchedule === "hours"
      ? [...new Set(rawHours.map((t) => normalizeTimeKey(t)).filter(Boolean))].sort()
      : [];
  return {
    ...h,
    id: String(h.id),
    label: String(h.label || "").trim() || "Habit",
    direction: h.direction === "break" ? "break" : "build",
    reminderSchedule,
    reminderHours,
    reminderPushEnabled: h.reminderPushEnabled === false ? false : true,
  };
}

function clockMinutesFromDate(d) {
  return d.getHours() * 60 + d.getMinutes();
}

/** Inclusive window [start, end] by clock (same calendar day). */
function clockWithinQuietWindow(d, startHHmm, endHHmm) {
  const t = clockMinutesFromDate(d);
  const [sh, sm] = normalizeTimeKey(startHHmm).split(":").map(Number);
  const [eh, em] = normalizeTimeKey(endHHmm).split(":").map(Number);
  const a = sh * 60 + sm;
  const b = eh * 60 + em;
  if (a <= b) return t >= a && t <= b;
  return t >= a || t <= b;
}

/** Push reminder rows for habits (global cadence + quiet hours, or custom per-habit). */
function habitReminderPushEntries(habits, dayKeyToday, nowMs, maxAtMs, notificationPrefsRaw) {
  const prefs = normalizeNotificationPrefs(notificationPrefsRaw);
  const out = [];
  if (!Array.isArray(habits) || !prefs.habitPushEnabled) return out;

  const pushHourlySlots = (row) => {
    let cursor = new Date(Math.ceil(nowMs / (60 * 60 * 1000)) * (60 * 60 * 1000));
    if (cursor.getTime() <= nowMs) cursor = new Date(cursor.getTime() + 60 * 60 * 1000);
    let hops = 0;
    while (cursor.getTime() <= maxAtMs && hops < 48) {
      if (clockWithinQuietWindow(cursor, prefs.habitQuietStart, prefs.habitQuietEnd)) {
        const hr = cursor.getHours();
        const mm = cursor.getMinutes();
        out.push({
          at: cursor.toISOString(),
          title: "Habit reminder",
          body: row.label,
          tag: `habit-h-${row.id}-${cursor.getFullYear()}-${cursor.getMonth() + 1}-${cursor.getDate()}-${hr}-${mm}`,
        });
      }
      cursor = new Date(cursor.getTime() + 60 * 60 * 1000);
      hops += 1;
    }
  };

  for (const h of habits) {
    const row = normalizeHabitRow(h);
    if (!row || row.reminderPushEnabled === false) continue;
    const mode = prefs.habitReminderMode;

    if (mode === "daily") {
      const hm = normalizeTimeKey(prefs.habitDailyTime);
      for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
        const dayKey = dayOffset === 0 ? dayKeyToday : addDaysKey(dayKeyToday, 1);
        const atDate = new Date(`${dayKey}T${hm}:00`);
        if (!clockWithinQuietWindow(atDate, prefs.habitQuietStart, prefs.habitQuietEnd)) continue;
        const t = atDate.getTime();
        if (t >= nowMs && t <= maxAtMs) {
          out.push({
            at: atDate.toISOString(),
            title: "Habit reminder",
            body: row.label,
            tag: `habit-d-${row.id}-${dayKey}-${hm}`,
          });
        }
      }
    } else if (mode === "hourly") {
      pushHourlySlots(row);
    } else if (mode === "every30") {
      let cursor = new Date(Math.ceil(nowMs / (30 * 60 * 1000)) * (30 * 60 * 1000));
      if (cursor.getTime() <= nowMs) cursor = new Date(cursor.getTime() + 30 * 60 * 1000);
      let hops = 0;
      while (cursor.getTime() <= maxAtMs && hops < 96) {
        if (clockWithinQuietWindow(cursor, prefs.habitQuietStart, prefs.habitQuietEnd)) {
          const hr = cursor.getHours();
          const mm = cursor.getMinutes();
          out.push({
            at: cursor.toISOString(),
            title: "Habit reminder",
            body: row.label,
            tag: `habit-30-${row.id}-${cursor.getFullYear()}-${cursor.getMonth() + 1}-${cursor.getDate()}-${hr}-${mm}`,
          });
        }
        cursor = new Date(cursor.getTime() + 30 * 60 * 1000);
        hops += 1;
      }
    } else {
      const sch = row.reminderSchedule;
      if (sch === "hourly") {
        pushHourlySlots(row);
      } else if (sch === "hours" && row.reminderHours.length > 0) {
        for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
          const dayKey = dayOffset === 0 ? dayKeyToday : addDaysKey(dayKeyToday, 1);
          for (const hm of row.reminderHours) {
            const atDate = new Date(`${dayKey}T${normalizeTimeKey(hm)}:00`);
            if (!clockWithinQuietWindow(atDate, prefs.habitQuietStart, prefs.habitQuietEnd)) continue;
            const t = atDate.getTime();
            if (t >= nowMs && t <= maxAtMs) {
              out.push({
                at: atDate.toISOString(),
                title: "Habit reminder",
                body: row.label,
                tag: `habit-t-${row.id}-${dayKey}-${normalizeTimeKey(hm)}`,
              });
            }
          }
        }
      }
    }
  }
  return out;
}

/** Viewport-safe fixed position for task / list dropdowns. */
function computeDropdownPosition(rect, opts = {}) {
  const pad = 16;
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const vw =
    typeof window !== "undefined" ? Math.min(vv?.width ?? window.innerWidth, window.innerWidth) : 400;
  const vh =
    typeof window !== "undefined" ? Math.min(vv?.height ?? window.innerHeight, window.innerHeight) : 700;
  const maxH = opts.maxHeight ?? 280;
  const panelW = Math.min(opts.panelWidth ?? 200, vw - pad * 2);
  /** Prefer right edge of anchor (kebab) so the panel extends left - avoids clipping on the right. */
  let left = rect.right - panelW;
  const minLeft = pad;
  const maxLeft = vw - pad - panelW;
  if (left < minLeft) {
    left = Math.min(Math.max(rect.left, minLeft), maxLeft);
  }
  if (left > maxLeft) left = maxLeft;
  left = Math.max(minLeft, Math.min(left, maxLeft));
  /** Nudge slightly left when there is room (keeps bubble off the physical edge / safe area). */
  const leftNudge = opts.leftNudge ?? 12;
  if (left > minLeft && leftNudge > 0) left = Math.max(minLeft, left - leftNudge);
  /** Keep entire panel inside horizontal viewport after nudge (avoids right-edge clip). */
  left = Math.max(minLeft, Math.min(left, vw - pad - panelW));

  let top = rect.bottom + 6;
  if (top + maxH > vh - pad) {
    top = Math.max(pad, rect.top - maxH - 6);
  }
  top = Math.max(pad, Math.min(top, vh - pad - 48));
  return { left, top, width: panelW };
}

function isSameDayKey(a, b) {
  return String(a) === String(b);
}

function formatNlTaskDayHint(dayKey) {
  try {
    return new Date(`${dayKey}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(dayKey);
  }
}

function dayKeyToDow(dayKey) {
  const d = new Date(`${dayKey}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.getDay();
}

/** First `dayKey` on or after `startKey` (inclusive) whose weekday is `dow` (0=Sun … 6=Sat), within `maxDays`. */
function firstDayKeyWithDowOnOrAfter(startKey, dow, maxDays = 14) {
  if (dow == null || dow < 0 || dow > 6) return null;
  for (let i = 0; i < maxDays; i++) {
    const k = addDaysKey(startKey, i);
    if (dayKeyToDow(k) === dow) return k;
  }
  return null;
}

function dowFromDayWord(word) {
  const w = String(word || "").toLowerCase();
  if (w.startsWith("sun")) return 0;
  if (w.startsWith("mon")) return 1;
  if (w.startsWith("tue")) return 2;
  if (w.startsWith("wed")) return 3;
  if (w.startsWith("thu")) return 4;
  if (w.startsWith("fri")) return 5;
  if (w.startsWith("sat")) return 6;
  return null;
}

function expandTwoDigitCalendarYear(yNum, yStr) {
  if (String(yStr || "").length >= 3) return yNum;
  if (yNum < 100) return yNum <= 69 ? 2000 + yNum : 1900 + yNum;
  return yNum;
}

/**
 * Pulls a calendar day from natural language (e.g. tomorrow, 3/26/26, next Monday).
 * @returns {{ targetDayKey: string | null, working: string }}
 */
function extractNlTargetDayKey(workingStr, referenceDayKey) {
  const refKey =
    referenceDayKey && /^\d{4}-\d{2}-\d{2}$/.test(String(referenceDayKey).trim())
      ? String(referenceDayKey).trim()
      : todayKey();
  let working = String(workingStr || "").trim();
  let targetKey = null;

  const slashRe = /\b(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/;
  const sm = working.match(slashRe);
  if (sm) {
    const mo = parseInt(sm[1], 10);
    const da = parseInt(sm[2], 10);
    let yr = parseInt(sm[3], 10);
    yr = expandTwoDigitCalendarYear(yr, sm[3]);
    const dt = new Date(yr, mo - 1, da);
    if (
      mo >= 1 &&
      mo <= 12 &&
      da >= 1 &&
      da <= 31 &&
      dt.getFullYear() === yr &&
      dt.getMonth() === mo - 1 &&
      dt.getDate() === da
    ) {
      targetKey = todayKey(dt);
      working = working.replace(sm[0], " ").replace(/\s+/g, " ").trim();
    }
  }

  if (!targetKey) {
    const iso = working.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (iso) {
      const yr = parseInt(iso[1], 10);
      const mo = parseInt(iso[2], 10);
      const da = parseInt(iso[3], 10);
      const dt = new Date(yr, mo - 1, da);
      if (dt.getFullYear() === yr && dt.getMonth() === mo - 1 && dt.getDate() === da) {
        targetKey = todayKey(dt);
        working = working.replace(iso[0], " ").replace(/\s+/g, " ").trim();
      }
    }
  }

  if (!targetKey) {
    const low = working.toLowerCase();
    if (/\btomorrow\b/.test(low)) {
      targetKey = addDaysKey(refKey, 1);
      working = working.replace(/\btomorrow\b/gi, " ").replace(/\s+/g, " ").trim();
    } else if (/\byesterday\b/.test(low)) {
      targetKey = addDaysKey(refKey, -1);
      working = working.replace(/\byesterday\b/gi, " ").replace(/\s+/g, " ").trim();
    } else if (/\b(?:today|tonight)\b/.test(low)) {
      targetKey = refKey;
      working = working.replace(/\b(?:today|tonight)\b/gi, " ").replace(/\s+/g, " ").trim();
    }
  }

  const dayWord =
    "monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun";
  const nextRe = new RegExp(`\\bnext\\s+(${dayWord})\\b`, "i");
  const thisRe = new RegExp(`\\bthis\\s+(${dayWord})\\b`, "i");
  const bareRe = new RegExp(`\\b(${dayWord})\\b`, "i");

  if (!targetKey) {
    const nm = working.match(nextRe);
    if (nm) {
      const dow = dowFromDayWord(nm[1]);
      if (dow != null) {
        targetKey = firstDayKeyWithDowOnOrAfter(addDaysKey(refKey, 1), dow);
        working = working.replace(nm[0], " ").replace(/\s+/g, " ").trim();
      }
    }
  }
  if (!targetKey) {
    const tm = working.match(thisRe);
    if (tm) {
      const dow = dowFromDayWord(tm[1]);
      if (dow != null) {
        targetKey = firstDayKeyWithDowOnOrAfter(refKey, dow);
        working = working.replace(tm[0], " ").replace(/\s+/g, " ").trim();
      }
    }
  }
  if (!targetKey) {
    const bm = working.match(bareRe);
    if (bm) {
      const dow = dowFromDayWord(bm[1]);
      if (dow != null) {
        targetKey = firstDayKeyWithDowOnOrAfter(refKey, dow);
        working = working.replace(bm[0], " ").replace(/\s+/g, " ").trim();
      }
    }
  }

  return { targetDayKey: targetKey, working };
}

/** Simple NL parse for quick add: "Call Martin 11am", "Work 3pm email", "dentist 2pm tomorrow", "doc 3/26/26 4pm", etc. */
function parseQuickAddNL(str, categories = DEFAULT_CATEGORIES, referenceDayKey = null) {
  const s = String(str || "").trim();
  if (!s) return null;
  const { targetDayKey, working: afterDate } = extractNlTargetDayKey(s, referenceDayKey);
  const cats = Array.isArray(categories) && categories.length ? categories : DEFAULT_CATEGORIES;
  let hour = "09:00";
  let category = cats[0] || "Work";
  let text = afterDate;

  const time12In = afterDate.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (time12In) {
    let h = parseInt(time12In[1], 10);
    const mins = time12In[2] ? parseInt(time12In[2], 10) : 0;
    if (time12In[3].toLowerCase() === "pm" && h < 12) h += 12;
    if (time12In[3].toLowerCase() === "am" && h === 12) h = 0;
    hour = `${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    text = afterDate.replace(time12In[0], "").replace(/\s+/g, " ").trim();
  } else {
    const time24In = afterDate.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (time24In) {
      const h = parseInt(time24In[1], 10);
      const mins = parseInt(time24In[2], 10);
      hour = `${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
      text = afterDate.replace(time24In[0], "").replace(/\s+/g, " ").trim();
    }
  }

  const rest = text.trim();
  const looksLikeVerbWorkOn = /^work\s+on\s+/i.test(rest) && cats.some((c) => c.toLowerCase() === "work");
  if (!looksLikeVerbWorkOn) {
    const sortedCats = [...cats].sort((a, b) => b.length - a.length);
    for (const c of sortedCats) {
      const re = new RegExp(`^${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i");
      const m = rest.match(re);
      if (m) {
        category = cats.find((x) => x.toUpperCase() === m[0].trim().toUpperCase()) || c;
        text = rest.slice(m[0].length).trim();
        break;
      }
    }
  } else {
    text = rest;
    category = cats[0] || "Work";
  }

  if (!text) text = afterDate.replace(/\s+/g, " ").trim();
  const out = { hour: normalizeTimeKey(hour), category, text: text.trim() };
  if (targetDayKey && /^\d{4}-\d{2}-\d{2}$/.test(targetDayKey)) out.targetDayKey = targetDayKey;
  return out;
}

function allTasksInDay(hours, categories = DEFAULT_CATEGORIES) {
  const cats = Array.isArray(categories) && categories.length ? categories : DEFAULT_CATEGORIES;
  const hourEntries = Object.entries(hours || {});
  return hourEntries.flatMap(([hourKey, tasksByCat]) => {
    return cats.flatMap((cat) => {
      return (tasksByCat[cat] || []).map(task => ({
        ...task,
        hour: hourKey,
        category: cat
      }));
    });
  });
}

function hourIsComplete(tasksByCat, categories = DEFAULT_CATEGORIES) {
  const cats = Array.isArray(categories) && categories.length ? categories : DEFAULT_CATEGORIES;
  const tasks = cats.flatMap((c) => tasksByCat?.[c] || []);
  if (tasks.length === 0) return false;
  return tasks.every((t) => t.done);
}

function dayProgress(hours, categories = DEFAULT_CATEGORIES) {
  const tasks = allTasksInDay(hours, categories);
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

function dayIsStarred(hours, categories = DEFAULT_CATEGORIES) {
  const { total, done } = dayProgress(hours, categories);
  return total > 0 && done === total;
}

function getProgressCopy(pct) {
  if (pct === 0) return "Add one task to get started";
  if (pct >= 100) return "You showed up today";
  if (pct >= 1 && pct <= 40) return "Momentum started";
  if (pct >= 41 && pct <= 80) return "You're on a roll";
  if (pct >= 81 && pct <= 99) return "Close it out";
  return "Momentum started";
}

function getDayKeysInMonth(year, month) {
  const days = [];
  const n = new Date(year, month + 1, 0).getDate();
  const m = String(month + 1).padStart(2, "0");
  for (let d = 1; d <= n; d++) {
    days.push(`${year}-${m}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

function getFirstWeekday(year, month) {
  return new Date(year, month, 1).getDay();
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatWeekday(dayKey) {
  return new Date(dayKey + "T00:00:00").toLocaleDateString(undefined, { weekday: "long" });
}

/** ====== Pattern Tracking ====== **/
function loadPatterns() {
  const defaultPatterns = {
    completions: [],
    skippedDays: {},
    completionTimes: [],
    weeklyTotals: {},
    bedtimeCompletedDates: []
  };
  try {
    const raw = localStorage.getItem(PATTERNS_STORAGE_KEY);
    const out = raw ? JSON.parse(raw) : { ...defaultPatterns };
    if (!Array.isArray(out.completions)) out.completions = [];
    if (!Array.isArray(out.completionTimes)) out.completionTimes = [];
    if (!out.skippedDays || typeof out.skippedDays !== "object") out.skippedDays = {};
    if (!out.weeklyTotals || typeof out.weeklyTotals !== "object") out.weeklyTotals = {};
    if (!Array.isArray(out.bedtimeCompletedDates)) out.bedtimeCompletedDates = [];
    return out;
  } catch {
    return { ...defaultPatterns };
  }
}

function savePatterns(patterns) {
  try {
    localStorage.setItem(PATTERNS_STORAGE_KEY, JSON.stringify(patterns));
  } catch (err) {
    console.error('Failed to save patterns:', err);
  }
}

function trackTaskCompletion(task, category, hour, dayKey, feeling = null) {
  const patterns = loadPatterns();
  const completedAt = new Date();
  const dayOfWeek = completedAt.getDay();
  const hourNum = completedAt.getHours();
  
  const completionEntry = {
    dayKey,
    taskId: task.id,
    category,
    hour,
    completedAt: completedAt.toISOString(),
    feeling,
    dayOfWeek,
    hourNum,
  };
  if (task.coachSuggestionId) {
    completionEntry.coachSuggestionId = task.coachSuggestionId;
    completionEntry.source = task.source || COACH_SUGGESTION_SOURCE;
    if (task.sourceSuggestionType) completionEntry.sourceSuggestionType = task.sourceSuggestionType;
    if (task.sourceTaskId) completionEntry.sourceTaskId = task.sourceTaskId;
    if (typeof task.coachSuggestionEdited === "boolean") {
      completionEntry.coachSuggestionEdited = task.coachSuggestionEdited;
    }
  }
  patterns.completions.push(completionEntry);
  
  patterns.completionTimes.push({ hour: hourNum, dayOfWeek });
  
  // Keep last 100 completions
  if (patterns.completions.length > 100) {
    patterns.completions = patterns.completions.slice(-100);
  }
  if (patterns.completionTimes.length > 100) {
    patterns.completionTimes = patterns.completionTimes.slice(-100);
  }
  
  savePatterns(patterns);
  notifyPatternsDirty();
}

/** Call when user completes full bedtime routine (all items done) for ADHD sleep correlation */
function trackBedtimeComplete(dayKey) {
  const patterns = loadPatterns();
  const list = patterns.bedtimeCompletedDates || [];
  if (list.includes(dayKey)) return;
  patterns.bedtimeCompletedDates = [...list, dayKey].slice(-60); // keep last 60 days
  savePatterns(patterns);
  notifyPatternsDirty();
}

function analyzePatterns() {
  const patterns = loadPatterns();
  const now = new Date();
  const today = now.getDay();
  
  // Analyze completion times - when user typically completes tasks
  const morningCompletions = patterns.completionTimes.filter(ct => ct.hour >= 6 && ct.hour < 12).length;
  const afternoonCompletions = patterns.completionTimes.filter(ct => ct.hour >= 12 && ct.hour < 17).length;
  const eveningCompletions = patterns.completionTimes.filter(ct => ct.hour >= 17 && ct.hour < 22).length;
  
  const bestTime = morningCompletions > afternoonCompletions && morningCompletions > eveningCompletions 
    ? 'morning'
    : afternoonCompletions > eveningCompletions ? 'afternoon' : 'evening';
  
  // Analyze category completion rates
  const categoryCounts = {};
  const categoryCompleted = {};
  patterns.completions.forEach(c => {
    categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
    if (c.completedAt) {
      categoryCompleted[c.category] = (categoryCompleted[c.category] || 0) + 1;
    }
  });
  
  // Find least completed category
  let leastCompleted = null;
  let lowestRate = 1;
  Object.keys(categoryCounts).forEach(cat => {
    const rate = categoryCompleted[cat] / (categoryCounts[cat] || 1);
    if (rate < lowestRate) {
      lowestRate = rate;
      leastCompleted = cat;
    }
  });
  
  // Check day-of-week patterns
  const todayCompletions = patterns.completions.filter(c => {
    const cDate = new Date(c.completedAt);
    return cDate.getDay() === today;
  }).length;
  
  // Sleep correlation (ADHD-specific): next-day completions when bedtime routine done vs not
  const bedtimeDates = new Set(patterns.bedtimeCompletedDates || []);
  const completionsByDay = {};
  patterns.completions.forEach(c => {
    if (!c.dayKey) return;
    completionsByDay[c.dayKey] = (completionsByDay[c.dayKey] || 0) + 1;
  });
  const addDays = (dayKeyStr, n) => {
    const [y, m, d] = dayKeyStr.split("-").map(Number);
    const x = new Date(y, m - 1, d);
    x.setDate(x.getDate() + n);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  };
  let withBedtime = 0; let withoutBedtime = 0; let countWith = 0; let countWithout = 0;
  bedtimeDates.forEach(dayKey => {
    const nextKey = addDays(dayKey, 1);
    const n = completionsByDay[nextKey] || 0;
    withBedtime += n;
    countWith++;
  });
  Object.keys(completionsByDay).forEach(dayKey => {
    const prevKey = addDays(dayKey, -1);
    if (bedtimeDates.has(prevKey)) return; // already counted in withBedtime
    withoutBedtime += completionsByDay[dayKey];
    countWithout++;
  });
  const sleepCorrelation = (countWith > 0 || countWithout > 0)
    ? {
        avgNextDayWithBedtime: countWith > 0 ? Math.round((withBedtime / countWith) * 10) / 10 : null,
        avgNextDayWithoutBedtime: countWithout > 0 ? Math.round((withoutBedtime / countWithout) * 10) / 10 : null,
        nightsWithRoutine: countWith,
        nightsWithoutRoutine: countWithout
      }
    : null;
  
  return {
    bestTime,
    leastCompletedCategory: leastCompleted,
    leastCompletedRate: lowestRate,
    todayCompletions,
    totalCompletions: patterns.completions.length,
    sleepCorrelation
  };
}

/** Reveal scroll-reveal sections that already overlap the viewport (IO can miss first paint or post-hydration DOM). */
function flushScrollRevealsInViewport() {
  if (typeof document === "undefined") return;
  const vh = Math.max(
    typeof window !== "undefined" ? window.innerHeight || 0 : 0,
    document.documentElement?.clientHeight || 0,
    1
  );
  document.querySelectorAll(".scroll-reveal:not(.scroll-reveal-visible)").forEach((node) => {
    const r = node.getBoundingClientRect();
    if (r.bottom > -20 && r.top < vh + 200) {
      node.classList.add("scroll-reveal-visible");
    }
  });
}

/** ====== UI Components ====== **/
function Pill({ label }) {
  return <span className="pill pill-personal">{label}</span>;
}

function TabButton({ active, children, onClick }) {
  return (
    <button type="button" className={active ? "tab tab-active" : "tab"} onClick={onClick}>
      {children}
    </button>
  );
}

function ProgressBar({ pct }) {
  return (
    <div className="progress-wrap" aria-label={`Progress ${pct}%`}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ProgressSegments({ total, done }) {
  if (total === 0) return null;
  return (
    <div className="progress-segments" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`progress-segment ${i < done ? "filled" : ""}`} />
      ))}
    </div>
  );
}

// Ultra-minimal hour card with Daily Progress Type/Details mode
function HourCard({
  hourKey,
  tasksByCat,
  categories = DEFAULT_CATEGORIES,
  onToggleTask,
  onToggleEnergyLevel,
  onDeleteTask,
  onDeleteHour,
  onMoveToTomorrow,
  onOpenDropdown,
  taskDropdown,
  expandedTaskKey,
  onExpandTask,
  onOpenGroceryList,
  mode = "type",
  dayKey,
  onPatchTaskReminder,
  onPatchTaskFields,
  onEnsureOptionalRepeat,
  groceryTextMatch,
  onBeginWorkout,
}) {
  const cats = Array.isArray(categories) && categories.length ? categories : DEFAULT_CATEGORIES;
  const complete = hourIsComplete(tasksByCat, cats);
  const [open, setOpen] = useState(true);

  const allTasks = useMemo(() => {
    return cats.flatMap((cat) =>
      (tasksByCat?.[cat] || []).map(t => ({ ...t, category: cat }))
    ).sort((a, b) => {
      // Sort by energy level: Heavy first, then Medium, then Light
      const order = { HEAVY: 0, MEDIUM: 1, LIGHT: 2 };
      const aEnergy = order[a.energyLevel] ?? 1;
      const bEnergy = order[b.energyLevel] ?? 1;
      return aEnergy - bEnergy;
    });
  }, [tasksByCat, cats]);

  const totals = useMemo(() => {
    const total = allTasks.length;
    const done = allTasks.filter((t) => t.done).length;
    return { total, done };
  }, [allTasks]);

  // Don't show hour card if no tasks
  if (totals.total === 0) return null;

  return (
    <div className={complete ? "card card-complete" : "card"} data-time-block={getTimeBlockKey(hourKey)}>
      <div className="card-top">
        <button type="button" className="hour-title" onClick={() => setOpen((v) => !v)}>
          <div className="hour-left">
            <span className="hour-time">{to12Hour(hourKey)}</span>
            <span className="hour-meta">
              {totals.done}/{totals.total}
            </span>
      </div>
          <span className="chev" style={{ fontSize: '14px', opacity: 0.6 }}>{open ? "▾" : "▸"}</span>
        </button>

        {mode === "details" && (
          <button type="button" className="icon-btn danger" title="Remove this hour" onClick={() => onDeleteHour(hourKey)}>
            <CloseIcon />
          </button>
        )}
      </div>

      {open && (
        <div className="card-body-simple">
          <ul className="list">
            {allTasks.map((t) => {
              const itemKey = `${hourKey}-${t.category}-${t.id}`;
              const expanded = expandedTaskKey === itemKey;
              return (
              <li
                key={t.id}
                className={["item", t.done ? "item-done" : "", expanded ? "item-expanded" : ""].filter(Boolean).join(" ")}
                style={{ cursor: "pointer" }}
              >
                <div className="item-main">
                  <label className="check" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={!!t.done} onChange={() => onToggleTask(hourKey, t.category, t.id)} />
                    <span className="checkmark" />
                    <span className={`item-text ${t.done ? 'item-text-done' : ''}`}>
                      {null}
                      {mode === "details" && (
                        <span className="energy-badge" style={{ 
                          marginLeft: '8px',
                          fontSize: '14px',
                          color: ENERGY_LEVELS[t.energyLevel || "MEDIUM"].color,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {React.createElement(ENERGY_LEVELS[t.energyLevel || "MEDIUM"].icon, { style: { width: '14px', height: '14px' } })}
                          {ENERGY_LEVELS[t.energyLevel || "MEDIUM"].label}
                        </span>
                      )}
                      {t.text}
                    </span>
                  </label>

                  <div className="item-actions" style={{ position: 'relative' }}>
                  {mode === "details" && (
                    <>
                      <button
                        type="button"
                        className="energy-btn"
                        title={`Energy: ${ENERGY_LEVELS[t.energyLevel || "MEDIUM"].label} (click to cycle)`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleEnergyLevel(hourKey, t.category, t.id);
                        }}
                        style={{ 
                          backgroundColor: ENERGY_LEVELS[t.energyLevel || "MEDIUM"].color + '20',
                          borderColor: ENERGY_LEVELS[t.energyLevel || "MEDIUM"].color
                        }}
                      >
                        {React.createElement(ENERGY_LEVELS[t.energyLevel || "MEDIUM"].icon)}
                      </button>

                      <button 
                        type="button" 
                        className="icon-btn" 
                        title="Delete task" 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTask(hourKey, t.category, t.id);
                        }}
                      >
                        <TrashIcon />
                      </button>
                    </>
                  )}
                  
                  {!t.done &&
                    typeof onOpenGroceryList === "function" &&
                    (taskHasAssociatedGroceryList(t) ||
                      (typeof groceryTextMatch === "function" && groceryTextMatch(t.text))) && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm grocery-list-btn"
                      title="Open shopping / errand checklist"
                      aria-label="View list for this task"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenGroceryList(hourKey, t.category, t.id);
                      }}
                    >
                      {taskHasAssociatedGroceryList(t) ? "View list" : "List"}
                    </button>
                  )}
                  {!t.done && taskHasWorkoutProgramAttachment(t) && typeof onBeginWorkout === "function" ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm grocery-list-btn"
                      title="Open guided workout on Health"
                      aria-label="Begin workout for this task"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBeginWorkout(dayKey, hourKey, t.category, t);
                      }}
                    >
                      Begin workout
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="icon-btn"
                    title="Task options"
                    onClick={(e) => {
                      e.stopPropagation();
                      const dropdownKey = `${hourKey}-${t.category}-${t.id}`;
                      if (taskDropdown === dropdownKey) {
                        onOpenDropdown(null, null);
                      } else {
                        onOpenDropdown(dropdownKey, e.currentTarget.getBoundingClientRect());
                      }
                    }}
                    data-task-menu-trigger
                    data-task-dropdown-key={`${hourKey}-${t.category}-${t.id}`}
                  >
                    <MenuIcon />
                  </button>
                    <button
                      type="button"
                      className="icon-btn item-expand-btn"
                      title={expanded ? "Collapse" : "Details"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onExpandTask(expanded ? null : itemKey);
                      }}
                    >
                      {expanded ? "▾" : "▸"}
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="item-detail" onClick={(e) => e.stopPropagation()}>
                    <div className="item-detail-row">
                      <span className="item-detail-time">{to12Hour(hourKey)}</span>
                      {mode === "details" && (
                        <span className="energy-badge" style={{ fontSize: '12px', color: ENERGY_LEVELS[t.energyLevel || "MEDIUM"].color }}>
                          {React.createElement(ENERGY_LEVELS[t.energyLevel || "MEDIUM"].icon, { style: { width: 12, height: 12 } })}
                          {ENERGY_LEVELS[t.energyLevel || "MEDIUM"].label}
                        </span>
                      )}
                    </div>
                    {typeof dayKey === "string" && typeof onPatchTaskReminder === "function" ? (
                      <div className="item-detail-reminders" style={{ marginTop: 10, fontSize: 13 }}>
                        {(() => {
                          const r = normalizeTaskReminderFields(t);
                          return (
                            <>
                              <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={r.remindersEnabled}
                                  onChange={(e) => onPatchTaskReminder(dayKey, hourKey, t.category, t.id, { remindersEnabled: e.target.checked })}
                                />
                                Remind me
                              </label>
                              <label style={{ display: "block", marginBottom: 6, opacity: r.remindersEnabled ? 1 : 0.45 }}>
                                Before task starts
                                <select
                                  className="input"
                                  style={{ marginLeft: 8, maxWidth: 140 }}
                                  disabled={!r.remindersEnabled}
                                  value={r.remindBeforeMinutes == null ? "" : String(r.remindBeforeMinutes)}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    onPatchTaskReminder(dayKey, hourKey, t.category, t.id, {
                                      remindBeforeMinutes: v === "" ? null : parseInt(v, 10),
                                    });
                                  }}
                                >
                                  {TASK_REMINDER_BEFORE_OPTIONS.map((o) => (
                                    <option key={String(o.value) + o.label} value={o.value == null ? "" : String(o.value)}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label style={{ display: "flex", alignItems: "center", gap: 8, opacity: r.remindersEnabled ? 1 : 0.45 }}>
                                <input
                                  type="checkbox"
                                  disabled={!r.remindersEnabled}
                                  checked={r.remindAtStart}
                                  onChange={(e) => onPatchTaskReminder(dayKey, hourKey, t.category, t.id, { remindAtStart: e.target.checked })}
                                />
                                Also notify me when task starts
                              </label>
                            </>
                          );
                        })()}
                      </div>
                    ) : null}
                    {typeof dayKey === "string" && typeof onPatchTaskFields === "function" ? (
                      <div className="item-detail-task-note-block">
                        <label className="item-detail-note-label" htmlFor={`task-note-${hourKey}-${t.category}-${t.id}`}>
                          Notes (this task)
                        </label>
                        <textarea
                          id={`task-note-${hourKey}-${t.category}-${t.id}`}
                          className="input item-detail-note-input"
                          rows={2}
                          value={t.taskNote != null ? String(t.taskNote) : ""}
                          onChange={(e) => onPatchTaskFields(dayKey, hourKey, t.category, t.id, { taskNote: e.target.value })}
                          placeholder="Private note…"
                          aria-label="Notes for this task"
                        />
                        {(t.repeat ?? REPEAT_OPTIONS.NONE) === REPEAT_OPTIONS.NONE && typeof onEnsureOptionalRepeat === "function" ? (
                          <button
                            type="button"
                            className="btn btn-sm item-detail-repeat-btn"
                            onClick={() => onEnsureOptionalRepeat(dayKey, hourKey, t.category, t.id)}
                          >
                            <RepeatIcon style={{ width: 14, height: 14, marginRight: 6, verticalAlign: "middle" }} />
                            Add to Past tasks (optional repeat)
                          </button>
                        ) : (t.repeat ?? REPEAT_OPTIONS.NONE) === REPEAT_OPTIONS.OPTIONAL ? (
                          <span className="item-detail-repeat-hint">In Past tasks</span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="item-detail-actions item-detail-actions-spaced">
                      {taskHasWorkoutProgramAttachment(t) && onBeginWorkout ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            onBeginWorkout(dayKey, hourKey, t.category, t);
                            onExpandTask(null);
                          }}
                        >
                          Begin workout
                        </button>
                      ) : null}
                      <button type="button" className="btn btn-sm" onClick={() => { onMoveToTomorrow(hourKey, t.category, t.id); onExpandTask(null); }}>
                        <CalendarIcon style={{ width: 14, height: 14, marginRight: 4 }} /> Move to tomorrow
                      </button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => { onDeleteTask(hourKey, t.category, t.id); onExpandTask(null); }}>
                        <TrashIcon style={{ width: 14, height: 14, marginRight: 4 }} /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ); })}
          </ul>
        </div>
      )}
    </div>
  );
}

function MorningRoutine({ routine, onToggle }) {
  const allDone = (routine || []).length > 0 && (routine || []).every((r) => r.done);
  return (
    <div className="bedtime morning-routine">
      <div className="bedtime-header">
        <h3 className="bedtime-title">
          <SparkleIcon style={{ display: "inline-block", marginRight: "8px", verticalAlign: "middle" }} />
          Morning routine
        </h3>
        <p className="bedtime-subtitle">Start your day</p>
      </div>
      <ul className="bedtime-list">
        {(routine || []).map((item) => (
          <li key={item.id} className={item.done ? "bedtime-item bedtime-done" : "bedtime-item"}>
            <label className="check">
              <input type="checkbox" checked={!!item.done} onChange={() => onToggle(item.id)} />
              <span className="checkmark" />
              <span className={`item-text ${item.done ? "item-text-done" : ""}`}>{item.text}</span>
            </label>
          </li>
        ))}
      </ul>
      {allDone && (
        <div className="bedtime-message">
          <p className="bedtime-congrats">Good start to your day.</p>
        </div>
      )}
    </div>
  );
}

function BedtimeRoutine({ routine, onToggle, allTasksDone }) {
  const allDone = (routine || []).every((r) => r.done);

  // Use Gentle Anchor wind-down messages
  const windDownMsg = generateWindDownMessage(allTasksDone);
  const quote = getRandomQuote();

  return (
    <div className="bedtime">
      <div className="bedtime-header">
        <h3 className="bedtime-title">
          <WindDownIcon style={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }} />
          Wind Down Time
        </h3>
        <p className="bedtime-subtitle">10:00 PM - 11:00 PM bedtime routine</p>
      </div>

      <ul className="bedtime-list">
        {(routine || []).map((item) => (
          <li key={item.id} className={item.done ? "bedtime-item bedtime-done" : "bedtime-item"}>
            <label className="check">
              <input type="checkbox" checked={!!item.done} onChange={() => onToggle(item.id)} />
              <span className="checkmark" />
              <span className={`item-text ${item.done ? 'item-text-done' : ''}`}>{item.text}</span>
            </label>
          </li>
        ))}
      </ul>

      {allDone && (
        <div className="bedtime-message">
          <p className="bedtime-congrats">
            <MoonIcon style={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }} />
            {windDownMsg.quote}
          </p>
          <p className="bedtime-note">{quote}</p>
        </div>
      )}
    </div>
  );
}

function MonthCalendar({ days, year, month, onSelectDay, onBack, onPrevMonth, onNextMonth, categories = DEFAULT_CATEGORIES }) {
  const dayKeys = getDayKeysInMonth(year, month);
  const firstWeekday = getFirstWeekday(year, month);
  const padding = Array(firstWeekday).fill(null);

  return (
    <div className="month-calendar">
      <div className="month-calendar-header">
        <button type="button" className="btn-icon" onClick={onBack} aria-label="Back to today">
          <ChevronLeftIcon style={{ width: 20, height: 20 }} />
        </button>
        <h2 className="month-calendar-title">{MONTH_NAMES[month]} {year}</h2>
        <div className="month-calendar-nav">
          <button type="button" className="btn-icon" onClick={onPrevMonth} aria-label="Previous month">
            <ChevronLeftIcon style={{ width: 18, height: 18 }} />
          </button>
          <button type="button" className="btn-icon" onClick={onNextMonth} aria-label="Next month">
            <ChevronRightIcon style={{ width: 18, height: 18 }} />
          </button>
        </div>
      </div>
      <div className="month-calendar-weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w} className="month-calendar-weekday">{w}</span>
        ))}
      </div>
      <div className="month-calendar-grid">
        {padding.map((_, i) => (
          <div key={`pad-${i}`} className="month-calendar-day month-calendar-day-empty" />
        ))}
        {dayKeys.map((dayKey) => {
          const dayData = days[dayKey];
          const tasks = dayData ? allTasksInDay(dayData.hours, categories) : [];
          const total = tasks.length;
          const done = tasks.filter((t) => t.done).length;
          const isToday = dayKey === todayKey(new Date());
          return (
            <button
              key={dayKey}
              type="button"
              className={`month-calendar-day ${total > 0 ? "has-tasks" : ""} ${isToday ? "is-today" : ""}`}
              onClick={() => onSelectDay(dayKey)}
              aria-label={`${dayKey}, ${total} tasks`}
            >
              <span className="month-calendar-day-num">{new Date(dayKey + "T12:00:00").getDate()}</span>
              {total > 0 && (
                <div className="month-calendar-day-bars" aria-hidden>
                  {[0, 1, 2].slice(0, Math.min(3, total)).map((_, i) => (
                    <span
                      key={i}
                      className={`month-calendar-bar ${i < done ? "done" : ""}`}
                      style={{ height: 3, flex: 1, maxWidth: 8, borderRadius: 1, background: i < done ? "var(--theme-accent)" : "rgba(0,0,0,0.12)" }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Full-screen first step when Firebase is on: each person signs in to load their own cloud data. */
function LoginGateScreen({ redirectAuthError = "", onConsumeRedirectError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(op) {
    setError("");
    setBusy(true);
    try {
      await op();
      onConsumeRedirectError?.();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-gate" role="main">
      <div className="login-gate-card surface-glass">
        <p className="login-gate-brand">PROYOU</p>
        <h1 className="login-gate-title">Sign in</h1>
        <p className="login-gate-sub">
          Use your own account so your schedule, notes, and habits stay private and sync only for you.
        </p>

        <button
          type="button"
          className="btn login-gate-btn login-gate-apple"
          disabled={busy}
          onClick={() => run(() => signInWithApple())}
        >
          Sign in with Apple
        </button>

        <div className="login-gate-divider">
          <span>or email</span>
        </div>

        <label className="label" htmlFor="login-gate-email">
          Email
        </label>
        <input
          id="login-gate-email"
          className="input login-gate-input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <label className="label" htmlFor="login-gate-password">
          Password
        </label>
        <input
          id="login-gate-password"
          className="input login-gate-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />

        <div className="login-gate-row">
          <button
            type="button"
            id="login-email-sign-in"
            className="btn btn-primary login-gate-btn-half"
            disabled={busy || !email.trim() || !password}
            onClick={() => run(() => emailPasswordSignIn(email, password))}
          >
            Sign in
          </button>
          <button
            type="button"
            id="login-email-create-account"
            className="btn login-gate-btn-half"
            disabled={busy || !email.trim() || !password}
            onClick={() => run(() => signUpWithEmail(email, password))}
          >
            Create account
          </button>
        </div>

        <div className="login-gate-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="btn btn-ghost login-gate-btn"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const u = await ensureSignedIn();
              if (!u) {
                throw new Error(
                  "Guest session failed. In Firebase Console → Authentication → Sign-in method, enable Anonymous."
                );
              }
            })
          }
        >
          Continue on this device only (guest)
        </button>
        <p className="login-gate-hint">
          Guest keeps data on this browser until you sign out. For your own cloud backup across devices, use Sign in with Apple or email.
        </p>

        {redirectAuthError ? (
          <p className="login-gate-error" role="alert">
            {redirectAuthError}
          </p>
        ) : null}
        {error ? (
          <p className="login-gate-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Dock tabs (except Today) that can be hidden from nav - Today shows a CTA above Today's Capacity when hidden. */
const DOCK_NAV_SETTINGS_ROWS = [
  { id: "list", label: "List" },
  { id: "health", label: "Health" },
  { id: "monthly", label: "Monthly" },
  { id: "coach", label: "Coach (pattern insights)" },
  { id: "notes", label: "Notes" },
  { id: "finance", label: "Finance" },
];

const DOCK_EDITOR_ICON_BY_ID = {
  list: MenuIcon,
  monthly: CalendarIcon,
  coach: SparkleIcon,
  notes: MoonIcon,
  finance: FinanceIcon,
  health: DumbbellIcon,
};

const DOCK_FALLBACK_COPY = {
  list: {
    title: "List",
    body: "See incomplete tasks in one scrollable view across your days.",
    btn: "Open List",
  },
  monthly: {
    title: "Monthly objectives",
    body: "Set monthly direction and track what matters for the whole month.",
    btn: "Open Monthly",
  },
  coach: {
    title: "Coach",
    body: "Pattern insights based on how you plan and follow through.",
    btn: "Open Coach",
  },
  notes: {
    title: "Notes",
    body: "Jot thoughts, wind-down notes, and things you do not want to lose.",
    btn: "Open Notes",
  },
  finance: {
    title: "Finance",
    body: "Income, spending, savings & debt. Coach can help with habits.",
    btn: "Open Finance",
  },
  health: {
    title: "Health & training",
    body: "Plan this week's lifts, track macros and weight, and keep workout tasks in sync with your schedule.",
    btn: "Open Health",
  },
};

/** ====== Main App ====== **/
export default function App() {
  const [tab, setTab] = useState("today");
  const realTodayKey = todayKey();
  const [selectedDayKey, setSelectedDayKey] = useState(realTodayKey);
  const tKey = selectedDayKey;
  const [mode, setMode] = useState("type"); // Daily Progress timeline: "type" | "details"
  const [showMonthCalendar, setShowMonthCalendar] = useState(false);
  const [monthCalendarMonth, setMonthCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const [customCategories, setCustomCategories] = useState(() => getStoredCategories() || DEFAULT_CATEGORIES);

  const [appState, setAppState] = useState(() => {
    const cats = getStoredCategories() || DEFAULT_CATEGORIES;
    const saved = loadState();
    const migrated = migrateState(saved, cats);
    const routineTemplate = (() => {
      try {
        const raw = localStorage.getItem(ROUTINE_TEMPLATE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    })();
    const template =
      routineTemplate && routineTemplate.length ? normalizeBedtimeRoutineTemplate(routineTemplate) : BEDTIME_ROUTINE;
    const todayK = todayKey();
    if (migrated) {
      const dayKey = migrated.bedtimeRoutineDayKey;
      if (dayKey !== todayK) {
        return {
          ...migrated,
          bedtimeRoutineDayKey: todayK,
          bedtimeRoutine: template.map((r) => ({ ...r, done: false })),
        };
      }
      return { ...migrated, bedtimeRoutine: migrated.bedtimeRoutine || template.map((r) => ({ ...r, done: false })), bedtimeRoutineDayKey: migrated.bedtimeRoutineDayKey || todayK };
    }
    return {
      days: {},
      monthly: [],
      bedtimeRoutine: template.map((r) => ({ ...r, done: false })),
      bedtimeRoutineDayKey: todayK,
      notes: [],
    };
  });

  const appStateRef = useRef(appState);
  appStateRef.current = appState;
  /** First layout only: avoid writing empty in-memory state over a richer schedule still on disk. */
  const scheduleLayoutPrimedRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(customCategories));
    } catch {}
  }, [customCategories]);

  // Profile (name, birthday, default task reminders), persisted
  const [profile, setProfile] = useState(() => loadProfileFromDisk());

  const [health, setHealth] = useState(() => loadHealthFromDisk());
  const [workoutProgramPicker, setWorkoutProgramPicker] = useState(null);
  const [healthProgramBuilderScroll, setHealthProgramBuilderScroll] = useState(0);
  const [guidedWorkoutSession, setGuidedWorkoutSession] = useState(null);

  // Editable bedtime routine template (persisted)
  const [routineTemplate, setRoutineTemplate] = useState(() => {
    try {
      const raw = localStorage.getItem(ROUTINE_TEMPLATE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) && arr.length ? normalizeBedtimeRoutineTemplate(arr) : BEDTIME_ROUTINE.map((r) => ({ id: r.id, text: r.text }));
      }
    } catch {}
    return BEDTIME_ROUTINE.map((r) => ({ id: r.id, text: r.text }));
  });

  // Morning routine template (persisted)
  const [morningRoutineTemplate, setMorningRoutineTemplate] = useState(() => {
    try {
      const raw = localStorage.getItem(ROUTINE_MORNING_TEMPLATE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) && arr.length ? arr : MORNING_ROUTINE.map((r) => ({ id: r.id, text: r.text }));
      }
    } catch {}
    return MORNING_ROUTINE.map((r) => ({ id: r.id, text: r.text }));
  });

  // Which days morning/night routines apply: 'every' or [0,1,2,3,4,5,6] (0=Sun). enabledMorning/enabledNight = optional add-ons.
  const [routineSchedule, setRoutineSchedule] = useState(() => {
    try {
      const raw = localStorage.getItem(ROUTINE_SCHEDULE_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        return {
          morning: o.morning === "every" || (Array.isArray(o.morning) && o.morning.length) ? o.morning : "every",
          night: o.night === "every" || (Array.isArray(o.night) && o.night.length) ? o.night : "every",
          enabledMorning: o.enabledMorning !== false,
          enabledNight: o.enabledNight !== false,
        };
      }
    } catch {}
    return { morning: "every", night: "every", enabledMorning: true, enabledNight: true };
  });

  // Theme state
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return saved ? JSON.parse(saved) : THEMES["Classic Pink"];
    } catch {
      return THEMES["Classic Pink"];
    }
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--moodboard-image", "none");
    try {
      localStorage.removeItem("cute_schedule_moodboard_v1");
    } catch {}
  }, []);

  // Notes state
  const [notes, setNotes] = useState(() => {
    try {
      const saved = localStorage.getItem(NOTES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Finance state (account lists + totals kept in sync for coach / ratios)
  const [finance, setFinance] = useState(() => {
    try {
      const saved = localStorage.getItem(FINANCE_STORAGE_KEY);
      if (saved) {
        return normalizeFinanceLoaded(JSON.parse(saved));
      }
    } catch {}
    return normalizeFinanceLoaded({});
  });

  useEffect(() => {
    try {
      localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(finance));
    } catch {}
  }, [finance]);

  const [patternsRev, setPatternsRev] = useState(0);
  useEffect(() => {
    const fn = () => setPatternsRev((r) => r + 1);
    patternsDirtyListeners.add(fn);
    return () => patternsDirtyListeners.delete(fn);
  }, []);

  const [taskLogRev, setTaskLogRev] = useState(0);
  const [taskAveragesOpen, setTaskAveragesOpen] = useState(false);
  const [taskStatsExplainOpen, setTaskStatsExplainOpen] = useState(false);
  useEffect(() => {
    const off = subscribeTaskBehaviorDirty(() => setTaskLogRev((r) => r + 1));
    return off;
  }, []);

  useEffect(() => {
    const ym = financeMonthKeyFromDayKey(realTodayKey);
    setFinance((prev) => rollFinanceMonthsForward(prev, ym));
  }, [realTodayKey]);

  useEffect(() => {
    processMissedEndOfDayBacklog({
      days: appState.days,
      realTodayKey,
      categories: customCategories,
      subscriptions: finance.subscriptions,
      enabled: profile.logMissedTasksEod !== false,
    });
  }, [appState.days, realTodayKey, customCategories, finance.subscriptions, profile.logMissedTasksEod]);

  const BILL_REMINDER_KEY = "cute_schedule_bill_reminder_date";
  useEffect(() => {
    const today = todayKey();
    const billsDue = (finance.bills || []).filter((b) => b.dueDate === today);
    if (billsDue.length === 0) return;
    const lastReminded = localStorage.getItem(BILL_REMINDER_KEY);
    if (lastReminded === today) return;
    (async () => {
      const ok = await notificationService.checkPermission();
      if (ok) {
        notificationService.showNotification(
          "Bill due today",
          {
            body: billsDue.map((b) => b.name + (b.amount ? ` ($${Number(b.amount).toFixed(2)})` : "")).join(", "),
            tag: "bill-due-" + today,
            preferWebNotificationOnNative: true,
          }
        );
        localStorage.setItem(BILL_REMINDER_KEY, today);
      }
    })();
  }, [finance.bills, realTodayKey]);

  const SUBSCRIPTION_REMINDER_KEY = "cute_schedule_sub_reminder_date";
  useEffect(() => {
    const today = realTodayKey;
    const dayOfMonth = parseInt(today.slice(8), 10);
    const subsDue = (finance.subscriptions || []).filter((s) => s.dueDay != null && s.dueDay === dayOfMonth);
    if (subsDue.length === 0) return;
    const lastReminded = localStorage.getItem(SUBSCRIPTION_REMINDER_KEY);
    if (lastReminded === today) return;
    (async () => {
      const ok = await notificationService.checkPermission();
      if (ok) {
        notificationService.showNotification(
          "Payment due today",
          {
            body: subsDue.map((s) => s.name + (s.amount ? ` ($${Number(s.amount).toFixed(2)})` : "")).join(", "),
            tag: "sub-due-" + today,
            preferWebNotificationOnNative: true,
          }
        );
        localStorage.setItem(SUBSCRIPTION_REMINDER_KEY, today);
      }
    })();
  }, [finance.subscriptions, realTodayKey]);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {}
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(health));
    } catch {}
  }, [health]);

  useEffect(() => {
    try {
      localStorage.setItem(ROUTINE_TEMPLATE_KEY, JSON.stringify(routineTemplate));
    } catch {}
  }, [routineTemplate]);

  useEffect(() => {
    try {
      localStorage.setItem(ROUTINE_MORNING_TEMPLATE_KEY, JSON.stringify(morningRoutineTemplate));
    } catch {}
  }, [morningRoutineTemplate]);

  useEffect(() => {
    try {
      localStorage.setItem(ROUTINE_SCHEDULE_KEY, JSON.stringify(routineSchedule));
    } catch {}
  }, [routineSchedule]);

  // Reset bedtime routine when day changes to today
  useEffect(() => {
    setAppState((prev) => {
      const currentDayKey = prev.bedtimeRoutineDayKey || realTodayKey;
      if (currentDayKey !== realTodayKey) {
        const template = routineTemplate.length ? routineTemplate : BEDTIME_ROUTINE.map((r) => ({ id: r.id, text: r.text }));
        return {
          ...prev,
          bedtimeRoutineDayKey: realTodayKey,
          bedtimeRoutine: template.map((r) => ({ ...r, done: false })),
        };
      }
      return prev;
    });
  }, [realTodayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // When routine template changes, merge into today's routine (preserve done flags)
  useEffect(() => {
    const template = routineTemplate.length ? routineTemplate : BEDTIME_ROUTINE.map((r) => ({ id: r.id, text: r.text }));
    setAppState((prev) => {
      if (prev.bedtimeRoutineDayKey !== realTodayKey) return prev;
      const merged = template.map((r) => {
        const existing = prev.bedtimeRoutine?.find((x) => x.id === r.id);
        return { ...r, done: existing ? existing.done : false };
      });
      return { ...prev, bedtimeRoutine: merged };
    });
  }, [routineTemplate]); // eslint-disable-line react-hooks/exhaustive-deps

  const [noteSearch, setNoteSearch] = useState("");
  const [financeQuickInput, setFinanceQuickInput] = useState("");
  const [newSavingsLabel, setNewSavingsLabel] = useState("");
  const [newSavingsAmount, setNewSavingsAmount] = useState("");
  const [newDebtLabel, setNewDebtLabel] = useState("");
  const [newDebtAmount, setNewDebtAmount] = useState("");
  const [newWishLabel, setNewWishLabel] = useState("");
  const [newWishTarget, setNewWishTarget] = useState("");
  const [newSubName, setNewSubName] = useState("");
  const [newSubAmount, setNewSubAmount] = useState("");
  const [newSubCycle, setNewSubCycle] = useState("monthly");
  const [newSubDueDay, setNewSubDueDay] = useState("");
  const [newBillName, setNewBillName] = useState("");
  const [newBillAmount, setNewBillAmount] = useState("");
  const [newBillDueDate, setNewBillDueDate] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  /** Settings modal: main list vs full-screen notifications & reminders. */
  const [settingsSubView, setSettingsSubView] = useState(/** @type {"main" | "notifications"} */ ("main"));
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [firebaseAuthResolved, setFirebaseAuthResolved] = useState(false);
  const [firebaseRedirectAuthError, setFirebaseRedirectAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountPhase, setDeleteAccountPhase] = useState("intro");
  const [deleteAccountPhrase, setDeleteAccountPhrase] = useState("");
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const [habitTracker, setHabitTracker] = useState(() => loadHabitTrackerFromDisk());
  const [groceryListModal, setGroceryListModal] = useState(null);
  const [groceryListPrompt, setGroceryListPrompt] = useState(null);
  const [groceryNewItem, setGroceryNewItem] = useState("");
  const [groceryLoadListId, setGroceryLoadListId] = useState("");
  const [financeOverviewsOpen, setFinanceOverviewsOpen] = useState(false);
  const [newCreditScore, setNewCreditScore] = useState("");
  const [newCreditDate, setNewCreditDate] = useState(() => todayKey());
  const [debtPayDraft, setDebtPayDraft] = useState({});
  const [listAttachSavedId, setListAttachSavedId] = useState("");
  const [listAttachTaskKey, setListAttachTaskKey] = useState("");
  const [newHabitLabel, setNewHabitLabel] = useState("");
  const [newHabitDirection, setNewHabitDirection] = useState("build");
  /** `habitId` → draft `HH:mm` for "Add time" in settings */
  const [habitReminderDraft, setHabitReminderDraft] = useState({});
  const habitReminderFiredRef = useRef(new Set());
  const [newTypeName, setNewTypeName] = useState("");
  const [dockNavEditorMenuId, setDockNavEditorMenuId] = useState(null);
  const [dockNavDragOverId, setDockNavDragOverId] = useState(null);
  const dockNavDragSourceRef = useRef(null);

  useEffect(() => {
    if (!showSettings) setDockNavEditorMenuId(null);
  }, [showSettings]);

  useEffect(() => {
    if (!dockNavEditorMenuId) return undefined;
    const close = (e) => {
      if (e.target.closest(".settings-dock-block-menu-wrap")) return;
      setDockNavEditorMenuId(null);
    };
    const t = window.setTimeout(() => document.addEventListener("click", close), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("click", close);
    };
  }, [dockNavEditorMenuId]);

  useEffect(() => {
    try {
      localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(habitTracker));
    } catch {}
  }, [habitTracker]);

  const [toastNotification, setToastNotification] = useState(null);
  const toastDismissTimerRef = useRef(null);
  useEffect(() => {
    return () => {
      if (toastDismissTimerRef.current) {
        clearTimeout(toastDismissTimerRef.current);
        toastDismissTimerRef.current = null;
      }
    };
  }, []);
  const [morningGreeting, setMorningGreeting] = useState(false);
  const [taskDropdown, setTaskDropdown] = useState(null); // "hourKey-category-id"
  const [dropdownAnchorRect, setDropdownAnchorRect] = useState(null); // { top, left, bottom, right } for portal
  const [taskMenuNoteDraft, setTaskMenuNoteDraft] = useState("");
  const taskMenuNoteDraftRef = useRef("");
  taskMenuNoteDraftRef.current = taskMenuNoteDraft;
  const taskDropdownRef = useRef(null);
  taskDropdownRef.current = taskDropdown;
  const flushTaskMenuNoteForKeyRef = useRef(() => {});
  /** Monthly / note / grocery line menus (same popover styling as task menu). */
  const [secondaryListMenu, setSecondaryListMenu] = useState(null);
  const [onboardingActive, setOnboardingActive] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  /** After setup, optional one-time product tour */
  const [featureWalkthroughMode, setFeatureWalkthroughMode] = useState(null);
  const [editingTaskTime, setEditingTaskTime] = useState(null); // "hourKey-category-id" when showing time editor
  const [editTaskTimeValue, setEditTaskTimeValue] = useState("09:00"); // new time for edit
  const [expandedTaskKey, setExpandedTaskKey] = useState(null); // "hourKey-category-id" for expandable detail
  const [focusMode, setFocusMode] = useState(false);
  const [quickAddValue, setQuickAddValue] = useState("");
  const [taskBanner, setTaskBanner] = useState(null); // { type: 'start'|'wrapup', task, nextTask?, hourKey }
  /** Shown briefly when the in-app task banner first appears (null → visible). */
  const [taskBannerTapHint, setTaskBannerTapHint] = useState(false);
  const taskBannerPrevRef = useRef(null);

  // Define todayHours before useEffects that use it (memoized so hook dependency lists stay stable)
  const todayHours = useMemo(() => appState.days?.[tKey]?.hours || {}, [appState.days, tKey]);
  const todayHoursWithSubs = useMemo(
    () => mergeSubscriptionTasksIntoHours(todayHours, tKey, finance.subscriptions, customCategories),
    [todayHours, tKey, finance.subscriptions, customCategories]
  );

  // Morning routine for selected day: merge template with stored per-day completion
  const effectiveMorningRoutine = useMemo(() => {
    const template = morningRoutineTemplate.length ? morningRoutineTemplate : MORNING_ROUTINE.map((r) => ({ id: r.id, text: r.text }));
    const stored = appState.days?.[tKey]?.morningRoutine || [];
    return template.map((t) => {
      const s = stored.find((r) => r.id === t.id);
      return { ...t, done: s ? s.done : false };
    });
  }, [tKey, appState.days, morningRoutineTemplate]);

  // Build reminder list for server push (so reminders fire when app is closed)
  const pushRemindersList = useMemo(() => {
    const list = [];
    const today = realTodayKey;
    const dayOfMonth = parseInt(today.slice(8), 10);

    const eightAmToday = new Date();
    eightAmToday.setHours(8, 0, 0, 0);

    const billsDue = (finance.bills || []).filter((b) => b.dueDate === today);
    if (billsDue.length > 0) {
      list.push({
        at: eightAmToday.toISOString(),
        title: "Bill due today",
        body: billsDue.map((b) => b.name + (b.amount ? ` ($${Number(b.amount).toFixed(2)})` : "")).join(", "),
        tag: "bill-due-" + today,
      });
    }

    const subsDue = (finance.subscriptions || []).filter((s) => s.dueDay != null && s.dueDay === dayOfMonth);
    if (subsDue.length > 0) {
      list.push({
        at: eightAmToday.toISOString(),
        title: "Payment due today",
        body: subsDue.map((s) => s.name + (s.amount ? ` ($${Number(s.amount).toFixed(2)})` : "")).join(", "),
        tag: "sub-due-" + today,
      });
    }

    const now = Date.now();
    const maxAt = now + 48 * 60 * 60 * 1000;
    const seenTags = new Set(list.map((x) => x.tag).filter(Boolean));
    const np = normalizeNotificationPrefs(profile.notificationPrefs);
    for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
      const dayKey = dayOffset === 0 ? today : addDaysKey(today, 1);
      const hours = appState.days?.[dayKey]?.hours || {};
      const tasks = allTasksInDay(hours, customCategories).filter((t) => !t.done);
      for (const t of tasks) {
        if (np.taskPushEnabled) {
          const taskEff = taskForPushReminders(t, profile);
          const rows = buildTaskPushReminderEntriesForTask({
            task: taskEff,
            dayKey,
            hourKey: t.hour,
            nowMs: now,
            maxAtMs: maxAt,
          });
          for (const row of rows) {
            if (row.tag && !seenTags.has(row.tag)) {
              seenTags.add(row.tag);
              list.push(row);
            }
          }
          const { remindersEnabled } = normalizeTaskReminderFields(taskEff);
          if (!remindersEnabled) {
            const atDate = new Date(dayKey + "T" + t.hour + ":00");
            const atTime = atDate.getTime();
            if (atTime >= now && atTime <= maxAt) {
              const tag = "reminder-legacy-" + t.id;
              if (!seenTags.has(tag)) {
                seenTags.add(tag);
                list.push({
                  at: atDate.toISOString(),
                  title: "When you're ready, here's what you planned.",
                  body: t.text + (t.category ? ` (${t.category})` : ""),
                  tag,
                });
              }
            }
          }
        }
      }
    }
    list.push(...habitReminderPushEntries(habitTracker.habits, today, now, maxAt, profile.notificationPrefs));
    return list;
  }, [
    realTodayKey,
    finance.bills,
    finance.subscriptions,
    appState.days,
    customCategories,
    habitTracker.habits,
    profile,
  ]);

  const iosResyncDaysRef = useRef(appState.days);
  const iosResyncTodayRef = useRef(realTodayKey);
  const iosResyncCatsRef = useRef(customCategories);
  const iosResyncProfileRef = useRef(profile);
  useEffect(() => {
    iosResyncDaysRef.current = appState.days;
    iosResyncTodayRef.current = realTodayKey;
    iosResyncCatsRef.current = customCategories;
    iosResyncProfileRef.current = profile;
  }, [appState.days, realTodayKey, customCategories, profile]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;
    const tid = setTimeout(() => {
      resyncIosTaskLocalNotifications(appState.days, realTodayKey, customCategories, iosResyncProfileRef.current);
    }, 700);
    return () => clearTimeout(tid);
  }, [appState.days, realTodayKey, customCategories, profile]);

  const habitsNeedCheckIn = useMemo(() => {
    const habits = habitTracker.habits || [];
    if (habits.length === 0) return false;
    const dayLog = habitTracker.log[realTodayKey] || {};
    return habits.some((h) => dayLog[h.id] == null);
  }, [habitTracker, realTodayKey]);

  // Coach meta for cooldown and auto-run
  const [coachMeta, setCoachMeta] = useState(() => {
    try {
      const raw = localStorage.getItem(COACH_STORAGE_KEY);
      return raw ? JSON.parse(raw) : { lastCoachAt: 0, lastProgressAt: Date.now(), lastAutoDayKey: "" };
    } catch {
      return { lastCoachAt: 0, lastProgressAt: Date.now(), lastAutoDayKey: "" };
    }
  });

  const [, setCoachOpen] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState("");
  const [coachResult, setCoachResult] = useState(null);
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachConversation, setCoachConversation] = useState([]);
  const [coachMode, setCoachMode] = useState("plan"); // "plan" | "unstuck" | "review"
  const [coachUserProfile, setCoachUserProfile] = useState(() => {
    try {
      const raw = localStorage.getItem(COACH_USER_PROFILE_KEY);
      const o = raw ? JSON.parse(raw) : {};
      return o.filled ? o : { biggestChallenge: "", bestEnergyTime: "", oneGoal: "", filled: false };
    } catch {
      return { biggestChallenge: "", bestEnergyTime: "", oneGoal: "", filled: false };
    }
  });
  const [coachStructuredResult, setCoachStructuredResult] = useState(null); // { summary, followUp, actions }
  const [coachLearning, setCoachLearning] = useState(() => loadCoachLearning());
  const [coachToast, setCoachToast] = useState(null);
  const [coachEdit, setCoachEdit] = useState(null);
  const coachResultRef = useRef(null);
  const [sprintEndsAt, setSprintEndsAt] = useState(null); // timestamp; when set, 10-min sprint is active
  const [sprintTick, setSprintTick] = useState(0); // force re-render every second during sprint

  useEffect(() => {
    localStorage.setItem(COACH_STORAGE_KEY, JSON.stringify(coachMeta));
  }, [coachMeta]);

  useEffect(() => {
    coachResultRef.current = coachResult;
  }, [coachResult]);

  useEffect(() => {
    if (!coachToast) return;
    const t = setTimeout(() => setCoachToast(null), 4200);
    return () => clearTimeout(t);
  }, [coachToast]);

  // Only add a day when it's missing; never overwrite existing (keeps all days persisted)
  useEffect(() => {
    setAppState((prev) => {
      const existing = prev.days?.[tKey];
      if (existing != null) return prev;
      const morningInit = (morningRoutineTemplate.length ? morningRoutineTemplate : MORNING_ROUTINE.map((r) => ({ id: r.id, text: r.text }))).map((r) => ({ ...r, done: false }));
      return { ...prev, days: { ...prev.days, [tKey]: { hours: {}, morningRoutine: morningInit } } };
    });
  }, [tKey, morningRoutineTemplate]);

  // Persist schedule before paint so a fast tab-close does not skip localStorage (useEffect runs too late).
  useLayoutEffect(() => {
    if (!scheduleLayoutPrimedRef.current) {
      scheduleLayoutPrimedRef.current = true;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const diskSchedule = savedStateHasScheduleData(parsed);
          const memSchedule = savedStateHasScheduleData(appState);
          const nDisk = countScheduleTasks(parsed);
          const nMem = countScheduleTasks(appState);
          if (diskSchedule && (!memSchedule || nMem < nDisk)) {
            const cats = getStoredCategories() || DEFAULT_CATEGORIES;
            setAppState(migrateState(parsed, cats));
            return;
          }
        }
      } catch {}
    }
    saveState(appState);
  }, [appState]);

  // Firebase Auth → Firestore doc schedules/{uid}. Anonymous sign-in is used when enabled so rules always have a uid.
  useEffect(() => {
    if (!isFirebaseEnabled()) {
      setFirebaseAuthResolved(true);
      setFirebaseUser(null);
      return;
    }
    let cancelled = false;
    const unsubRef = { current: () => {} };
    const authTimeoutMs = 15000;
    const deadline = window.setTimeout(() => {
      if (cancelled) return;
      setFirebaseAuthResolved((prev) => {
        if (prev) return prev;
        console.warn(
          "Firebase auth did not resolve in time (common in some WebViews). Showing sign-in. If sign-in fails, add this app’s origin under Firebase → Authentication → Settings → Authorized domains."
        );
        setFirebaseUser(null);
        return true;
      });
    }, authTimeoutMs);
    void (async () => {
      const { error: redirectErr } = await completeAuthRedirectIfNeeded();
      if (cancelled) return;
      if (redirectErr?.code || redirectErr?.message) {
        const msg = redirectErr.message || redirectErr.code || String(redirectErr);
        setFirebaseRedirectAuthError(msg);
        if (redirectErr?.code !== "auth/argument-error" && redirectErr?.code !== "auth/no-auth-event") {
          console.warn("Apple / OAuth redirect sign-in:", redirectErr?.code ?? redirectErr);
        }
      }
      unsubRef.current = subscribeAuthState((user) => {
        window.clearTimeout(deadline);
        if (cancelled) return;
        setFirebaseUser(user);
        setFirebaseAuthResolved(true);
      });
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(deadline);
      unsubRef.current();
    };
  }, []);

  // Firestore: load after auth is known (uid), then debounced save when state changes
  const [firestoreReady, setFirestoreReady] = useState(false);
  const firestoreSaveTimeoutRef = useRef(null);
  const latestForUnloadRef = useRef(null);
  /** Set true before flushSync(addTask) so the next layout commit saves Firestore with the real appState. */
  const saveFirestoreImmediateRef = useRef(false);

  useLayoutEffect(() => {
    if (!saveFirestoreImmediateRef.current) return;
    saveFirestoreImmediateRef.current = false;
    if (firestoreSaveTimeoutRef.current) {
      clearTimeout(firestoreSaveTimeoutRef.current);
      firestoreSaveTimeoutRef.current = null;
    }
    void cloudStorage.saveFullState({
      appState,
      notes,
      finance,
      profile,
      health,
      theme,
      routineTemplate,
      morningRoutineTemplate,
      routineSchedule,
      coachMeta,
      coachUserProfile,
      moodboard: EMPTY_MOODBOARD,
      customCategories,
      patterns: loadPatterns(),
      habitTracker,
    });
  }, [
    appState,
    notes,
    finance,
    profile,
    health,
    theme,
    routineTemplate,
    morningRoutineTemplate,
    routineSchedule,
    coachMeta,
    coachUserProfile,
    customCategories,
    patternsRev,
    habitTracker,
  ]);

  useEffect(() => {
    if (!firebaseAuthResolved) return;
    if (isFirebaseEnabled() && !firebaseUser?.uid) {
      setFirestoreReady(false);
      return;
    }
    setFirestoreReady(false);
    let cancelled = false;
    cloudStorage.invalidateLoadCache();
    void (async () => {
      if (firebaseUser?.uid) {
        await migrateLegacyDeviceScheduleIfNeeded(firebaseUser.uid);
      }
      const data = await cloudStorage.loadFullStateOnce();
      if (cancelled) return;

      let localParsed = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) localParsed = JSON.parse(raw);
      } catch {}

      const storedCats = getStoredCategories() || DEFAULT_CATEGORIES;
      const cloudState = data?.appState ?? null;
      const nLocal = countScheduleTasks(localParsed);
      const nCloud = countScheduleTasks(cloudState);
      const nReact = countScheduleTasks(appStateRef.current);
      const localHasSchedule = savedStateHasScheduleData(localParsed);

      const shouldApplyCloudAppState =
        cloudState != null &&
        nCloud >= nReact &&
        nCloud >= nLocal &&
        (nCloud > nLocal || !localHasSchedule);

      if (data) {
        if (shouldApplyCloudAppState) {
          const catsForMigrate =
            Array.isArray(data.customCategories) && data.customCategories.length
              ? data.customCategories
              : storedCats;
          const migratedCloud = migrateState(cloudState, catsForMigrate);
          const daysMergedDisk = mergeCloudDaysWithRicherLocalDisk(migratedCloud.days, localParsed?.days);
          const afterDisk = { ...migratedCloud, days: daysMergedDisk };
          const merged = mergeSessionTasksIntoCloud(afterDisk, appStateRef.current);
          setAppState(merged);
        }
        if (data.notes != null) setNotes(data.notes);
        if (data.finance != null) setFinance(normalizeFinanceLoaded(data.finance));
        if (data.profile != null) setProfile((prev) => mergeCloudProfile(prev, data.profile));
        if (data.theme != null) setTheme(data.theme);
        if (data.routineTemplate != null) setRoutineTemplate(normalizeBedtimeRoutineTemplate(data.routineTemplate));
        if (data.morningRoutineTemplate != null) setMorningRoutineTemplate(data.morningRoutineTemplate);
        if (data.routineSchedule != null) setRoutineSchedule(data.routineSchedule);
        if (data.coachMeta != null) setCoachMeta(data.coachMeta);
        if (data.coachUserProfile != null) setCoachUserProfile(data.coachUserProfile);
        if (
          data.customCategories != null &&
          data.customCategories.length &&
          shouldApplyCloudAppState
        ) {
          setCustomCategories(data.customCategories);
        }
        if (data.patterns != null) {
          try {
            localStorage.setItem(PATTERNS_STORAGE_KEY, JSON.stringify(data.patterns));
            notifyPatternsDirty();
          } catch {}
        }
        if (data.habitTracker != null && typeof data.habitTracker === "object") {
          const rawH = Array.isArray(data.habitTracker.habits) ? data.habitTracker.habits : [];
          setHabitTracker({
            habits: rawH.map(normalizeHabitRow).filter(Boolean),
            log: data.habitTracker.log && typeof data.habitTracker.log === "object" ? data.habitTracker.log : {},
          });
        }
        if (data.health != null && typeof data.health === "object") {
          setHealth(normalizeHealth(data.health));
        }
      }
      setFirestoreReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [firebaseAuthResolved, firebaseUser?.uid]);

  useEffect(() => {
    if (!firestoreReady) return;
    const payload = {
      appState,
      notes,
      finance,
      profile,
      health,
      theme,
      routineTemplate,
      morningRoutineTemplate,
      routineSchedule,
      coachMeta,
      coachUserProfile,
      moodboard: EMPTY_MOODBOARD,
      customCategories,
      patterns: loadPatterns(),
      habitTracker,
    };
    if (firestoreSaveTimeoutRef.current) clearTimeout(firestoreSaveTimeoutRef.current);
    firestoreSaveTimeoutRef.current = setTimeout(() => {
      cloudStorage.saveFullState(payload);
      firestoreSaveTimeoutRef.current = null;
    }, 400);
    return () => {
      if (firestoreSaveTimeoutRef.current) clearTimeout(firestoreSaveTimeoutRef.current);
    };
  }, [firestoreReady, appState, notes, finance, profile, health, theme, routineTemplate, morningRoutineTemplate, routineSchedule, coachMeta, coachUserProfile, customCategories, patternsRev, habitTracker]);

  useEffect(() => {
    if (!firestoreReady) return;
    const md = (profile.userBirthday || "").replace(/\D/g, "").padStart(4, "0").slice(-4);
    if (md.length !== 4) return;
    const now = new Date();
    const monthDay = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    if (md !== monthDay) return;
    const today = realTodayKey;
    let last = "";
    try {
      last = localStorage.getItem(BIRTHDAY_NOTIF_KEY) || "";
    } catch {}
    if (last === today) return;
    void (async () => {
      const ok = await notificationService.checkPermission();
      if (!ok) return;
      const name = (profile.userName || "").trim();
      notificationService.showNotification(`Happy birthday${name ? `, ${name}` : ""}!`, {
        body: "Hope you have a gentle, good day.",
        tag: "birthday-" + today,
        preferWebNotificationOnNative: true,
      });
      try {
        localStorage.setItem(BIRTHDAY_NOTIF_KEY, today);
      } catch {}
    })();
  }, [firestoreReady, realTodayKey, profile.userBirthday, profile.userName]);

  useEffect(() => {
    const flush = () => {
      const p = latestForUnloadRef.current;
      if (!p) return;
      try {
        saveState(p.appState);
      } catch {}
      if (firestoreSaveTimeoutRef.current) {
        clearTimeout(firestoreSaveTimeoutRef.current);
        firestoreSaveTimeoutRef.current = null;
      }
      cloudStorage.saveFullState({
        appState: p.appState,
        notes: p.notes,
        finance: p.finance,
        profile: p.profile,
        health: p.health,
        theme: p.theme,
        routineTemplate: p.routineTemplate,
        morningRoutineTemplate: p.morningRoutineTemplate,
        routineSchedule: p.routineSchedule,
        coachMeta: p.coachMeta,
        coachUserProfile: p.coachUserProfile,
        moodboard: EMPTY_MOODBOARD,
        customCategories: p.customCategories,
        patterns: p.patterns,
        habitTracker: p.habitTracker,
      });
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    document.documentElement.style.setProperty('--theme-primary', theme.primary);
    document.documentElement.style.setProperty('--theme-secondary', theme.secondary);
    document.documentElement.style.setProperty('--theme-accent', theme.accent);
    document.documentElement.style.setProperty('--theme-gradient', theme.gradient);
    document.documentElement.style.setProperty('--theme-header-gradient', theme.headerGradient);
    document.documentElement.style.setProperty('--gradient-cta', theme.gradient);
    document.documentElement.style.setProperty('--theme-bg-gradient', theme.backgroundGradient || 'linear-gradient(160deg, #F8F5F4 0%, #F1E8E6 100%)');
    document.documentElement.style.setProperty('--theme-bg-glow', theme.backgroundGlow || 'rgba(232, 180, 192, 0.15)');
    const darkUi = theme?.name === "Midnight" || theme?.name === "Mocha";
    if (darkUi) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  // Request notification permission on mount
  useEffect(() => {
    notificationService.checkPermission();
  }, []);

  // Capacitor: FCM listeners + token refresh; local notifications resync from app state (see useEffect on appState.days).
  useEffect(() => {
    if (!isCapacitorNativeApp()) return;
    void bootstrapNativePushOnStartup().then(() => {
      void refreshNativeNotificationDiagnostics();
    });
  }, []);

  useEffect(() => {
    if (!isCapacitorNativeApp()) return;
    let listener;
    let cancelled = false;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        if (cancelled) return;
        listener = await App.addListener("resume", () => {
          void refreshNativeNotificationDiagnostics();
          if (Capacitor.getPlatform() === "ios") {
            void resyncIosTaskLocalNotifications(
              iosResyncDaysRef.current,
              iosResyncTodayRef.current,
              iosResyncCatsRef.current,
              iosResyncProfileRef.current
            );
          }
        });
      } catch (e) {
        console.warn("[App] resume listener", e);
      }
    })();
    return () => {
      cancelled = true;
      if (listener && typeof listener.remove === "function") listener.remove();
    };
  }, []);

  useEffect(() => {
    if (!isCapacitorNativeApp() || Capacitor.getPlatform() !== "ios") return;
    let handle;
    (async () => {
      handle = await LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
        const extra = action?.notification?.extra;
        if (!extra || extra.proyouSource !== "task_reminder") return;
        const dk = typeof extra.dayKey === "string" ? extra.dayKey : "";
        const hk = typeof extra.hourKey === "string" ? extra.hourKey : "";
        const cat = typeof extra.category === "string" ? extra.category : "";
        const tid = extra.taskId != null ? String(extra.taskId) : "";
        if (dk) setSelectedDayKey(dk);
        setTab("today");
        if (hk && cat && tid) setExpandedTaskKey(`${hk}-${cat}-${tid}`);
      });
    })();
    return () => {
      if (handle && typeof handle.remove === "function") handle.remove();
    };
  }, []);

  // Sync reminders to server so cron can send push when app is closed
  useEffect(() => {
    if (pushRemindersList.length === 0) return;
    const t = setTimeout(() => {
      notificationService.syncRemindersToServer(pushRemindersList);
    }, 2000);
    return () => clearTimeout(t);
  }, [pushRemindersList]);

  // In-app habit reminders: respects Notifications dashboard (cadence, quiet hours, per-habit on).
  useEffect(() => {
    const maybeNotify = async () => {
      await notificationService.checkPermission();
      if (notificationService.permission !== "granted") return;
      const prefs = normalizeNotificationPrefs(profile.notificationPrefs);
      if (!prefs.habitPushEnabled) return;
      const now = new Date();
      if (!clockWithinQuietWindow(now, prefs.habitQuietStart, prefs.habitQuietEnd)) return;
      const dayKey = realTodayKey;
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const slot = `${hh}:${mm}`;
      const habits = habitTracker.habits || [];
      const mode = prefs.habitReminderMode;
      const dailySlot = normalizeTimeKey(prefs.habitDailyTime);

      for (const h of habits) {
        const row = normalizeHabitRow(h);
        if (!row || row.reminderPushEnabled === false) continue;

        let fire = false;
        let tag = "";
        let body = "Quick check-in when you’re ready.";

        if (mode === "daily") {
          if (slot === dailySlot) {
            fire = true;
            tag = `habit-live-d-${row.id}-${dayKey}-${slot}`;
            body = "Log this habit on Today when you can.";
          }
        } else if (mode === "hourly") {
          if (now.getMinutes() === 0) {
            fire = true;
            tag = `habit-live-h-${row.id}-${dayKey}-${hh}`;
          }
        } else if (mode === "every30") {
          if (now.getMinutes() === 0 || now.getMinutes() === 30) {
            fire = true;
            tag = `habit-live-30-${row.id}-${dayKey}-${slot}`;
          }
        } else if (row.reminderSchedule === "hourly" && now.getMinutes() === 0) {
          fire = true;
          tag = `habit-live-h-${row.id}-${dayKey}-${hh}`;
        } else if (row.reminderSchedule === "hours" && row.reminderHours.length > 0 && row.reminderHours.includes(slot)) {
          fire = true;
          tag = `habit-live-t-${row.id}-${dayKey}-${slot}`;
          body = "Reminder: log it on Today when you can.";
        }

        if (fire && tag && !habitReminderFiredRef.current.has(tag)) {
          habitReminderFiredRef.current.add(tag);
          notificationService.showNotification(`Habit: ${row.label}`, {
            body,
            tag,
            requireInteraction: false,
            preferWebNotificationOnNative: true,
          });
        }
      }
      if (habitReminderFiredRef.current.size > 400) {
        habitReminderFiredRef.current = new Set();
      }
    };
    const id = setInterval(maybeNotify, 20_000);
    maybeNotify();
    return () => clearInterval(id);
  }, [habitTracker.habits, realTodayKey, profile.notificationPrefs]);

  // Close dropdowns when clicking outside (portal or trigger)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (taskDropdown && !e.target.closest('.task-dropdown-portal') && !e.target.closest('[data-task-menu-trigger]')) {
        flushTaskMenuNoteForKeyRef.current(taskDropdownRef.current);
        setTaskDropdown(null);
        setDropdownAnchorRect(null);
        setTaskMenuNoteDraft("");
      }
      if (secondaryListMenu && !e.target.closest('.task-dropdown-portal') && !e.target.closest('[data-list-menu-trigger]')) {
        setSecondaryListMenu(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [taskDropdown, secondaryListMenu]);

  useLayoutEffect(() => {
    if (!taskDropdown) return;
    const esc =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(taskDropdown)
        : String(taskDropdown).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const tick = () => {
      const n = document.querySelector(`[data-task-dropdown-key="${esc}"]`);
      if (n) setDropdownAnchorRect(n.getBoundingClientRect());
    };
    tick();
    window.addEventListener("scroll", tick, true);
    window.addEventListener("resize", tick);
    return () => {
      window.removeEventListener("scroll", tick, true);
      window.removeEventListener("resize", tick);
    };
  }, [taskDropdown]);

  useEffect(() => {
    if (!groceryListModal) setSecondaryListMenu(null);
  }, [groceryListModal]);

  // ESC closes calendar sheet
  useEffect(() => {
    if (!showMonthCalendar) return;
    const handleEsc = (e) => { if (e.key === 'Escape') setShowMonthCalendar(false); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showMonthCalendar]);

  // Scroll to top when switching tabs; close list menus; re-flush reveals after DOM swap
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setSecondaryListMenu(null);
    requestAnimationFrame(() => {
      flushScrollRevealsInViewport();
      requestAnimationFrame(() => flushScrollRevealsInViewport());
    });
  }, [tab]);

  // Morning greeting ritual
  useEffect(() => {
    if (onboardingActive) return;
    if (!isSameDayKey(tKey, realTodayKey)) return;

    const lastGreeting = localStorage.getItem(`morning-greeting-${realTodayKey}`);
    const now = new Date();
    const hour = now.getHours();
    
    // Show greeting if it's morning (6-10am) and hasn't been shown today
    if (hour >= 6 && hour < 10 && !lastGreeting) {
      setTimeout(() => {
        setMorningGreeting(true);
        localStorage.setItem(`morning-greeting-${realTodayKey}`, 'true');
      }, 500);
    }
  }, [tKey, realTodayKey, onboardingActive]);

  // Monitor tasks and schedule transition notifications
  useEffect(() => {
    if (!isSameDayKey(tKey, realTodayKey)) return;
    
    const allTasks = allTasksInDay(todayHours, customCategories);
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    // Sort tasks by time
    const sortedTasks = allTasks
      .filter(t => !t.done)
      .sort((a, b) => {
        const [aHour, aMin] = a.hour.split(':').map(Number);
        const [bHour, bMin] = b.hour.split(':').map(Number);
        return (aHour * 60 + aMin) - (bHour * 60 + bMin);
      });

    // Find current and next task
    let currentTask = null;
    let nextTask = null;

    for (let i = 0; i < sortedTasks.length; i++) {
      const task = sortedTasks[i];
      const [taskHour, taskMin] = task.hour.split(':').map(Number);
      const taskTimeMinutes = taskHour * 60 + taskMin;

      // Current task: started within the last hour and not done
      if (taskTimeMinutes <= currentTimeMinutes && currentTimeMinutes < taskTimeMinutes + 60) {
        currentTask = task;
        if (i + 1 < sortedTasks.length) {
          nextTask = sortedTasks[i + 1];
        }
        break;
      }
      
      // Next task: upcoming
      if (taskTimeMinutes > currentTimeMinutes) {
        nextTask = task;
        // Previous task might still be current
        if (i > 0) {
          const prevTask = sortedTasks[i - 1];
          const [prevHour, prevMin] = prevTask.hour.split(':').map(Number);
          const prevTimeMinutes = prevHour * 60 + prevMin;
          if (currentTimeMinutes < prevTimeMinutes + 60) {
            currentTask = prevTask;
          }
        }
        break;
      }
    }

    // Schedule transition notifications
    if (nextTask) {
      notificationService.scheduleTaskTransition(
        currentTask,
        nextTask,
        nextTask.hour,
        nextTask.category
      );
    }
  }, [tKey, realTodayKey, todayHours, customCategories, appState]);

  const sortedHourKeys = useMemo(() => Object.keys(todayHoursWithSubs).sort(), [todayHoursWithSubs]);

  const dailyMood = appState.days?.[tKey]?.dailyMood || null;
  const isOverwhelmedMode = dailyMood === "drained";
  const isHyperfocusMode = dailyMood === "calm";

  useEffect(() => {
    if (tab !== "coach") return;
    if (isOverwhelmedMode) setCoachMode("unstuck");
    else if (isHyperfocusMode) setCoachMode("plan");
  }, [tab, isOverwhelmedMode, isHyperfocusMode]);

  const visibleHourKeys = useMemo(() => {
    if (sortedHourKeys.length === 0) return sortedHourKeys;
    const limitView = focusMode || isOverwhelmedMode;
    if (!limitView) return sortedHourKeys;
    const now = new Date();
    const currentHour = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes() >= 30 ? 30 : 0).padStart(2, "0")}`;
    const idx = sortedHourKeys.findIndex((h) => h >= currentHour);
    const start = idx >= 0 ? idx : 0;
    return sortedHourKeys.slice(start, start + 2);
  }, [focusMode, isOverwhelmedMode, sortedHourKeys]);

  /** Re-run scroll-reveal when Today’s hours/tasks change (e.g. Firestore hydrate) or tab returns. */
  const scrollRevealScheduleSig = useMemo(() => {
    const keys = Object.keys(todayHoursWithSubs || {}).sort().join(",");
    const n = allTasksInDay(todayHoursWithSubs, customCategories).length;
    return `${keys}:${n}`;
  }, [todayHoursWithSubs, customCategories]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (tab !== "today") return;
    let rafA = 0;
    let rafB = 0;
    rafA = requestAnimationFrame(() => {
      flushScrollRevealsInViewport();
      rafB = requestAnimationFrame(() => flushScrollRevealsInViewport());
    });
    return () => {
      if (rafA) cancelAnimationFrame(rafA);
      if (rafB) cancelAnimationFrame(rafB);
    };
  }, [tab, scrollRevealScheduleSig, firestoreReady]);

  // Fade/slide-in for main panels as they enter the viewport (respects reduced motion)
  useEffect(() => {
    let io = null;
    let cancelled = false;
    const tid = window.setTimeout(() => {
      if (cancelled || typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        document.querySelectorAll(".scroll-reveal").forEach((n) => n.classList.add("scroll-reveal-visible"));
        return;
      }
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) en.target.classList.add("scroll-reveal-visible");
          });
        },
        { threshold: 0.02, rootMargin: "0px 0px 0px 0px" }
      );
      document.querySelectorAll(".scroll-reveal").forEach((node) => io.observe(node));
      requestAnimationFrame(() => {
        flushScrollRevealsInViewport();
        requestAnimationFrame(() => flushScrollRevealsInViewport());
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
      if (io) io.disconnect();
    };
  }, [tab, tKey, firestoreReady, scrollRevealScheduleSig]);

  // In-app banner: every 20s, current/next task → Start / Snooze / Skip or Wrap it up
  useEffect(() => {
    if (tab !== "today" || !isSameDayKey(tKey, realTodayKey)) return;
    const SNOOZE_KEY = "taskBannerSnoozeUntil";
    const run = () => {
      const snoozeUntil = parseInt(localStorage.getItem(SNOOZE_KEY) || "0", 10);
      if (Date.now() < snoozeUntil) return;
      const now = new Date();
      const nowM = now.getHours() * 60 + now.getMinutes();
      const tasks = allTasksInDay(todayHours, customCategories);
      const withHour = tasks.filter((t) => !t.done).map((t) => ({ ...t, startM: (() => { const [h, m] = t.hour.split(":").map(Number); return h * 60 + m; })() }));
      const sorted = [...withHour].sort((a, b) => a.startM - b.startM);
      for (let i = 0; i < sorted.length; i++) {
        const task = sorted[i];
        const nextTask = sorted[i + 1] || null;
        const startM = task.startM;
        const endM = startM + 60;
        if (nowM >= startM && nowM < startM + 2) {
          setTaskBanner({ type: "start", task, nextTask, hourKey: task.hour });
          return;
        }
        if (nowM >= endM - 2 && nowM < endM) {
          setTaskBanner({ type: "wrapup", task, nextTask, hourKey: task.hour });
          return;
        }
      }
      setTaskBanner(null);
    };
    run();
    const interval = setInterval(run, 20000);
    return () => clearInterval(interval);
  }, [tab, tKey, realTodayKey, todayHours, customCategories]);

  useEffect(() => {
    const prev = taskBannerPrevRef.current;
    taskBannerPrevRef.current = taskBanner;
    if (taskBanner && !prev) {
      setTaskBannerTapHint(true);
      const id = window.setTimeout(() => setTaskBannerTapHint(false), 9000);
      return () => window.clearTimeout(id);
    }
    if (!taskBanner) setTaskBannerTapHint(false);
  }, [taskBanner]);

  /** Jump from the floating task banner to that task on Today, then dismiss the banner. */
  function goToTaskFromBannerAndDismiss() {
    if (!taskBanner) return;
    const target =
      taskBanner.type === "wrapup" && taskBanner.nextTask ? taskBanner.nextTask : taskBanner.task;
    if (!target?.hour || !target?.category || !target?.id) {
      setTaskBanner(null);
      return;
    }
    try {
      setSettingsSubView("main");
      setShowSettings(false);
    } catch {
      /* ignore */
    }
    setFocusMode(false);
    setTab("today");
    setExpandedTaskKey(`${target.hour}-${target.category}-${target.id}`);
    setTaskBanner(null);
    setTaskBannerTapHint(false);
    const hk = target.hour;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const sel =
          typeof CSS !== "undefined" && typeof CSS.escape === "function"
            ? `[data-timeline-hour="${CSS.escape(hk)}"]`
            : `[data-timeline-hour="${String(hk).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
        document.querySelector(sel)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      });
    });
  }

  const prog = useMemo(() => dayProgress(todayHours, customCategories), [todayHours, customCategories]);
  const starred = useMemo(() => dayIsStarred(todayHours, customCategories), [todayHours, customCategories]);
  const patternInsights = useMemo(() => {
    void patternsRev;
    return analyzePatterns();
  }, [patternsRev]);

  const [starPulse, setStarPulse] = useState(false);
  useEffect(() => {
    if (starred) {
      setStarPulse(true);
      const t = setTimeout(() => setStarPulse(false), 900);
      return () => clearTimeout(t);
    }
  }, [starred]);

  // Track bedtime routine completion for sleep correlation (ADHD)
  useEffect(() => {
    if (!isSameDayKey(tKey, realTodayKey)) return;
    const routine = appState.bedtimeRoutine || [];
    if (routine.length === 0) return;
    const allDone = routine.every((r) => r.done);
    if (allDone && starred) trackBedtimeComplete(realTodayKey);
  }, [appState.bedtimeRoutine, starred, tKey, realTodayKey]);

  // Update lastProgressAt whenever tasks change
  useEffect(() => {
    setCoachMeta((prev) => ({ ...prev, lastProgressAt: Date.now() }));
  }, [prog.done, prog.total]);

  // Coach cooldown calculations
  const now = Date.now();
  const coachReadyAt = coachMeta.lastCoachAt + COACH_COOLDOWN_MS;
  const coachLocked = now < coachReadyAt;
  const minsLeft = coachLocked ? Math.ceil((coachReadyAt - now) / 60000) : 0;

  // Auto-run coach on first open of day OR if stuck for 3 hours
  useEffect(() => {
    if (!isSameDayKey(tKey, realTodayKey)) return;

    const firstOpenToday = coachMeta.lastAutoDayKey !== realTodayKey;
    const stuck = Date.now() - coachMeta.lastProgressAt > 3 * 60 * 60 * 1000 && prog.total > 0 && prog.done < prog.total;

    if ((firstOpenToday || stuck) && !coachLocked && tab === "today") {
      setCoachMeta((prev) => ({ ...prev, lastAutoDayKey: realTodayKey, lastCoachAt: Date.now() }));
      setCoachOpen(true);
      askCoach();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tKey, realTodayKey, prog.total, prog.done, tab]);

  function patchTaskReminderFields(dayKey, hourKey, category, taskId, partial) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dayKey || "").trim())) return;
    setAppState((prev) => {
      const day = prev.days[dayKey];
      if (!day?.hours) return prev;
      const hours = { ...day.hours };
      const byCat = { ...(hours[hourKey] || {}) };
      const list = (byCat[category] || []).map((t) => {
        if (t.id !== taskId) return t;
        let next = { ...t, ...partial };
        if (partial.remindersEnabled === false) {
          next = { ...next, remindAtStart: false, remindBeforeMinutes: null };
        }
        return next;
      });
      hours[hourKey] = { ...byCat, [category]: list };
      return { ...prev, days: { ...prev.days, [dayKey]: { ...day, hours } } };
    });
  }

  function patchTaskFields(dayKey, hourKey, category, taskId, partial) {
    if (!partial || typeof partial !== "object") return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dayKey || "").trim())) return;
    setAppState((prev) => {
      const day = prev.days[dayKey];
      if (!day?.hours) return prev;
      const hours = { ...day.hours };
      const byCat = { ...(hours[hourKey] || {}) };
      const list = (byCat[category] || []).map((t) => (t.id !== taskId ? t : { ...t, ...partial }));
      hours[hourKey] = { ...byCat, [category]: list };
      return { ...prev, days: { ...prev.days, [dayKey]: { ...day, hours } } };
    });
  }

  function ensureTaskOptionalRepeat(dayKey, hourKey, category, taskId) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dayKey || "").trim())) return;
    setAppState((prev) => {
      const day = prev.days[dayKey];
      if (!day?.hours) return prev;
      const hours = { ...day.hours };
      const byCat = { ...(hours[hourKey] || {}) };
      const list = (byCat[category] || []).map((t) => {
        if (t.id !== taskId) return t;
        const r = t.repeat ?? REPEAT_OPTIONS.NONE;
        if (r !== REPEAT_OPTIONS.NONE) return t;
        return { ...t, repeat: REPEAT_OPTIONS.OPTIONAL, repeatUntil: null };
      });
      const updated = list.find((t) => t.id === taskId);
      hours[hourKey] = { ...byCat, [category]: list };
      if (updated && updated.repeat === REPEAT_OPTIONS.OPTIONAL) {
        try {
          const repeatedTasks = JSON.parse(localStorage.getItem("repeatedTasks") || "[]");
          const nextStore = [...repeatedTasks.filter((x) => x.id !== taskId), { ...updated, category, hour: hourKey }];
          localStorage.setItem("repeatedTasks", JSON.stringify(nextStore));
        } catch {
          /* ignore */
        }
      }
      return { ...prev, days: { ...prev.days, [dayKey]: { ...day, hours } } };
    });
  }

  function flushTaskMenuNoteForKey(key) {
    if (!key) return;
    const parts = key.split("-");
    if (parts.length < 3) return;
    const hourKey = parts[0];
    const category = parts[1];
    const id = parts.slice(2).join("-") || parts[2];
    const next = String(taskMenuNoteDraftRef.current || "").trim();
    setAppState((prev) => {
      const day = prev.days[tKey];
      if (!day?.hours) return prev;
      const task = findTaskInAppState(prev, tKey, hourKey, category, id);
      if (!task) return prev;
      const prevNote = task.taskNote != null ? String(task.taskNote).trim() : "";
      if (next === prevNote) return prev;
      const hours = { ...day.hours };
      const byCat = { ...(hours[hourKey] || {}) };
      const list = (byCat[category] || []).map((t) => (t.id !== id ? t : { ...t, taskNote: next }));
      hours[hourKey] = { ...byCat, [category]: list };
      return { ...prev, days: { ...prev.days, [tKey]: { ...day, hours } } };
    });
  }
  flushTaskMenuNoteForKeyRef.current = flushTaskMenuNoteForKey;

  function handleTaskMenuOpen(key, rect) {
    setSecondaryListMenu(null);
    flushTaskMenuNoteForKeyRef.current(taskDropdownRef.current);
    setTaskDropdown(key);
    setDropdownAnchorRect(key ? rect || null : null);
    if (key) {
      const parts = key.split("-");
      if (parts.length >= 3) {
        const hourKey = parts[0];
        const cat = parts[1];
        const tid = parts.slice(2).join("-") || parts[2];
        const task = findTaskInAppState(appStateRef.current, tKey, hourKey, cat, tid);
        setTaskMenuNoteDraft(task?.taskNote != null ? String(task.taskNote) : "");
      }
    } else {
      setTaskMenuNoteDraft("");
    }
  }

  function dismissTaskDropdownOnly() {
    flushTaskMenuNoteForKeyRef.current(taskDropdownRef.current);
    setTaskDropdown(null);
    setDropdownAnchorRect(null);
    setTaskMenuNoteDraft("");
  }

  function ensureHour(hourKey, optionalDayKey) {
    const dk =
      optionalDayKey && /^\d{4}-\d{2}-\d{2}$/.test(String(optionalDayKey).trim())
        ? String(optionalDayKey).trim()
        : tKey;
    setAppState((prev) => {
      const day = prev.days[dk] || { hours: {} };
      const hours = day.hours || {};
      if (hours[hourKey]) return prev;

      const empty = emptySlot(customCategories);
      return { ...prev, days: { ...prev.days, [dk]: { ...(prev.days[dk] || {}), hours: { ...hours, [hourKey]: empty } } } };
    });
  }

  function updateTaskGroceryList(dayKey, hourKey, category, taskId, recipe) {
    setAppState((prev) => {
      const day = prev.days[dayKey];
      if (!day?.hours) return prev;
      const hours = { ...day.hours };
      const byCat = { ...(hours[hourKey] || {}) };
      const row = (byCat[category] || []).map((t) => {
        if (t.id !== taskId) return t;
        const gl = t.groceryList && typeof t.groceryList === "object" ? t.groceryList : { items: [] };
        const items = Array.isArray(gl.items) ? [...gl.items] : [];
        const next = recipe({ ...gl, items });
        return { ...t, groceryList: next };
      });
      hours[hourKey] = { ...byCat, [category]: row };
      return { ...prev, days: { ...prev.days, [dayKey]: { ...day, hours } } };
    });
  }

  function addTask(hourKey, category, text, repeatType = REPEAT_OPTIONS.NONE, sourceTaskId = null, extras = null) {
    const newId = uid();
    const ex = extras && typeof extras === "object" ? extras : {};
    const energyFromExtras = ex.energyLevel;
    const energyLevel =
      energyFromExtras === "LIGHT" || energyFromExtras === "MEDIUM" || energyFromExtras === "HEAVY"
        ? energyFromExtras
        : "MEDIUM";
    const dayKeyForAdd =
      ex.targetDayKey && /^\d{4}-\d{2}-\d{2}$/.test(String(ex.targetDayKey).trim())
        ? String(ex.targetDayKey).trim()
        : tKey;
    const checkText = normalizeText(text) || String(text || "").trim();
    const gkw = normalizeGroceryKeywordsFromProfile(profile);
    if (checkText && taskMatchesGroceryKeywords(checkText, gkw)) {
      queueMicrotask(() => setGroceryListPrompt({ dayKey: dayKeyForAdd, hourKey, category, taskId: newId }));
    }
    setAppState((prev) => {
      const day = prev.days[dayKeyForAdd] || { hours: {} };
      const hours = { ...(day.hours || {}) };
      const byCat = hours[hourKey] || emptySlot(customCategories);

      const nextTask = {
        id: newId,
        text,
        done: false,
        energyLevel,
        completedAt: null,
        feeling: null,
        repeat: repeatType,
        repeatUntil: repeatType !== REPEAT_OPTIONS.NONE ? null : null,
        originalTaskId: sourceTaskId,
        createdAt: new Date().toISOString(),
        ...((ex.taskType === "workout" || ex.workoutProgramMode || ex.workoutProgramId) ? { taskType: "workout" } : {}),
        ...(ex.workoutProgramMode === "queue" || ex.workoutProgramMode === "auto" || ex.workoutProgramMode === "specific"
          ? { workoutProgramMode: ex.workoutProgramMode }
          : {}),
        ...(ex.workoutProgramId ? { workoutProgramId: String(ex.workoutProgramId) } : {}),
        ...(() => {
          const remOn = profile.defaultTaskRemindersOn !== false;
          const before =
            remOn && typeof profile.defaultRemindBeforeMinutes === "number" && profile.defaultRemindBeforeMinutes > 0
              ? profile.defaultRemindBeforeMinutes
              : null;
          const atSt = remOn && profile.defaultRemindAtStart !== false;
          const effectiveRemOn = remOn && (before != null || atSt);
          return {
            remindersEnabled: effectiveRemOn,
            remindAtStart: effectiveRemOn && atSt,
            remindBeforeMinutes: effectiveRemOn ? before : null,
          };
        })(),
      };
      if (ex.coachSuggestionId) {
        nextTask.coachSuggestionId = String(ex.coachSuggestionId);
        nextTask.source = ex.source || COACH_SUGGESTION_SOURCE;
        if (ex.sourceSuggestionType) nextTask.sourceSuggestionType = String(ex.sourceSuggestionType);
        if (ex.sourceTaskId) nextTask.sourceTaskId = String(ex.sourceTaskId);
        if (typeof ex.coachSuggestionEdited === "boolean") nextTask.coachSuggestionEdited = ex.coachSuggestionEdited;
      }
      const nextByCat = { ...byCat, [category]: [...(byCat[category] || []), nextTask] };

      hours[hourKey] = nextByCat;
      
      // Save to repeated tasks if marked for repetition (must not throw; would block React state update)
      if (repeatType !== REPEAT_OPTIONS.NONE) {
        try {
          const repeatedTasks = JSON.parse(localStorage.getItem("repeatedTasks") || "[]");
          repeatedTasks.push({
            ...nextTask,
            category,
            hour: hourKey,
          });
          localStorage.setItem("repeatedTasks", JSON.stringify(repeatedTasks));
        } catch {}
      }
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayKeyForAdd]: {
            ...(prev.days[dayKeyForAdd] || {}),
            hours,
          },
        },
      };
    });
  }

  // Get repeatable tasks (optional repeats that can be added)
  function getRepeatableTasks() {
    try {
      const repeatedTasks = JSON.parse(localStorage.getItem('repeatedTasks') || '[]');
      return repeatedTasks.filter(task => task.repeat === REPEAT_OPTIONS.OPTIONAL);
    } catch {
      return [];
    }
  }

  function toggleTask(hourKey, category, taskId) {
    if (String(taskId).startsWith("sub-")) return;
    const flatBefore = allTasksInDay(todayHours, customCategories);
    const priorTask = flatBefore.find(
      (x) => x.id === taskId && x.hour === hourKey && x.category === category
    );
    const willComplete = priorTask && !priorTask.done;
    if (willComplete && priorTask.coachSuggestionId) {
      const el = priorTask.energyLevel === "LIGHT" || priorTask.energyLevel === "HEAVY" ? priorTask.energyLevel : "MEDIUM";
      setCoachLearning((prev) =>
        recordCoachSuggestedTaskCompleted(prev, {
          type: priorTask.sourceSuggestionType || "ADD_TASK",
          edited: priorTask.coachSuggestionEdited === true,
          category: priorTask.category,
          energyLevel: el,
          titleSnippet: String(priorTask.text || ""),
        })
      );
    }
    if (priorTask) {
      appendTaskBehaviorEvent({
        type: priorTask.done ? "uncomplete" : "complete",
        dayKey: tKey,
        hourKey,
        category,
        taskId,
        textSnippet: String(priorTask.text || ""),
      });
    }
    setAppState((prev) => {
      const day = prev.days[tKey];
      if (!day) return prev;
      const hours = { ...(day.hours || {}) };
      const byCat = hours[hourKey];
      if (!byCat) return prev;

      const list = (byCat[category] || []).map((t) => {
        if (t.id === taskId) {
          const newDone = !t.done;
          
          if (newDone) {
            // COMPLETION RITUAL
            notificationService.notifyTaskComplete(t, category);
            
            // Track completion pattern
            trackTaskCompletion(t, category, hourKey, tKey, t.feeling);
            
            // Count completed tasks today (before this one is marked done)
            const currentlyDone = allTasksInDay(todayHours, customCategories).filter(task => task.done && task.id !== taskId).length;
            const completedToday = currentlyDone + 1; // +1 for this task
            const energyLevel = t.energyLevel || "MEDIUM";
            const allTasksList = allTasksInDay(todayHours, customCategories);
            const emotionalState = inferEmotionalState(allTasksList, getTimeOfDay());
            
            // Generate contextual completion message using Gentle Anchor
            if (profile.completionAffirmationsOn !== false) {
              const tone =
                profile.completionAffirmationTone === "matter-of-fact" ||
                profile.completionAffirmationTone === "funny" ||
                profile.completionAffirmationTone === "harsh"
                  ? profile.completionAffirmationTone
                  : "supportive";
              const message = generateCompletionMessage(t, category, completedToday, energyLevel, emotionalState, tone);
              if (toastDismissTimerRef.current) {
                clearTimeout(toastDismissTimerRef.current);
                toastDismissTimerRef.current = null;
              }
              setToastNotification({
                message,
                taskText: t.text,
                type: "completion",
              });
              toastDismissTimerRef.current = window.setTimeout(() => {
                setToastNotification(null);
                toastDismissTimerRef.current = null;
              }, 3000);
            }
            
            // Update task with completion time
            return { 
              ...t, 
              done: true, 
              completedAt: new Date().toISOString(),
              feeling: t.feeling || null
            };
          }
          
          return { ...t, done: false, completedAt: null };
        }
        return t;
      });
      hours[hourKey] = { ...byCat, [category]: list };
      return { ...prev, days: { ...prev.days, [tKey]: { ...(prev.days[tKey] || {}), hours } } };
    });
  }

  function confirmWorkoutProgramPick(pick) {
    const p = workoutProgramPicker;
    if (!p) return;
    const el =
      p.extras?.energyLevel === "LIGHT" || p.extras?.energyLevel === "MEDIUM" || p.extras?.energyLevel === "HEAVY"
        ? p.extras.energyLevel
        : "MEDIUM";
    const ex = {
      ...(p.extras && typeof p.extras === "object" ? p.extras : {}),
      energyLevel: el,
      taskType: "workout",
      workoutProgramMode: pick.workoutProgramMode,
      ...(pick.workoutProgramId ? { workoutProgramId: pick.workoutProgramId } : {}),
    };
    flushSync(() => addTask(p.hourKey, p.category, p.text, p.repeat, null, ex));
    if (pick.openHealthProgramBuilder) {
      setTab("health");
      setHealthProgramBuilderScroll((n) => n + 1);
    }
    void cloudStorage.saveFullState({
      appState: appStateRef.current,
      notes,
      finance,
      profile,
      health,
      theme,
      routineTemplate,
      morningRoutineTemplate,
      routineSchedule,
      coachMeta,
      coachUserProfile,
      moodboard: EMPTY_MOODBOARD,
      customCategories,
      patterns: loadPatterns(),
      habitTracker,
    });
    setWorkoutProgramPicker(null);
    setQuickText("");
    setQuickRepeat(REPEAT_OPTIONS.NONE);
    setQuickDetailTaskKind("default");
    setQuickAddValue("");
    setToastNotification({
      message: "Workout task added",
      taskText: p.text,
      type: "added",
    });
    setTimeout(() => setToastNotification(null), 2500);
    flashQuickAddButton();
  }

  function beginWorkoutFromTask(dayKey, hourKey, category, task) {
    const { program, advanceQueue } = resolveProgramForTask(health, task);
    if (!program?.exercises?.length) {
      setToastNotification({
        message: "Add programs in Health (or set a weekly routine), then try Begin workout again.",
        taskText: String(task?.text || ""),
        type: "added",
      });
      setTimeout(() => setToastNotification(null), 3200);
      return;
    }
    if (advanceQueue) {
      setHealth((prev) => ({ ...normalizeHealth(prev), ...bumpWeekRoutineCursor(normalizeHealth(prev)) }));
    }
    setGuidedWorkoutSession({
      taskId: task.id,
      dayKey,
      hourKey,
      category,
      programId: program.id,
      programName: program.name,
      exercises: program.exercises,
    });
    setTab("health");
  }

  function markGuidedTaskDone() {
    const g = guidedWorkoutSession;
    if (!g?.hourKey || !g.category || !g.taskId) return;
    if (g.dayKey === tKey) {
      const day = appState.days[g.dayKey];
      const list = day?.hours?.[g.hourKey]?.[g.category];
      const row = list?.find((x) => x.id === g.taskId);
      if (row && !row.done) toggleTask(g.hourKey, g.category, g.taskId);
    }
    setGuidedWorkoutSession(null);
  }

  function practiceProgramFromHealth(program) {
    if (!program?.exercises?.length) return;
    const sid = `adhoc-${program.id}-${Date.now()}`;
    setGuidedWorkoutSession({
      taskId: sid,
      dayKey: realTodayKey,
      hourKey: "",
      category: "",
      programId: program.id,
      programName: program.name,
      exercises: program.exercises,
    });
  }

  function toggleEnergyLevel(hourKey, category, taskId) {
    setAppState((prev) => {
      const day = prev.days[tKey];
      if (!day) return prev;
      const hours = { ...(day.hours || {}) };
      const byCat = hours[hourKey];
      if (!byCat) return prev;

      const list = (byCat[category] || []).map((t) => {
        if (t.id === taskId) {
          const current = t.energyLevel || "MEDIUM";
          const levels = ["LIGHT", "MEDIUM", "HEAVY"];
          const nextIndex = (levels.indexOf(current) + 1) % levels.length;
          return { ...t, energyLevel: levels[nextIndex] };
        }
        return t;
      });
      hours[hourKey] = { ...byCat, [category]: list };
      return { ...prev, days: { ...prev.days, [tKey]: { ...(prev.days[tKey] || {}), hours } } };
    });
    
    // Check for energy balance warnings
    setTimeout(() => {
      const warnings = checkEnergyBalance(todayHours);
      if (warnings.length > 0 && warnings[0]) {
        // Could show a gentle notification about energy balance
      }
    }, 100);
  }

  function setDailyMood(mood) {
    setAppState((prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [tKey]: { ...(prev.days[tKey] || {}), hours: prev.days[tKey]?.hours || {}, dailyMood: mood },
      },
    }));
  }
  function setDailyCapacity(cap) {
    setAppState((prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [tKey]: { ...(prev.days[tKey] || {}), hours: prev.days[tKey]?.hours || {}, dailyCapacity: cap },
      },
    }));
  }

  // Finance helpers
  function parseFinanceQuickInput(raw) {
    const s = String(raw).trim().toLowerCase();
    const numMatch = s.match(/^([+-]?\d+(?:\.\d{1,2})?)\s*(.*)$/) || s.match(/(\d+(?:\.\d{1,2})?)\s*(.*)$/);
    if (!numMatch) return null;
    const amount = Math.abs(parseFloat(numMatch[1]));
    const rest = (numMatch[2] || "").trim();
    if (s.startsWith("-") || rest.startsWith("spent") || rest.startsWith("expense") || rest.startsWith("out")) {
      return { type: "expense", amount, label: rest.replace(/^(spent|expense|out)\s*/i, "").trim() || null };
    }
    return { type: "income", amount, label: rest || null };
  }
  function addFinanceEntry(type, amount, label = null, opts = null) {
    const o = opts && typeof opts === "object" ? opts : {};
    const dateISO =
      typeof o.dateISO === "string" && o.dateISO.trim()
        ? o.dateISO.trim()
        : new Date().toISOString();
    const entry = {
      id: uid(),
      amount,
      label,
      dateISO,
      ...(o.billId ? { billId: String(o.billId) } : {}),
      ...(o.billDueDate ? { billDueDate: String(o.billDueDate) } : {}),
    };
    if (type === "income") {
      setFinance((prev) => ({ ...prev, incomeEntries: [entry, ...(prev.incomeEntries || [])].slice(0, 200) }));
    } else {
      setFinance((prev) => ({ ...prev, expenseEntries: [entry, ...(prev.expenseEntries || [])].slice(0, 200) }));
    }
  }
  function removeFinanceEntry(type, id) {
    if (type === "income") {
      setFinance((prev) => ({ ...prev, incomeEntries: (prev.incomeEntries || []).filter((e) => e.id !== id) }));
    } else {
      setFinance((prev) => ({ ...prev, expenseEntries: (prev.expenseEntries || []).filter((e) => e.id !== id) }));
    }
  }
  function addWishItem(label, targetAmount = null) {
    setFinance((prev) => ({
      ...prev,
      wishList: [...(prev.wishList || []), { id: uid(), label, targetAmount: targetAmount ? parseFloat(targetAmount) : null, savedSoFar: 0 }],
    }));
  }
  function removeWishItem(id) {
    setFinance((prev) => ({ ...prev, wishList: (prev.wishList || []).filter((w) => w.id !== id) }));
  }
  function addSubscription(name, amount, cycle = "monthly", dueDay = null) {
    setFinance((prev) => ({
      ...prev,
      subscriptions: [...(prev.subscriptions || []), { id: uid(), name, amount: parseFloat(amount) || 0, cycle, dueDay: dueDay != null ? parseInt(dueDay, 10) : null }],
    }));
  }
  function removeSubscription(id) {
    setFinance((prev) => ({ ...prev, subscriptions: (prev.subscriptions || []).filter((s) => s.id !== id) }));
  }
  function addBill(name, amount, dueDate) {
    setFinance((prev) => ({
      ...prev,
      bills: [...(prev.bills || []), { id: uid(), name, amount: parseFloat(amount) || 0, dueDate: dueDate || null }],
    }));
  }
  function removeBill(id) {
    setFinance((prev) => ({ ...prev, bills: (prev.bills || []).filter((b) => b.id !== id) }));
  }

  /** Log this bill as spending on its due date (deduped per bill + due date). */
  function markBillPaid(billId) {
    setFinance((prev) => {
      const bills = prev.bills || [];
      const b = bills.find((x) => x.id === billId);
      if (!b || !b.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.dueDate))) {
        return prev;
      }
      const amt = Number(b.amount) || 0;
      if (amt <= 0) return prev;
      const expenses = prev.expenseEntries || [];
      const dupe = expenses.some((e) => e.billId === billId && e.billDueDate === b.dueDate);
      if (dupe) return prev;
      const day = String(b.dueDate).trim();
      const entry = {
        id: uid(),
        amount: amt,
        label: `Bill paid: ${b.name}`,
        dateISO: `${day}T12:00:00.000Z`,
        billId,
        billDueDate: b.dueDate,
      };
      return { ...prev, expenseEntries: [entry, ...expenses].slice(0, 200) };
    });
  }

  function handleMarkBillPaid(billId) {
    const b = (finance.bills || []).find((x) => x.id === billId);
    if (!b) return;
    if (!b.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.dueDate))) {
      setToastNotification({
        message: "Add a due date on the bill so spending can be logged on that day.",
        taskText: String(b.name || ""),
        type: "added",
      });
      setTimeout(() => setToastNotification(null), 3200);
      return;
    }
    const amt = Number(b.amount) || 0;
    if (amt <= 0) {
      setToastNotification({
        message: "Set a bill amount to record it as spending.",
        taskText: String(b.name || ""),
        type: "added",
      });
      setTimeout(() => setToastNotification(null), 3200);
      return;
    }
    const dupe = (finance.expenseEntries || []).some((e) => e.billId === billId && e.billDueDate === b.dueDate);
    if (dupe) {
      setToastNotification({
        message: "Already logged as paid for this due date.",
        taskText: String(b.name || ""),
        type: "added",
      });
      setTimeout(() => setToastNotification(null), 2800);
      return;
    }
    markBillPaid(billId);
    setToastNotification({
      message: `Logged $${amt.toFixed(2)} spent — ${b.name} (${b.dueDate}).`,
      taskText: "",
      type: "added",
    });
    setTimeout(() => setToastNotification(null), 2800);
  }

  function addCreditScoreEntry() {
    const score = Math.round(parseFloat(newCreditScore) || 0);
    if (score < 300 || score > 900) return;
    const dateISO = newCreditDate && /^\d{4}-\d{2}-\d{2}$/.test(newCreditDate) ? `${newCreditDate}T12:00:00` : new Date().toISOString();
    setFinance((prev) => ({
      ...prev,
      creditScoreEntries: [{ id: uid(), score, dateISO }, ...(prev.creditScoreEntries || [])].slice(0, 60),
    }));
    setNewCreditScore("");
  }

  function addDebtPaymentFor(debtAccountId, amountRaw) {
    const amount = parseFloat(String(amountRaw).replace(/,/g, "")) || 0;
    if (amount <= 0) return;
    setFinance((prev) => ({
      ...prev,
      debtPayments: [
        { id: uid(), debtAccountId, amount, dateISO: new Date().toISOString() },
        ...(prev.debtPayments || []),
      ].slice(0, 400),
    }));
  }

  function deleteTask(hourKey, category, taskId, opts = null) {
    if (String(taskId).startsWith("sub-")) return;
    const skipCoach = opts && typeof opts === "object" && opts.skipCoachLearning;
    const skipDispositionLog = opts && typeof opts === "object" && opts.skipDispositionLog;
    const flatBefore = allTasksInDay(todayHours, customCategories);
    const priorTask = flatBefore.find(
      (x) => x.id === taskId && x.hour === hourKey && x.category === category
    );
    if (!skipCoach && priorTask?.coachSuggestionId && !priorTask.done) {
      setCoachLearning((prev) =>
        recordCoachSuggestedTaskAbandoned(prev, {
          type: priorTask.sourceSuggestionType || "ADD_TASK",
          titleSnippet: String(priorTask.text || ""),
        })
      );
    }
    if (priorTask && !skipDispositionLog) {
      appendTaskBehaviorEvent({
        type: "delete",
        dayKey: tKey,
        hourKey,
        category,
        taskId,
        textSnippet: String(priorTask.text || ""),
      });
    }
    setAppState((prev) => {
      const day = prev.days[tKey];
      if (!day) return prev;
      const hours = { ...(day.hours || {}) };
      const byCat = hours[hourKey];
      if (!byCat) return prev;

      const list = (byCat[category] || []).filter((t) => t.id !== taskId);
      const nextByCat = { ...byCat, [category]: list };
      hours[hourKey] = nextByCat;

      return { ...prev, days: { ...prev.days, [tKey]: { ...(prev.days[tKey] || {}), hours } } };
    });
  }

  function moveTaskToTomorrow(hourKey, category, taskId) {
    const day = appState.days[tKey];
    if (!day) return;
    const hours = day.hours || {};
    const byCat = hours[hourKey];
    if (!byCat) return;
    const task = (byCat[category] || []).find((t) => t.id === taskId);
    if (!task) return;

    appendTaskBehaviorEvent({
      type: "tomorrow",
      dayKey: tKey,
      hourKey,
      category,
      taskId,
      textSnippet: String(task.text || ""),
    });

    deleteTask(hourKey, category, taskId, { skipCoachLearning: true, skipDispositionLog: true });

    if (task.coachSuggestionId) {
      setCoachLearning((prev) =>
        recordCoachSuggestedTaskPostponed(prev, {
          type: task.sourceSuggestionType || "ADD_TASK",
          titleSnippet: String(task.text || ""),
        })
      );
    }

    const tomorrowKey = addDaysKey(realTodayKey, 1);
    const tomorrowHour = "09:00";

    setAppState((prev) => {
      const tomorrowDay = prev.days[tomorrowKey] || { hours: {} };
      const tomorrowHours = { ...(tomorrowDay.hours || {}) };
      const tomorrowByCat = tomorrowHours[tomorrowHour] || {};
      const tomorrowList = [...(tomorrowByCat[category] || []), task];

      tomorrowHours[tomorrowHour] = {
        ...tomorrowByCat,
        [category]: tomorrowList
      };

      return {
        ...prev,
        days: {
          ...prev.days,
          [tomorrowKey]: { ...(prev.days[tomorrowKey] || {}), hours: tomorrowHours }
        }
      };
    });

    dismissTaskDropdownOnly();
  }

  function changeTaskTime(hourKey, category, taskId, newHourKey) {
    const day = appState.days[tKey];
    if (!day) return;
    const hours = { ...(day.hours || {}) };
    const byCat = hours[hourKey];
    if (!byCat) return;
    const task = (byCat[category] || []).find((t) => t.id === taskId);
    if (!task) return;
    if (newHourKey === hourKey) return;

    const list = (byCat[category] || []).filter((t) => t.id !== taskId);
    hours[hourKey] = { ...byCat, [category]: list };

    const nextByCat = hours[newHourKey] || emptySlot(customCategories);
    const nextList = [...(nextByCat[category] || []), { ...task, hour: newHourKey }];
    hours[newHourKey] = { ...nextByCat, [category]: nextList };

    setAppState((prev) => ({ ...prev, days: { ...prev.days, [tKey]: { ...(prev.days[tKey] || {}), hours } } }));
    if (task.coachSuggestionId && !task.done) {
      setCoachLearning((prev) =>
        recordCoachSuggestedTaskPostponed(prev, {
          type: task.sourceSuggestionType || "ADD_TASK",
          titleSnippet: String(task.text || ""),
        })
      );
    }
    dismissTaskDropdownOnly();
    setEditingTaskTime(null);
  }

  function deleteHour(hourKey) {
    setAppState((prev) => {
      const day = prev.days[tKey];
      if (!day) return prev;
      const hours = { ...(day.hours || {}) };
      delete hours[hourKey];
      return { ...prev, days: { ...prev.days, [tKey]: { ...(prev.days[tKey] || {}), hours } } };
    });
  }

  const [newHour, setNewHour] = useState("09:00");
  const [pastRepeatAddHour, setPastRepeatAddHour] = useState("09:00");
  const [quickCat, setQuickCat] = useState(() => customCategories[0] || "Work");
  useEffect(() => {
    if (customCategories.length && !customCategories.includes(quickCat)) {
      setQuickCat(customCategories[0]);
    }
  }, [customCategories, quickCat]);
  const [quickText, setQuickText] = useState("");
  const [quickRepeat, setQuickRepeat] = useState(REPEAT_OPTIONS.NONE);
  const [showPastRepeats, setShowPastRepeats] = useState(false);
  /** "type" = natural-language bar; "details" = time, category, repeat, energy */
  const [quickEntryMode, setQuickEntryMode] = useState("type");
  const [quickAddTypeHelpOpen, setQuickAddTypeHelpOpen] = useState(false);
  const [quickAddDetailsHelpOpen, setQuickAddDetailsHelpOpen] = useState(false);
  const [quickDetailEnergy, setQuickDetailEnergy] = useState("MEDIUM");
  /** When set to workout, quick-add (Details) tags the task for the Health rhythm tracker. */
  const [quickDetailTaskKind, setQuickDetailTaskKind] = useState("default");
  const [quickAddJustAdded, setQuickAddJustAdded] = useState(false);
  const quickAddFlashTimerRef = useRef(null);

  useEffect(() => {
    setQuickAddJustAdded(false);
    setQuickDetailTaskKind("default");
    setQuickAddTypeHelpOpen(false);
    setQuickAddDetailsHelpOpen(false);
    if (quickAddFlashTimerRef.current) {
      clearTimeout(quickAddFlashTimerRef.current);
      quickAddFlashTimerRef.current = null;
    }
  }, [quickEntryMode]);

  useEffect(() => {
    return () => {
      if (quickAddFlashTimerRef.current) clearTimeout(quickAddFlashTimerRef.current);
    };
  }, []);

  function flashQuickAddButton() {
    if (quickAddFlashTimerRef.current) clearTimeout(quickAddFlashTimerRef.current);
    setQuickAddJustAdded(true);
    quickAddFlashTimerRef.current = setTimeout(() => {
      setQuickAddJustAdded(false);
      quickAddFlashTimerRef.current = null;
    }, 1600);
  }

  /** Replay product tours from Settings (clears one-time key so Done can run again). */
  function startReplayFeatureTour(mode) {
    try {
      if (mode === "quick") localStorage.removeItem(QUICK_WALKTHROUGH_DONE_KEY);
      if (mode === "full") localStorage.removeItem(FULL_WALKTHROUGH_DONE_KEY);
    } catch {}
    setSettingsSubView("main");
    setShowSettings(false);
    setShowPrivacyPolicy(false);
    setFeatureWalkthroughMode(mode);
  }

  function quickAdd(e) {
    e.preventDefault();
    const clean = normalizeText(quickText);
    if (!clean) return;
    const hourKey = normalizeTimeKey(newHour);
    const el =
      quickDetailEnergy === "LIGHT" || quickDetailEnergy === "MEDIUM" || quickDetailEnergy === "HEAVY"
        ? quickDetailEnergy
        : "MEDIUM";
    const extras = { energyLevel: el };
    if (quickDetailTaskKind === "workout" || textHintsWorkoutTask(clean)) {
      setWorkoutProgramPicker({
        hourKey,
        category: quickCat,
        text: clean,
        repeat: quickRepeat,
        extras,
      });
      return;
    }
    flushSync(() => {
      addTask(hourKey, quickCat, clean, quickRepeat, null, extras);
    });
    void cloudStorage.saveFullState({
      appState: appStateRef.current,
      notes, finance, profile, health, theme, routineTemplate, morningRoutineTemplate,
      routineSchedule, coachMeta, coachUserProfile, moodboard: EMPTY_MOODBOARD, customCategories,
      patterns: loadPatterns(),
      habitTracker,
    });
    setQuickText("");
    setQuickRepeat(REPEAT_OPTIONS.NONE);
    setQuickDetailTaskKind("default");
    setToastNotification({
      message: "Task added",
      taskText: clean,
      type: "added",
    });
    setTimeout(() => setToastNotification(null), 2500);
    flashQuickAddButton();
  }

  function quickAddFromNL(e) {
    e.preventDefault();
    const parsed = parseQuickAddNL(quickAddValue, customCategories, realTodayKey);
    if (!parsed) return;
    const taskText = normalizeText(parsed.text);
    if (!taskText) return;
    const hourKey = normalizeTimeKey(parsed.hour);
    const cats = customCategories.length ? customCategories : DEFAULT_CATEGORIES;
    const category = cats.includes(parsed.category) ? parsed.category : cats[0] || "Work";
    const nlExtras =
      parsed.targetDayKey && /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.targetDayKey).trim())
        ? { targetDayKey: String(parsed.targetDayKey).trim() }
        : {};
    if (textHintsWorkoutTask(taskText)) {
      setWorkoutProgramPicker({
        hourKey,
        category,
        text: taskText,
        repeat: REPEAT_OPTIONS.NONE,
        extras: nlExtras,
      });
      return;
    }
    flushSync(() => {
      addTask(hourKey, category, taskText, REPEAT_OPTIONS.NONE, null, nlExtras);
    });
    // Save directly after flushSync; appStateRef.current is updated synchronously by the commit
    void cloudStorage.saveFullState({
      appState: appStateRef.current,
      notes, finance, profile, health, theme, routineTemplate, morningRoutineTemplate,
      routineSchedule, coachMeta, coachUserProfile, moodboard: EMPTY_MOODBOARD, customCategories,
      patterns: loadPatterns(),
      habitTracker,
    });
    setQuickAddValue("");

    const dayHint =
      parsed.targetDayKey && /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.targetDayKey).trim())
        ? ` (${formatNlTaskDayHint(String(parsed.targetDayKey).trim())})`
        : "";

    // Show success toast
    setToastNotification({
      message: `Task added${dayHint}`,
      taskText,
      type: "added",
    });
    
    setTimeout(() => {
      setToastNotification(null);
    }, 2500);
    
    setQuickText("");
    setQuickRepeat(REPEAT_OPTIONS.NONE);
    flashQuickAddButton();
  }

  const [monthlyText, setMonthlyText] = useState("");
  const [editingMonthlyId, setEditingMonthlyId] = useState(null);
  const [editingMonthlyText, setEditingMonthlyText] = useState("");
  function addMonthly(e) {
    e.preventDefault();
    const clean = normalizeText(monthlyText);
    if (!clean) return;
    setAppState((prev) => ({ ...prev, monthly: [...prev.monthly, { id: uid(), text: clean, done: false }] }));
    setMonthlyText("");
  }
  function toggleMonthly(id) {
    setAppState((prev) => ({ ...prev, monthly: prev.monthly.map((m) => (m.id === id ? { ...m, done: !m.done } : m)) }));
  }
  function deleteMonthly(id) {
    setAppState((prev) => ({ ...prev, monthly: prev.monthly.filter((m) => m.id !== id) }));
  }
  function editMonthly(id, newText) {
    const clean = (newText || "").trim();
    if (!clean) return;
    setAppState((prev) => ({ ...prev, monthly: prev.monthly.map((m) => (m.id === id ? { ...m, text: clean } : m)) }));
    setEditingMonthlyId(null);
    setEditingMonthlyText("");
  }

  function toggleBedtime(id) {
    setAppState((prev) => ({
      ...prev,
      bedtimeRoutine: prev.bedtimeRoutine.map((r) => (r.id === id ? { ...r, done: !r.done } : r)),
    }));
  }

  function toggleMorningRoutine(id) {
    const nextRoutine = effectiveMorningRoutine.map((r) => (r.id === id ? { ...r, done: !r.done } : r));
    setAppState((prev) => ({
      ...prev,
      days: { ...prev.days, [tKey]: { ...prev.days?.[tKey], hours: prev.days?.[tKey]?.hours || {}, morningRoutine: nextRoutine } },
    }));
  }

  // Notes functions
  const [newNote, setNewNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  function addNote(e) {
    e.preventDefault();
    const clean = normalizeText(newNote);
    if (!clean) return;
    const note = { id: uid(), text: clean, createdAt: new Date().toISOString() };
    setNotes((prev) => [...prev, note]);
    setNewNote("");
  }

  function appendNoteFromTask(hourKey, category, taskId) {
    const task = findTaskInAppState(appState, tKey, hourKey, category, taskId);
    const taskText = task?.text ? String(task.text).trim() : "";
    if (!taskText) return;
    const line = `From Today task (${to12Hour(hourKey)} · ${category}): ${taskText}`;
    setNotes((prev) => [...prev, { id: uid(), text: line, createdAt: new Date().toISOString() }]);
  }

  function deleteNote(id) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  function editNote(id, newText) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text: newText } : n)));
  }

  const filteredNotes = useMemo(() => {
    if (!noteSearch.trim()) return notes;
    const searchLower = noteSearch.toLowerCase();
    return notes.filter((n) => n.text.toLowerCase().includes(searchLower));
  }, [notes, noteSearch]);

  const noteSearchDropdownItems = useMemo(
    () => (noteSearch.trim() ? filteredNotes.slice(0, 10) : []),
    [noteSearch, filteredNotes]
  );

  const newNoteTextareaRef = useRef(null);
  useLayoutEffect(() => {
    const el = newNoteTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 56), 280)}px`;
  }, [newNote, tab]);

  async function askCoach(userQuestion = null) {
    if (coachLocked && !userQuestion) return;
    
    setCoachError("");
    setCoachLoading(true);

    const localNowHHMM = `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;
    const coachGuardOpts = { coachViewDayKey: tKey, realTodayKey, localNowHHMM };
    const guardCoachResult = (r) => {
      if (!r || typeof r !== "object") return r;
      return {
        ...r,
        suggestions: applyLiveDaySuggestionGuards(r.suggestions || [], todayHours, coachGuardOpts),
      };
    };

    try {
      const allTasks = allTasksInDay(todayHours, customCategories);
      const timeOfDay = getTimeOfDay();
      const emotionalState = inferEmotionalState(allTasks, timeOfDay);
      const completedToday = allTasks.filter(t => t.done).length;
      const totalTasks = allTasks.length;
      
      // Add user question to conversation if provided
      if (userQuestion) {
        setCoachConversation(prev => [...prev, { role: 'user', content: userQuestion }]);
      }
      
      // Analyze patterns for observant coach insights
      const patterns = analyzePatterns();
      const taskLite = allTasks.map((t) => ({
        hour: t.hour,
        category: t.category,
        text: t.text,
        done: t.done,
        energyLevel: t.energyLevel,
      }));
      const streakCoach = buildScheduleStreakCoachLine(appState.days, realTodayKey, finance.subscriptions, customCategories);
      const taskBehaviorSummary = [formatTaskBehaviorForCoach(realTodayKey), streakCoach].filter(Boolean).join(" | ");
      const financeHints = buildFinanceHintsForCoach(finance);
      const coachIntelSnapshot = buildCoachIntelligenceSnapshot({
        emotionalState,
        timeOfDay,
        tasks: taskLite,
        patterns,
        notes: (notes || []).slice(0, 50).map((n) => ({ text: n.text })),
        learning: coachLearning,
        healthSummary: formatHealthForCoach(health),
        taskBehaviorSummary,
        financeHints,
      });
      const coachIntelligenceText = formatIntelligenceForApi(coachIntelSnapshot);
      const coachFeedbackJson = JSON.stringify((coachLearning.recentFeedback || []).slice(-8));

      const payload = {
        systemPrompt: GENTLE_ANCHOR_PROMPT,
        dayKey: tKey,
        realTodayKey,
        localNowHHMM,
        prettyDate: new Date(tKey + "T00:00:00").toLocaleDateString(),
        mood: appState.days?.[tKey]?.dailyMood || null,
        progress: prog,
        today: todayHours,
        monthly: (appState.monthly || []).map((m) => ({ id: m.id, text: m.text, done: m.done })),
        notes: (notes || []).slice(0, 50).map((n) => ({ text: n.text, createdAt: n.createdAt })),
        categories: customCategories,
        timeOfDay,
        emotionalState,
        completedToday,
        totalTasks,
        energyBalance: checkEnergyBalance(todayHours),
        userQuestion: userQuestion || null,
        conversation: userQuestion
          ? [...coachConversation, { role: "user", content: userQuestion }]
          : [],
        userProfile: coachUserProfile.filled ? {
          biggestChallenge: coachUserProfile.biggestChallenge,
          bestEnergyTime: coachUserProfile.bestEnergyTime,
          oneGoal: coachUserProfile.oneGoal,
        } : null,
        patterns: {
          bestTime: patterns.bestTime,
          leastCompletedCategory: patterns.leastCompletedCategory,
          leastCompletedRate: patterns.leastCompletedRate,
          todayCompletions: patterns.todayCompletions,
          totalCompletions: patterns.totalCompletions,
          sleepCorrelation: patterns.sleepCorrelation || null,
        },
        billsDueSoon: (finance.bills || []).filter((b) => b.dueDate && b.dueDate >= realTodayKey).slice(0, 10),
        subscriptions: (finance.subscriptions || []).map((s) => ({ name: s.name, amount: s.amount, dueDay: s.dueDay })),
        habits: (habitTracker.habits || []).map((h) => ({ id: h.id, label: h.label, direction: h.direction })),
        habitLogSummary: buildHabitSummaryForCoach(habitTracker, realTodayKey),
        habitToday: habitTracker.log[realTodayKey] || {},
        finance: (() => {
          const now = new Date();
          const incomeThisMonth = (finance.incomeEntries || []).reduce((sum, e) => {
            const d = new Date(e.dateISO);
            return (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) ? sum + (e.amount || 0) : sum;
          }, 0);
          const spentThisMonth = (finance.expenseEntries || []).reduce((sum, e) => {
            const d = new Date(e.dateISO);
            return (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) ? sum + (e.amount || 0) : sum;
          }, 0);
          const credit = (finance.creditScoreEntries || [])[0];
          const debtPaySum = (finance.debtPayments || []).slice(0, 20).reduce((s, p) => s + (Number(p.amount) || 0), 0);
          return {
            incomeThisMonth,
            spentThisMonth,
            totalSavings: finance.totalSavings || 0,
            savingsAccounts: (finance.savingsAccounts || []).map((a) => ({ label: a.label, amount: a.amount })),
            totalDebt: finance.totalDebt || 0,
            debtAccounts: (finance.debtAccounts || []).map((a) => ({ label: a.label, amount: a.amount })),
            totalInvestments: finance.totalInvestments || 0,
            subscriptions: finance.subscriptions || [],
            wishList: finance.wishList || [],
            bankStatementNotes: (finance.bankStatementNotes || "").slice(0, 2000),
            latestCreditScore: credit ? { score: credit.score, dateISO: credit.dateISO } : null,
            recentDebtPaymentsTotal: debtPaySum,
            archivedMonthCount: (finance.monthOverviews || []).length,
          };
        })(),
        coachIntelligenceText,
        coachFeedbackJson,
        weekAtAGlance: buildCoachWeekAtAGlance(appState.days, customCategories, tKey),
        healthSummary: formatHealthForCoach(health),
      };

      const res = await fetch(apiUrl("/api/coach"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const rawText = await res.text();
      const trimmed = rawText.trim();
      const looksLikeHtml =
        trimmed.startsWith("<") || trimmed.startsWith("<!") || trimmed.toLowerCase().includes("<!doctype");
      let data = {};
      if (!looksLikeHtml && trimmed) {
        try {
          data = JSON.parse(trimmed);
        } catch {
          data = {};
        }
      }

      const fallbackPayload = () =>
        generateCoachV2Fallback({
          emotionalState,
          completed: completedToday,
          total: totalTasks,
          tasks: taskLite,
          timeOfDay,
          patterns,
          categories: customCategories,
          todayHours,
          intelligence: coachIntelSnapshot,
        });

      if (!res.ok || looksLikeHtml) {
        const hint = looksLikeHtml
          ? "Coach could not reach the API (got a web page instead of JSON). Run vercel dev on port 3000 next to Vite, use the deployed site, or set VITE_APP_ORIGIN for native builds."
          : res.status === 429
            ? `Too many coach requests. Try again in about ${Number(data?.retryAfterSec) || 60} seconds.`
            : typeof data?.error === "string"
              ? data.error
              : String(data?.detail || data?.hint || `Coach request failed (${res.status}).`);
        setCoachError(hint);
        const localResponse = guardCoachResult(fallbackPayload());
        setCoachResult(localResponse);
        if (userQuestion) {
          setCoachConversation((prev) => [...prev, { role: "assistant", content: localResponse.message }]);
        } else {
          setCoachConversation([]);
        }
        setCoachMeta((prev) => ({ ...prev, lastCoachAt: Date.now() }));
        setCoachLoading(false);
        return;
      }

      const shaped = parseCoachApiPayload(
        data && typeof data === "object" ? data : {},
        customCategories,
        todayHours
      );

      const isEmptyReply =
        !String(shaped.message || "").trim() &&
        !(shaped.highlights && shaped.highlights.length) &&
        !(shaped.suggestions && shaped.suggestions.length);

      const finalShaped = isEmptyReply
        ? (() => {
            const fb = fallbackPayload();
            return {
              ...fb,
              followUp: shaped.followUp || fb.followUp,
              insight: shaped.insight || fb.insight,
              suggestions: shaped.suggestions?.length ? shaped.suggestions : fb.suggestions,
            };
          })()
        : shaped;

      if (isEmptyReply) {
        setCoachError(
          "Coach returned an empty reply (often a proxy or API shape issue). Showing a local summary instead."
        );
      } else {
        setCoachError("");
      }

      if (userQuestion) {
        setCoachConversation((prev) => [...prev, { role: "assistant", content: finalShaped.message }]);
      } else {
        setCoachConversation([]);
      }
      setCoachResult(guardCoachResult(finalShaped));

      setCoachMeta((prev) => ({ ...prev, lastCoachAt: Date.now() }));
    } catch {
      const allTasksCatch = allTasksInDay(todayHours, customCategories);
      const emotionalStateCatch = inferEmotionalState(allTasksCatch, getTimeOfDay());
      const completedCatch = allTasksCatch.filter((t) => t.done).length;
      const patternsCatch = analyzePatterns();
      const taskLiteCatch = allTasksCatch.map((t) => ({
        hour: t.hour,
        category: t.category,
        text: t.text,
        done: t.done,
        energyLevel: t.energyLevel,
      }));
      const snapCatch = buildCoachIntelligenceSnapshot({
        emotionalState: emotionalStateCatch,
        timeOfDay: getTimeOfDay(),
        tasks: taskLiteCatch,
        patterns: patternsCatch,
        notes: (notes || []).slice(0, 50).map((n) => ({ text: n.text })),
        learning: coachLearning,
        healthSummary: formatHealthForCoach(health),
      });
      const localResponse = generateCoachV2Fallback({
        emotionalState: emotionalStateCatch,
        completed: completedCatch,
        total: allTasksCatch.length,
        tasks: taskLiteCatch,
        timeOfDay: getTimeOfDay(),
        patterns: patternsCatch,
        categories: customCategories,
        todayHours,
        intelligence: snapCatch,
      });
      setCoachResult(guardCoachResult(localResponse));
      if (userQuestion) {
        setCoachConversation((prev) => [...prev, { role: "assistant", content: localResponse.message }]);
      }
    } finally {
      setCoachLoading(false);
    }
  }

  function handleCoachQuestion(e) {
    e.preventDefault();
    const question = normalizeText(coachQuestion);
    if (!question) return;
    const pending = coachResultRef.current;
    if (isAffirmationToCoach(question) && pending?.suggestions?.length === 1) {
      acceptCoachSuggestion(pending.suggestions[0]);
      setCoachQuestion("");
      return;
    }
    askCoach(question);
    setCoachQuestion("");
  }

  function removeCoachSuggestionById(suggestionId) {
    setCoachResult((prev) => {
      if (!prev?.suggestions?.length) return prev;
      return { ...prev, suggestions: prev.suggestions.filter((x) => x.id !== suggestionId) };
    });
  }

  function declineCoachSuggestion(s) {
    setCoachLearning((prev) =>
      recordSuggestionDeclined(prev, {
        type: s.type,
        category: s.category,
        energyLevel: s.energyLevel,
        title: s.title,
      })
    );
    removeCoachSuggestionById(s.id);
  }

  function coachSuggestionWhenLine(hhmm) {
    const raw = normalizeTimeKey(hhmm || "12:00");
    const h = parseInt(raw.split(":")[0], 10);
    if (Number.isNaN(h)) return "Suggested for your day";
    if (h >= 17 && h <= 23) return "Suggested for tonight";
    if (h >= 12 && h < 17) return "Suggested for this afternoon";
    if (h >= 5 && h < 12) return "Suggested for this morning";
    if (h < 5) return "Suggested for late night";
    return "Suggested for your day";
  }

  function renderCoachSuggestionCards(suggestions) {
    if (!suggestions?.length) return null;
    return (
      <div className="coach-block coach-v2-suggestions-block">
        <p className="settings-hint coach-v2-suggestions-hint">
          Nothing is added until you approve.
        </p>
        <div className="coach-v2-suggest-list">
          {suggestions.map((s) => {
            const isWorkoutProgram = s.type === "ADD_WORKOUT_PROGRAM";
            const canAuto = isWorkoutProgram || s.type === "ADD_TASK" || s.type === "BREAK" || s.type === "SPLIT_TASK";
            const whenLine = isWorkoutProgram ? "Workout program (saves to Health)" : coachSuggestionWhenLine(s.hour || s.start);
            const planDayLine =
              s.weekPlanLabel ||
              (s.targetDayKey && s.targetDayKey !== tKey ? `Planned for ${s.targetDayKey}` : null);
            return (
              <div key={s.id} className="coach-v2-card surface-glass">
                <div className="coach-v2-eyebrow">
                  {whenLine}
                  {!isWorkoutProgram && planDayLine ? <span className="coach-v2-plan-day"> · {planDayLine}</span> : null}
                </div>
                {!isWorkoutProgram ? (
                  <div className="coach-v2-card-top">
                    <span className="coach-v2-meta">
                      <Pill label={s.category} />
                      <span className="coach-v2-energy">{s.energyLevel}</span>
                      <span className="coach-v2-time">{to12Hour(s.hour || s.start)}</span>
                    </span>
                  </div>
                ) : (
                  <div className="coach-v2-card-top">
                    <span className="coach-v2-meta">
                      <span className="coach-v2-energy">My programs</span>
                      <span className="settings-hint" style={{ marginLeft: 8 }}>
                        {(s.workoutProgram?.exerciseLines || []).length} moves
                      </span>
                    </span>
                  </div>
                )}
                <div className="coach-v2-card-title">{s.title}</div>
                {isWorkoutProgram && s.workoutProgram?.exerciseLines?.length ? (
                  <ul className="settings-hint" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                    {s.workoutProgram.exerciseLines.slice(0, 6).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                    {s.workoutProgram.exerciseLines.length > 6 ? (
                      <li>+{s.workoutProgram.exerciseLines.length - 6} more</li>
                    ) : null}
                  </ul>
                ) : null}
                {s.description ? <p className="coach-v2-desc">{s.description}</p> : null}
                <div className="coach-v2-why">
                  <div className="coach-v2-why-label">Why this fits</div>
                  <p className="coach-v2-reason">{s.reason}</p>
                </div>
                <div className="coach-v2-actions">
                  {canAuto ? (
                    <button type="button" className="btn btn-primary" onClick={() => acceptCoachSuggestion(s)}>
                      Approve
                    </button>
                  ) : (
                    <button type="button" className="btn" disabled title="Reorder and timebox controls live in Details mode for now">
                      Not auto-applied
                    </button>
                  )}
                  {canAuto && !isWorkoutProgram ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        setCoachEdit({
                          s,
                          title: s.title,
                          hour: normalizeTimeKey(s.hour || s.start || "09:00"),
                          category: s.category,
                        })
                      }
                    >
                      Edit
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-ghost" onClick={() => declineCoachSuggestion(s)}>
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function acceptCoachSuggestion(s, overrides = null) {
    if (s.type === "ADD_WORKOUT_PROGRAM" && s.workoutProgram?.name && s.workoutProgram.exerciseLines?.length) {
      const exercises = s.workoutProgram.exerciseLines
        .map((line) => normalizeExerciseBlock({ name: String(line).trim() }))
        .filter(Boolean);
      if (!exercises.length) {
        setCoachToast({ text: "That program suggestion had no exercises we could save.", kind: "info" });
        removeCoachSuggestionById(s.id);
        return;
      }
      const id = `prog-${uid()}`;
      const rec = normalizeProgramRecord({ id, name: s.workoutProgram.name, exercises });
      if (!rec) return;
      setHealth((prev) => {
        const base = normalizeHealth(prev);
        return { ...base, programs: [...(base.programs || []), rec] };
      });
      setCoachLearning((prev) =>
        recordSuggestionAccepted(prev, {
          type: s.type,
          category: customCategories[0] || "Work",
          energyLevel: "MEDIUM",
          edited: false,
          titleLower: s.workoutProgram.name.toLowerCase(),
        })
      );
      removeCoachSuggestionById(s.id);
      setCoachToast({ text: "Program saved under Health → My programs", detail: s.workoutProgram.name, kind: "ok" });
      return;
    }
    const ov = overrides && typeof overrides === "object" ? overrides : {};
    const hour = normalizeTimeKey(ov.hour || s.hour || s.start || "09:00");
    const cat = customCategories.includes(ov.category || s.category)
      ? ov.category || s.category
      : customCategories[0] || "Work";
    const titleBase = normalizeText(ov.title || s.title);
    if (!titleBase) return;
    const edited = Boolean(overrides && (ov.title || ov.hour || ov.category));
    const canAutoAdd = s.type === "ADD_TASK" || s.type === "BREAK" || s.type === "SPLIT_TASK";
    if (!canAutoAdd) {
      setCoachToast({ text: "That suggestion is not auto-applied yet. Adjust blocks in Details mode (Daily Progress).", kind: "info" });
      removeCoachSuggestionById(s.id);
      return;
    }
    const label = s.type === "SPLIT_TASK" ? `First slice: ${titleBase}` : titleBase;
    const dayKey =
      s.targetDayKey && /^\d{4}-\d{2}-\d{2}$/.test(String(s.targetDayKey).trim())
        ? String(s.targetDayKey).trim()
        : tKey;
    let repeat = REPEAT_OPTIONS.NONE;
    if (s.recurrencePattern === "weekly") repeat = REPEAT_OPTIONS.WEEKLY;
    else if (s.recurrencePattern === "daily") repeat = REPEAT_OPTIONS.DAILY;
    else if (s.recurrencePattern === "none") repeat = REPEAT_OPTIONS.NONE;
    else if (s.recurring) repeat = REPEAT_OPTIONS.DAILY;
    const splitParentId =
      s.type === "SPLIT_TASK" && s.targetTaskId && String(s.targetTaskId).trim()
        ? String(s.targetTaskId).trim()
        : undefined;
    ensureHour(hour, dayKey);
    addTask(hour, cat, label, repeat, null, {
      energyLevel: s.energyLevel || "MEDIUM",
      coachSuggestionId: s.id,
      source: COACH_SUGGESTION_SOURCE,
      sourceSuggestionType: s.type,
      ...(splitParentId ? { sourceTaskId: splitParentId } : {}),
      coachSuggestionEdited: edited,
      ...(dayKey !== tKey ? { targetDayKey: dayKey } : {}),
    });
    setCoachLearning((prev) =>
      recordSuggestionAccepted(prev, {
        type: s.type,
        category: cat,
        energyLevel: s.energyLevel || "MEDIUM",
        edited,
        titleLower: label.toLowerCase(),
      })
    );
    removeCoachSuggestionById(s.id);
    setCoachToast({ text: `Added at ${to12Hour(hour)}`, detail: label, kind: "ok" });
  }


  async function callCoach(adhdMode) {
    setCoachError("");
    setCoachLoading(true);
    setCoachStructuredResult(null);
    try {
      const allTasks = allTasksInDay(todayHours, customCategories);
      const tasksForApi = allTasks.map((t) => ({ id: t.id, text: t.text, hour: t.hour, category: t.category, done: t.done }));
      const payload = {
        dayKey: tKey,
        today: todayHours,
        tasks: tasksForApi,
        schedule: todayHours,
        progress: prog,
        mood: appState.days?.[tKey]?.dailyMood || null,
        patterns: analyzePatterns(),
        habits: (habitTracker.habits || []).map((h) => ({ id: h.id, label: h.label, direction: h.direction })),
        habitLogSummary: buildHabitSummaryForCoach(habitTracker, realTodayKey),
        habitToday: habitTracker.log[realTodayKey] || {},
        finance: {
          incomeThisMonth: (finance.incomeEntries || []).reduce((s, e) => {
            const d = new Date(e.dateISO);
            const n = new Date();
            return (d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()) ? s + (e.amount || 0) : s;
          }, 0),
          spentThisMonth: (finance.expenseEntries || []).reduce((s, e) => {
            const d = new Date(e.dateISO);
            const n = new Date();
            return (d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()) ? s + (e.amount || 0) : s;
          }, 0),
          totalSavings: finance.totalSavings || 0,
          savingsAccounts: (finance.savingsAccounts || []).map((a) => ({ label: a.label, amount: a.amount })),
          totalDebt: finance.totalDebt || 0,
          debtAccounts: (finance.debtAccounts || []).map((a) => ({ label: a.label, amount: a.amount })),
          totalInvestments: finance.totalInvestments || 0,
          subscriptions: finance.subscriptions || [],
          wishList: finance.wishList || [],
        },
        healthSummary: formatHealthForCoach(health),
      };
      const res = await fetch(apiUrl("/api/coach"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, mode: adhdMode }),
      });
      const rawText = await res.text();
      const trimmed = rawText.trim();
      const looksLikeHtml =
        trimmed.startsWith("<") || trimmed.startsWith("<!") || trimmed.toLowerCase().includes("<!doctype");
      let data = {};
      if (!looksLikeHtml && trimmed) {
        try {
          data = JSON.parse(trimmed);
        } catch {
          data = {};
        }
      }
      if (!res.ok || looksLikeHtml) {
        setCoachError(
          looksLikeHtml
            ? "Could not reach the coach API (HTML instead of JSON). Run vercel dev on port 3000 with Vite, or open the deployed app."
            : res.status === 429
              ? `Too many coach requests. Try again in about ${Number(data?.retryAfterSec) || 60} seconds.`
              : data?.error || data?.detail || "Something went wrong"
        );
        return;
      }
      setCoachStructuredResult({
        summary: data.summary || data.message || "",
        followUp: data.followUp || null,
        actions: Array.isArray(data.actions) ? data.actions : [],
      });
    } catch {
      setCoachError("Network error");
    } finally {
      setCoachLoading(false);
    }
  }

  function applyCoachActions(actions, options = {}) {
    const { clearResult = true } = options;
    if (!Array.isArray(actions) || actions.length === 0) {
      if (clearResult) setCoachStructuredResult(null);
      return;
    }
    const dayTasks = allTasksInDay(todayHours, customCategories);
    actions.forEach((action) => {
      if (action.type === "TIMEBOX" && action.taskId && action.start != null) {
        const task = dayTasks.find((t) => t.id === action.taskId);
        if (task) {
          const hourKey = String(action.start).length === 5 ? action.start : `${String(action.start).padStart(2, "0")}:00`;
          ensureHour(hourKey);
          setAppState((prev) => {
            const day = prev.days[tKey];
            if (!day) return prev;
            const hours = {};
            Object.entries(day.hours || {}).forEach(([hk, byCat]) => {
              hours[hk] = {};
              customCategories.forEach((cat) => {
                hours[hk][cat] = (byCat[cat] || []).filter((t) => t.id !== action.taskId);
              });
            });
            if (!hours[hourKey]) hours[hourKey] = emptySlot(customCategories);
            hours[hourKey][task.category] = [...(hours[hourKey][task.category] || []), { ...task, hour: hourKey }];
            return { ...prev, days: { ...prev.days, [tKey]: { ...day, hours } } };
          });
        }
      }
      if (action.type === "REORDER" && Array.isArray(action.taskIds) && action.taskIds.length > 0) {
        const tasks = action.taskIds.map((id) => dayTasks.find((t) => t.id === id)).filter(Boolean);
        if (tasks.length > 0) {
          setAppState((prev) => {
            const day = prev.days[tKey];
            if (!day) return prev;
            const hours = {};
            const ids = new Set(action.taskIds);
            Object.entries(day.hours || {}).forEach(([hk, byCat]) => {
              hours[hk] = {};
              customCategories.forEach((cat) => {
                hours[hk][cat] = (byCat[cat] || []).filter((t) => !ids.has(t.id));
              });
            });
            tasks.forEach((t) => {
              const h = t.hour;
              if (!hours[h]) hours[h] = emptySlot(customCategories);
              hours[h][t.category] = [...(hours[h][t.category] || []), { ...t }];
            });
            return { ...prev, days: { ...prev.days, [tKey]: { ...day, hours } } };
          });
        }
      }
      if (action.type === "MICRO_STEPS" && action.taskId && Array.isArray(action.steps) && action.steps.length > 0) {
        const task = dayTasks.find((t) => t.id === action.taskId);
        if (task) {
          action.steps.forEach((step, idx) => {
            const stepText = step.text || `Step ${idx + 1}`;
            ensureHour(task.hour);
            addTask(task.hour, task.category, stepText);
          });
        }
      }
    });
    if (clearResult) setCoachStructuredResult(null);
  }

  // Sprint countdown: re-render every second while active, clear when time's up
  const sprintActive = sprintEndsAt != null && Date.now() < sprintEndsAt;
  useEffect(() => {
    if (!sprintEndsAt || Date.now() >= sprintEndsAt) return;
    const id = setInterval(() => {
      if (Date.now() >= sprintEndsAt) setSprintEndsAt(null);
      setSprintTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [sprintEndsAt, sprintTick]);

  function startSprint(actions) {
    applyCoachActions(actions, { clearResult: false });
    setSprintEndsAt(Date.now() + 10 * 60 * 1000);
  }

  // List view - all incomplete tasks for today
  const incompleteTasks = useMemo(() => {
    return allTasksInDay(todayHoursWithSubs, customCategories).filter(t => !t.done).sort((a, b) => {
      // Sort by energy level: Heavy first
      const order = { HEAVY: 0, MEDIUM: 1, LIGHT: 2 };
      const aEnergy = order[a.energyLevel] ?? 1;
      const bEnergy = order[b.energyLevel] ?? 1;
      if (aEnergy !== bEnergy) return aEnergy - bEnergy;
      return a.hour.localeCompare(b.hour);
    });
  }, [todayHoursWithSubs, customCategories]);

  const groceryKeywordsNorm = useMemo(() => normalizeGroceryKeywordsFromProfile(profile), [profile]);

  const groceryTextMatch = useCallback(
    (txt) => taskMatchesGroceryKeywords(txt, groceryKeywordsNorm),
    [groceryKeywordsNorm]
  );

  const taskDispositionStats = useMemo(() => {
    void taskLogRev;
    return summarizeTaskBehaviorForHome(realTodayKey);
  }, [realTodayKey, taskLogRev]);

  const scheduleStreakStats = useMemo(
    () => ({
      streak: computeCalendarCompletionStreak(appState.days, realTodayKey, finance.subscriptions, customCategories),
      weekPerfect: rollingSevenDaySchedulePerfect(appState.days, realTodayKey, finance.subscriptions, customCategories),
    }),
    [appState.days, realTodayKey, finance.subscriptions, customCategories]
  );

  async function handleAuthSignOut() {
    setAuthBusy(true);
    try {
      await authSignOut();
      if (isFirebaseEnabled()) {
        window.location.reload();
      }
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setAuthBusy(false);
    }
  }

  function openDeleteAccountFlow() {
    setShowPrivacyPolicy(false);
    setSettingsSubView("main");
    setShowSettings(false);
    setDeleteAccountError("");
    setDeleteAccountPhrase("");
    setDeleteAccountPhase("intro");
    setDeleteAccountOpen(true);
  }

  function closeDeleteAccountFlow() {
    setDeleteAccountOpen(false);
    setDeleteAccountPhase("intro");
    setDeleteAccountPhrase("");
    setDeleteAccountError("");
  }

  async function executeAccountDeletion() {
    if (!firebaseUser) return;
    if (deleteAccountPhrase.trim() !== ACCOUNT_DELETE_CONFIRM_PHRASE) return;
    setAuthBusy(true);
    setDeleteAccountError("");
    try {
      await deleteCurrentUserAccount();
      try {
        cloudStorage.invalidateLoadCache();
      } catch {}
      setDeleteAccountPhase("success");
      window.setTimeout(() => {
        window.location.reload();
      }, 2200);
    } catch (e) {
      let msg = e?.message || String(e);
      if (e?.code === "auth/requires-recent-login") {
        msg =
          "For your security, sign out, sign in again, then return here to delete your account.";
      }
      setDeleteAccountError(msg);
      setDeleteAccountPhase("error");
    } finally {
      setAuthBusy(false);
    }
  }

  latestForUnloadRef.current = {
    appState,
    notes,
    finance,
    profile,
    health,
    theme,
    routineTemplate,
    morningRoutineTemplate,
    routineSchedule,
    coachMeta,
    coachUserProfile,
    moodboard: EMPTY_MOODBOARD,
    customCategories,
    patterns: loadPatterns(),
    habitTracker,
  };

  const reorderDockNavOnDrop = useCallback((targetId) => {
    const sourceId = dockNavDragSourceRef.current;
    if (!sourceId || sourceId === targetId) return;
    setProfile((p) => {
      const cur = normalizeDockOrder(p.dockOrder);
      const from = cur.indexOf(sourceId);
      const to = cur.indexOf(targetId);
      if (from < 0 || to < 0 || from === to) return p;
      const next = [...cur];
      const [piece] = next.splice(from, 1);
      next.splice(to, 0, piece);
      return { ...p, dockOrder: next };
    });
    dockNavDragSourceRef.current = null;
    setDockNavDragOverId(null);
  }, []);

  const moveDockNavNextToToday = useCallback((id) => {
    setProfile((p) => {
      const cur = normalizeDockOrder(p.dockOrder);
      const i = cur.indexOf(id);
      if (i <= 0) return p;
      const next = cur.filter((x) => x !== id);
      next.unshift(id);
      return { ...p, dockOrder: next };
    });
    setDockNavEditorMenuId(null);
  }, []);

  const removeDockNavFromBar = useCallback((id) => {
    setProfile((p) => ({
      ...p,
      navVisibility: { ...normalizeNavVisibility(p.navVisibility), [id]: false },
    }));
    setDockNavEditorMenuId(null);
  }, []);

  const openHealthCalendarFromHealth = useCallback((mondayKey) => {
    const d = new Date(`${mondayKey}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      setMonthCalendarMonth({ year: d.getFullYear(), month: d.getMonth() });
    }
    setShowMonthCalendar(true);
  }, []);

  const scheduleWorkoutFromHealth = useCallback(
    (title, details) => {
      setTab("today");
      const cat =
        (customCategories && customCategories.length && customCategories[0]) || "Personal";
      const hour = "18:00";
      ensureHour(hour, realTodayKey);
      const body = [title, details].filter(Boolean).join("\n").trim();
      if (body) {
        addTask(hour, cat, body, REPEAT_OPTIONS.NONE, null, {
          taskType: "workout",
          workoutProgramMode: "auto",
          targetDayKey: realTodayKey,
          energyLevel: "MEDIUM",
        });
      }
    },
    [customCategories, realTodayKey],
  );

  const mainDockItems = useMemo(() => {
    const nv = normalizeNavVisibility(profile.navVisibility);
    const order = normalizeDockOrder(profile.dockOrder);
    const dockMeta = {
      today: { id: "today", label: "Today", headerLabel: "Today", icon: CalendarIcon },
      list: { id: "list", label: "List", headerLabel: "List", icon: MenuIcon },
      monthly: { id: "monthly", label: "Monthly", headerLabel: "Monthly", icon: CalendarIcon },
      coach: { id: "coach", label: "Coach", headerLabel: "Pattern insights", icon: SparkleIcon },
      notes: { id: "notes", label: "Notes", headerLabel: "Notes", icon: MoonIcon },
      finance: { id: "finance", label: "Finance", headerLabel: "Finance", icon: FinanceIcon },
      health: { id: "health", label: "Health", headerLabel: "Health", icon: DumbbellIcon },
    };
    const items = [dockMeta.today];
    for (const oid of order) {
      if (nv[oid] === true && dockMeta[oid]) items.push(dockMeta[oid]);
    }
    return items;
  }, [profile.navVisibility, profile.dockOrder]);

  const todayHiddenDockTabs = useMemo(() => {
    const nv = normalizeNavVisibility(profile.navVisibility);
    const ord = normalizeDockOrder(profile.dockOrder);
    return ord.filter((dockId) => nv[dockId] !== true);
  }, [profile.navVisibility, profile.dockOrder]);

  const firebaseOn = isFirebaseEnabled();
  const authWaiting = firebaseOn && !firebaseAuthResolved;
  const showLoginGate = firebaseOn && firebaseAuthResolved && !firebaseUser;

  useEffect(() => {
    const nv = normalizeNavVisibility(profile.navVisibility);
    if (nv[tab] === true) return;
    const order = ["today", ...normalizeDockOrder(profile.dockOrder)];
    const next = order.find((id) => nv[id] === true) || "today";
    if (next !== tab) setTab(next);
  }, [tab, profile.navVisibility, profile.dockOrder]);

  useLayoutEffect(() => {
    if (authWaiting || showLoginGate) return;
    if (onboardingActive) return;
    if (readOnboardingDone()) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const p = raw ? JSON.parse(raw) : null;
      if (savedStateHasScheduleData(p)) {
        localStorage.setItem(ONBOARDING_DONE_KEY, "1");
        setOnboardingActive(false);
        return;
      }
    } catch {}
    if (countScheduleTasks(appState) > 0) {
      try {
        localStorage.setItem(ONBOARDING_DONE_KEY, "1");
      } catch {}
      setOnboardingActive(false);
      return;
    }
    if ((habitTracker.habits || []).length > 0) {
      try {
        localStorage.setItem(ONBOARDING_DONE_KEY, "1");
      } catch {}
      setOnboardingActive(false);
      return;
    }
    setOnboardingActive(true);
  }, [authWaiting, showLoginGate, onboardingActive, appState, habitTracker.habits]);

  function finishOnboardingWizard(tour = null) {
    try {
      localStorage.setItem(ONBOARDING_DONE_KEY, "1");
    } catch {}
    setOnboardingActive(false);
    setOnboardingStep(0);
    if (tour === "quick") {
      try {
        if (localStorage.getItem(QUICK_WALKTHROUGH_DONE_KEY) === "1") return;
      } catch {}
      setFeatureWalkthroughMode("quick");
    } else if (tour === "full") {
      try {
        if (localStorage.getItem(FULL_WALKTHROUGH_DONE_KEY) === "1") return;
      } catch {}
      setFeatureWalkthroughMode("full");
    }
  }

  function completeFeatureWalkthrough() {
    try {
      if (featureWalkthroughMode === "full") localStorage.setItem(FULL_WALKTHROUGH_DONE_KEY, "1");
      if (featureWalkthroughMode === "quick") localStorage.setItem(QUICK_WALKTHROUGH_DONE_KEY, "1");
    } catch {}
    setFeatureWalkthroughMode(null);
  }

  function dismissFeatureWalkthrough() {
    setFeatureWalkthroughMode(null);
  }

  return (
    <div className="app">
      {authWaiting && (
        <div className="login-gate login-gate-loading" aria-busy="true" aria-live="polite">
          <div className="login-gate-card surface-glass login-gate-loading-inner">
            <p className="login-gate-brand">PROYOU</p>
            <p className="login-gate-sub">Loading…</p>
          </div>
        </div>
      )}
      {showLoginGate && (
        <LoginGateScreen
          redirectAuthError={firebaseRedirectAuthError}
          onConsumeRedirectError={() => setFirebaseRedirectAuthError("")}
        />
      )}
      {!authWaiting && !showLoginGate && (
        <>
      <div
        className="shell"
        data-mood={tab === "today" && isSameDayKey(tKey, realTodayKey) ? (appState.days?.[tKey]?.dailyMood || "") : ""}
      >
        <header className="top top-plain">
          <div className="top-inner">
            <div className="top-left">
              <span className="brand-name">PROYOU</span>
              <h1 className="h1 h1-banner-date" style={{ fontSize: "var(--text-display)", fontWeight: 700 }}>
                {tab === "today"
                  ? formatWeekday(tKey)
                  : tab === "list"
                  ? "List"
                  : tab === "monthly"
                  ? "Monthly Objectives"
                  : tab === "notes"
                  ? "Notes"
                  : tab === "finance"
                  ? "Finance"
                  : tab === "health"
                  ? "Health"
                  : "Pattern insights"}
              </h1>
              {(tab !== "today" && tab !== "list") && (
                <span className="sub header-date header-date-visible">
                  {tab === "monthly"
                    ? "Objectives"
                    : tab === "finance"
                    ? "Income, spending & savings"
                    : tab === "health"
                    ? "Training, macros & weight"
                    : "Insights"}
                </span>
              )}
            </div>

            <div className="tabs" aria-hidden="true">
              {mainDockItems.map((item) => (
                <TabButton key={item.id} active={tab === item.id} onClick={() => setTab(item.id)}>
                  {item.headerLabel}
                </TabButton>
              ))}
            </div>

            <div className="top-actions">
              {(tab === "today" || tab === "list") && (
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => {
                    setShowMonthCalendar(true);
                    setMonthCalendarMonth({ year: new Date(selectedDayKey + "T12:00:00").getFullYear(), month: new Date(selectedDayKey + "T12:00:00").getMonth() });
                  }}
                  title="Calendar"
                  aria-label="Open calendar"
                >
                  <CalendarIcon style={{ width: 22, height: 22 }} />
                </button>
              )}
              <button
                type="button"
                id="settings-open"
                className="btn-icon"
                onClick={() => {
                  setSettingsSubView("main");
                  setShowSettings(true);
                }}
                title="Settings"
                aria-label="Settings"
              >
                <SettingsIcon style={{ width: 22, height: 22 }} />
              </button>
            </div>
          </div>
        </header>

        {/* Bottom navigation: frosted dock, active-tab pill */}
        <nav className="bottom-nav surface-dock" aria-label="Main">
          {mainDockItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`bottom-nav-item ${tab === item.id ? "active" : ""}`}
                onClick={() => {
                  setTab(item.id);
                  if (item.id === "today") setShowMonthCalendar(false);
                }}
                aria-current={tab === item.id ? "page" : undefined}
              >
                <Icon style={{ width: 22, height: 22 }} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Sprint countdown bar */}
        {sprintActive && (
          <div className="sprint-bar" role="status" aria-live="polite">
            <span className="sprint-bar-label">Sprint</span>
            <span className="sprint-bar-time">
              {(() => {
                const secs = Math.max(0, Math.ceil((sprintEndsAt - Date.now()) / 1000));
                const m = Math.floor(secs / 60);
                const s = secs % 60;
                return `${m}:${String(s).padStart(2, "0")}`;
              })()}
            </span>
            <button type="button" className="btn btn-sm" onClick={() => setSprintEndsAt(null)}>End sprint</button>
          </div>
        )}

        <main className="shell-main">

        {tab === "today" ? (
          <>
            {/* Add bar: Type (natural language) vs Details (time, category, repeat, energy); above the add field */}
            <div className="quick-add-stack scroll-reveal">
              {quickEntryMode === "type" ? (
                <div className="quick-add-type-help-above">
                  <button
                    type="button"
                    className="quick-add-help-toggle"
                    aria-expanded={quickAddTypeHelpOpen}
                    aria-controls="quick-add-type-help"
                    id="quick-add-type-help-toggle"
                    onClick={() => setQuickAddTypeHelpOpen((o) => !o)}
                  >
                    {quickAddTypeHelpOpen ? "Hide type tips" : "Type tips"}
                  </button>
                  {quickAddTypeHelpOpen ? (
                    <p
                      id="quick-add-type-help"
                      className="quick-add-help-panel quick-add-help-panel--type-above settings-hint"
                      role="region"
                      aria-labelledby="quick-add-type-help-toggle"
                    >
                      In <strong>Type</strong>, include a time (e.g. <strong>4pm</strong> or <strong>16:30</strong>). Add a day so it lands on that calendar:{" "}
                      <strong>tomorrow</strong>, <strong>today</strong>, <strong>next Monday</strong>, <strong>Friday</strong>,{" "}
                      <strong>3/26/26</strong> or <strong>2026-03-26</strong>. Dates are from <strong>today&apos;s</strong> calendar, not only the day you have open.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="quick-add-top-bar">
                <div className="quick-add-entry-mode" role="tablist" aria-label="Add task entry">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={quickEntryMode === "type"}
                    className="quick-add-entry-mode-btn"
                    onClick={() => setQuickEntryMode("type")}
                  >
                    Type
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={quickEntryMode === "details"}
                    className="quick-add-entry-mode-btn"
                    onClick={() => setQuickEntryMode("details")}
                  >
                    Details
                  </button>
                </div>
              </div>
              {quickEntryMode === "type" ? (
                <>
                  <form className="input-group quick-add-bar" onSubmit={quickAddFromNL} autoComplete="off">
                    <input
                      className="input quick-add-input"
                      type="text"
                      name="quickAddTask"
                      value={quickAddValue}
                      onChange={(e) => setQuickAddValue(e.target.value)}
                      placeholder="Add a task… e.g. Meeting 4pm tomorrow, Doctor 2pm 3/26/26"
                      aria-label="Quick add task"
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      className={["btn-primary", "quick-add-submit-btn", quickAddJustAdded ? "quick-add-submit-added" : ""].filter(Boolean).join(" ")}
                      disabled={!quickAddValue.trim() || quickAddJustAdded}
                      aria-label={quickAddJustAdded ? "Task added" : "Add task"}
                    >
                      {quickAddJustAdded ? "Added" : "Add"}
                    </button>
                  </form>
                </>
              ) : (
                <>
                <form className="quick quick-add-details-form" onSubmit={quickAdd} autoComplete="off">
                  <div className="quick-row">
                    <label className="label" htmlFor="quick-detail-time">
                      Time
                    </label>
                    <input
                      id="quick-detail-time"
                      className="input"
                      type="time"
                      value={newHour}
                      onChange={(e) => setNewHour(e.target.value)}
                      aria-label="Task time"
                    />
                  </div>
                  <div className="quick-row">
                    <label className="label" htmlFor="quick-detail-cat">
                      Category
                    </label>
                    <select
                      id="quick-detail-cat"
                      className="input"
                      value={quickCat}
                      onChange={(e) => setQuickCat(e.target.value)}
                    >
                      {customCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="quick-row quick-grow">
                    <label className="label" htmlFor="quick-detail-task">
                      Task
                    </label>
                    <input
                      id="quick-detail-task"
                      className="input quick-detail-task-input"
                      value={quickText}
                      onChange={(e) => setQuickText(e.target.value)}
                      placeholder="What to do…"
                      aria-label="Task title"
                    />
                  </div>
                  <div className="quick-row">
                    <label className="label" htmlFor="quick-detail-repeat">
                      Repeat
                    </label>
                    <select
                      id="quick-detail-repeat"
                      className="input"
                      value={quickRepeat}
                      onChange={(e) => setQuickRepeat(e.target.value)}
                    >
                      <option value={REPEAT_OPTIONS.NONE}>None</option>
                      <option value={REPEAT_OPTIONS.DAILY}>Daily</option>
                      <option value={REPEAT_OPTIONS.WEEKLY}>Weekly</option>
                      <option value={REPEAT_OPTIONS.OPTIONAL}>Option to repeat</option>
                    </select>
                  </div>
                  <div className="quick-row quick-detail-energy-row">
                    <span className="label" id="quick-detail-energy-label">
                      Energy
                    </span>
                    <div className="quick-detail-energy-pills" role="group" aria-labelledby="quick-detail-energy-label">
                      {["LIGHT", "MEDIUM", "HEAVY"].map((lev) => (
                        <button
                          key={lev}
                          type="button"
                          className={`quick-detail-energy-pill ${quickDetailEnergy === lev ? "active" : ""}`}
                          onClick={() => setQuickDetailEnergy(lev)}
                        >
                          {lev.charAt(0) + lev.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  {healthProfileComplete(health) ? (
                    <div className="quick-row">
                      <label className="label" htmlFor="quick-detail-task-kind">
                        Task type
                      </label>
                      <select
                        id="quick-detail-task-kind"
                        className="input"
                        value={quickDetailTaskKind}
                        onChange={(e) => setQuickDetailTaskKind(e.target.value)}
                      >
                        <option value="default">Normal</option>
                        <option value="workout">Workout (counts toward Health rhythm)</option>
                      </select>
                    </div>
                  ) : null}
                  <div className="quick-detail-actions">
                    <button
                      className={["btn", "btn-primary", "quick-details-submit", quickAddJustAdded ? "quick-add-submit-added" : ""].filter(Boolean).join(" ")}
                      type="submit"
                      disabled={!normalizeText(quickText) || quickAddJustAdded}
                      aria-label={quickAddJustAdded ? "Task added" : "Add task"}
                    >
                      {quickAddJustAdded ? "Added" : "Add task"}
                    </button>
                    <button
                      type="button"
                      className="btn quick-details-past-btn"
                      onClick={() => setShowPastRepeats(!showPastRepeats)}
                    >
                      <RepeatIcon /> Past tasks
                    </button>
                  </div>
                  <div className="quick-add-help-wrap quick-add-help-wrap--in-details">
                    <button
                      type="button"
                      className="quick-add-help-toggle"
                      aria-expanded={quickAddDetailsHelpOpen}
                      aria-controls="quick-add-details-help"
                      id="quick-add-details-help-toggle"
                      onClick={() => setQuickAddDetailsHelpOpen((o) => !o)}
                    >
                      {quickAddDetailsHelpOpen ? "Hide details tips" : "Details tips"}
                    </button>
                    {quickAddDetailsHelpOpen ? (
                      <p id="quick-add-details-help" className="quick-add-help-panel settings-hint" role="region" aria-labelledby="quick-add-details-help-toggle">
                        In <strong>Details</strong>, use the fields in this card: <strong>time</strong> (clock picker), <strong>category</strong>, <strong>task</strong> text,{" "}
                        <strong>repeat</strong> (none, daily, weekly, or option to repeat), <strong>energy</strong> level, and <strong>Past tasks</strong> for tasks you saved as repeatable.
                      </p>
                    ) : null}
                  </div>
                  {showPastRepeats && (
                    <div className="past-repeats-list quick-add-past-repeats">
                      <div className="past-repeats-list-title">Tasks you marked &quot;Option to repeat&quot;</div>
                      <div className="quick-row" style={{ marginBottom: 12 }}>
                        <label className="label" htmlFor="quick-past-repeat-hour">
                          Add at time
                        </label>
                        <input
                          id="quick-past-repeat-hour"
                          type="time"
                          className="input"
                          value={pastRepeatAddHour}
                          onChange={(e) => setPastRepeatAddHour(e.target.value)}
                          aria-label="Time for added task"
                        />
                      </div>
                      {getRepeatableTasks().length === 0 ? (
                        <div className="past-repeats-empty">No repeatable tasks yet. Mark a task as &quot;Option to repeat&quot; to see it here.</div>
                      ) : (
                        <div className="past-repeats-items">
                          {getRepeatableTasks().map((task, idx) => (
                            <div
                              key={idx}
                              className="past-repeat-row"
                              onClick={() => {
                                addTask(pastRepeatAddHour, task.category, task.text, REPEAT_OPTIONS.OPTIONAL, task.id);
                                setShowPastRepeats(false);
                              }}
                            >
                              <div>
                                <div className="past-repeat-row-title">{task.text}</div>
                                <div className="past-repeat-row-meta">
                                  {task.category} <BulletIcon style={{ width: 4, height: 4 }} /> {task.hour}
                                </div>
                              </div>
                              <button
                                className="btn"
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addTask(pastRepeatAddHour, task.category, task.text, REPEAT_OPTIONS.OPTIONAL, task.id);
                                  setShowPastRepeats(false);
                                }}
                              >
                                Add
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </form>
                </>
              )}
            </div>

            {tab === "today" && isSameDayKey(tKey, realTodayKey) && (habitTracker.habits || []).length > 0 && (
              <section className="panel habit-daily-card surface-glass scroll-reveal" style={{ marginBottom: 14 }}>
                <div className="panel-title">
                  <span className="title">Habits · today</span>
                </div>
                <p className="settings-hint" style={{ marginBottom: 12 }}>
                  {habitsNeedCheckIn ? "Quick check-in when you’re ready." : "You’re logged for today. You can change answers anytime."}{" "}
                  <strong>Build</strong> = habit you want to grow. <strong>Break</strong> = habit you want to drop.
                </p>
                <ul className="list habit-checkin-list">
                  {(habitTracker.habits || []).map((h) => {
                    const v = (habitTracker.log[realTodayKey] || {})[h.id];
                    return (
                      <li key={h.id} className="habit-checkin-row">
                        <div className="habit-checkin-label">
                          <span className="habit-checkin-name">{h.label}</span>
                          <span className={`habit-direction-tag ${h.direction === "break" ? "is-break" : "is-build"}`}>
                            {h.direction === "break" ? "Break" : "Build"}
                          </span>
                        </div>
                        <div className="habit-checkin-actions">
                          <button
                            type="button"
                            className={`btn btn-sm ${v === "yes" ? "btn-primary" : ""}`}
                            onClick={() =>
                              setHabitTracker((prev) => ({
                                ...prev,
                                log: {
                                  ...prev.log,
                                  [realTodayKey]: { ...(prev.log[realTodayKey] || {}), [h.id]: "yes" },
                                },
                              }))
                            }
                          >
                            {h.direction === "break" ? "Avoided" : "Did it"}
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${v === "no" ? "btn-primary" : ""}`}
                            onClick={() =>
                              setHabitTracker((prev) => ({
                                ...prev,
                                log: {
                                  ...prev.log,
                                  [realTodayKey]: { ...(prev.log[realTodayKey] || {}), [h.id]: "no" },
                                },
                              }))
                            }
                          >
                            {h.direction === "break" ? "Slip" : "Not today"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {tab === "today" && routineSchedule.enabledMorning !== false && routineAppliesToday(routineSchedule.morning, new Date(tKey + "T12:00:00").getDay()) && effectiveMorningRoutine.length > 0 && (
              <section className="panel scroll-reveal" style={{ marginBottom: 14 }}>
                <MorningRoutine routine={effectiveMorningRoutine} onToggle={toggleMorningRoutine} />
              </section>
            )}

            <section className="timeline-wrap scroll-reveal">
              {sortedHourKeys.length === 0 ? (
                <div className="empty-big">
                  <div className="empty-title">No hours yet.</div>
                </div>
              ) : (
                <>
                  {(focusMode || isOverwhelmedMode) && sortedHourKeys.length > 2 && (
                    <p className="focus-mode-notice">
                      {isOverwhelmedMode ? "Drained mode: showing current + next block only." : "Focus mode: showing current + next block only."}
                    </p>
                  )}
                  {visibleHourKeys.map((hourKey) => (
                    <div key={hourKey} className="timeline-row" data-timeline-hour={hourKey}>
                      <div className="timeline-blocks">
                        <HourCard
                          hourKey={hourKey}
                          tasksByCat={todayHoursWithSubs[hourKey]}
                          categories={customCategories}
                          onToggleTask={toggleTask}
                          onToggleEnergyLevel={toggleEnergyLevel}
                          onDeleteTask={deleteTask}
                          onDeleteHour={deleteHour}
                          onMoveToTomorrow={moveTaskToTomorrow}
                          onOpenDropdown={handleTaskMenuOpen}
                          taskDropdown={taskDropdown}
                          expandedTaskKey={expandedTaskKey}
                          onExpandTask={setExpandedTaskKey}
                          onOpenGroceryList={(hk, cat, id) => {
                            setGroceryListModal({ dayKey: tKey, hourKey: hk, category: cat, taskId: id });
                            setGroceryListPrompt(null);
                          }}
                          groceryTextMatch={groceryTextMatch}
                          mode={mode}
                          dayKey={tKey}
                          onPatchTaskReminder={patchTaskReminderFields}
                          onPatchTaskFields={patchTaskFields}
                          onEnsureOptionalRepeat={ensureTaskOptionalRepeat}
                          onBeginWorkout={beginWorkoutFromTask}
                        />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </section>

            {/* Next up + Daily progress, below this day's tasks */}
            {(() => {
              const nextTasks = incompleteTasks.slice(0, 1);
              const next = nextTasks[0];
              return (
                <div className="next-up-card surface-featured scroll-reveal">
                  <div className="next-up-card-inner">
                    <div className="next-up-icon-badge">
                      <CalendarIcon style={{ width: 18, height: 18 }} aria-hidden />
                    </div>
                    <div className="next-up-label">Next up</div>
                    {next ? (
                      <>
                        <div className="next-up-task">{next.text}</div>
                        <div className="next-up-meta">{to12Hour(next.hour)}</div>
                      </>
                    ) : (
                      <div className="next-up-task next-up-task-muted">no tasks yet</div>
                    )}
                  </div>
                  {next && (
                    <button type="button" className="next-up-prep btn-primary" onClick={() => setFocusMode(true)}>
                      Prep
                    </button>
                  )}
                </div>
              );
            })()}

            <section className="panel panel-hero daily-progress-card surface-glass scroll-reveal">
              <div className="panel-top">
                <div className="panel-title">
                  <div className="panel-title-row">
                    <span className="title">Daily Progress</span>
                    <span className={starred ? (starPulse ? "star star-pulse" : "star") : "star star-dim"}>
                      {starred ? <StarIcon filled style={{ display: 'inline-block' }} /> : <StarEmptyIcon style={{ display: 'inline-block' }} />}
                    </span>
                  </div>
                  <div className="meta daily-progress-copy">
                    {prog.pct === 0 && prog.total === 0 ? (
                      <span className="do-plan-subtle" role="tablist" aria-label="Task cards: Type or Details">
                        <button type="button" role="tab" aria-selected={mode === "type"} className="do-plan-subtle-btn" onClick={() => setMode("type")}>Type</button>
                        <span className="do-plan-subtle-sep">·</span>
                        <button type="button" role="tab" aria-selected={mode === "details"} className="do-plan-subtle-btn" onClick={() => setMode("details")}>Details</button>
                      </span>
                    ) : (
                      getProgressCopy(prog.pct)
                    )}
                  </div>
                </div>
                <div className="panel-right">
                  <div className="pct pct-large">{prog.pct}%</div>
                </div>
              </div>
              <ProgressBar pct={prog.pct} />
              <ProgressSegments total={prog.total} done={prog.done} />
              {prog.pct === 0 && prog.total === 0 && (
                <div className="daily-progress-empty">
                  <p className="state-empty">No tasks yet.</p>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary daily-progress-chip"
                    onClick={() => {
                      if (quickEntryMode === "type") document.querySelector(".quick-add-input")?.focus();
                      else document.querySelector(".quick-detail-task-input")?.focus();
                    }}
                  >
                    Add task
                  </button>
                </div>
              )}
            </section>

            {tab === "today" && isSameDayKey(tKey, realTodayKey) && todayHiddenDockTabs.length > 0 && (
              <div className="today-dock-fallback-stack scroll-reveal">
                {todayHiddenDockTabs.map((dockId) => {
                  const cfg = DOCK_FALLBACK_COPY[dockId];
                  if (!cfg) return null;
                  return (
                    <div key={dockId} className="panel health-hero-cta surface-glass today-dock-fallback-card">
                      <div className="health-hero-cta-inner">
                        <div>
                          <div className="title" style={{ fontSize: "1.05rem", marginBottom: 4 }}>
                            {cfg.title}
                          </div>
                          <p className="settings-hint" style={{ margin: 0 }}>
                            {cfg.body}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => {
                            setProfile((p) => ({
                              ...p,
                              navVisibility: { ...normalizeNavVisibility(p.navVisibility), [dockId]: true },
                            }));
                            setTab(dockId);
                          }}
                        >
                          {cfg.btn}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Today's Capacity: Energy + Mood pills (reference) */}
            {tab === "today" && isSameDayKey(tKey, realTodayKey) && (
              <section className="capacity-card scroll-reveal">
                <div className="panel-title">
                  <span className="title">Today&apos;s Capacity</span>
                </div>
                <div className="capacity-pills">
                  {["LOW", "MEDIUM", "HIGH"].map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      className={`capacity-pill ${(appState.days?.[tKey]?.dailyCapacity || "MEDIUM") === cap ? "active" : ""}`}
                      onClick={() => setDailyCapacity(cap)}
                    >
                      {cap.charAt(0) + cap.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
                <div className="capacity-pills">
                  <button
                    type="button"
                    className={`capacity-pill ${(appState.days?.[tKey]?.dailyMood) === "calm" ? "active" : ""}`}
                    onClick={() => setDailyMood("calm")}
                  >
                    Calm
                  </button>
                  <button
                    type="button"
                    className={`capacity-pill ${(appState.days?.[tKey]?.dailyMood) === "neutral" ? "active" : ""}`}
                    onClick={() => setDailyMood("neutral")}
                  >
                    Neutral
                  </button>
                  <button
                    type="button"
                    className={`capacity-pill ${(appState.days?.[tKey]?.dailyMood) === "drained" ? "active" : ""}`}
                    onClick={() => setDailyMood("drained")}
                  >
                    Drained
                  </button>
                </div>
                <button
                  type="button"
                  className="see-full-calendar-btn"
                  onClick={() => {
                    setShowMonthCalendar(true);
                    setMonthCalendarMonth({ year: new Date().getFullYear(), month: new Date().getMonth() });
                  }}
                >
                  See full calendar
                </button>
                <div className="task-averages-capacity-footer">
                  <button
                    type="button"
                    className={`btn task-averages-open-btn ${taskAveragesOpen ? "task-averages-open-btn--open" : ""}`}
                    aria-expanded={taskAveragesOpen}
                    onClick={() => {
                      setTaskAveragesOpen((o) => {
                        const next = !o;
                        if (!next) setTaskStatsExplainOpen(false);
                        return next;
                      });
                    }}
                  >
                    {taskAveragesOpen ? "Close averages" : "Open averages"}
                  </button>
                  {taskAveragesOpen ? (
                    <div className="task-averages-panel surface-glass" role="region" aria-label="Task action averages">
                      {scheduleStreakStats.weekPerfect ? (
                        <div className="task-averages-congrats" role="status">
                          <strong>PROYOU:</strong> You cleared every scheduled day in your last seven days - that&apos;s a full week of follow-through. Seriously impressive.
                        </div>
                      ) : null}
                      {taskDispositionStats.n > 0 && taskDispositionStats.barFracs ? (
                        <>
                          <div className="task-averages-stacked-wrap">
                            <div className="task-averages-stacked" aria-label="Share of logged actions">
                              <span
                                className="task-averages-stacked-seg task-averages-stacked-seg--complete"
                                style={{ width: `${Math.round(taskDispositionStats.barFracs.complete * 100)}%` }}
                              />
                              <span
                                className="task-averages-stacked-seg task-averages-stacked-seg--tomorrow"
                                style={{ width: `${Math.round(taskDispositionStats.barFracs.tomorrow * 100)}%` }}
                              />
                              <span
                                className="task-averages-stacked-seg task-averages-stacked-seg--delete"
                                style={{ width: `${Math.round(taskDispositionStats.barFracs.delete * 100)}%` }}
                              />
                              <span
                                className="task-averages-stacked-seg task-averages-stacked-seg--uncomplete"
                                style={{ width: `${Math.round(taskDispositionStats.barFracs.uncomplete * 100)}%` }}
                              />
                              <span
                                className="task-averages-stacked-seg task-averages-stacked-seg--missed"
                                style={{ width: `${Math.round((taskDispositionStats.barFracs.missed || 0) * 100)}%` }}
                              />
                            </div>
                            <ul className="task-averages-legend">
                              <li>
                                <span className="task-averages-dot task-averages-dot--complete" /> Completed{" "}
                                {taskDispositionStats.pctCompleteShare != null ? `${taskDispositionStats.pctCompleteShare}%` : "-"}
                              </li>
                              <li>
                                <span className="task-averages-dot task-averages-dot--tomorrow" /> Moved to tomorrow{" "}
                                {taskDispositionStats.pctTomorrow != null ? `${taskDispositionStats.pctTomorrow}%` : "-"}
                              </li>
                              <li>
                                <span className="task-averages-dot task-averages-dot--delete" /> Deleted{" "}
                                {taskDispositionStats.pctDelete != null ? `${taskDispositionStats.pctDelete}%` : "-"}
                              </li>
                              <li>
                                <span className="task-averages-dot task-averages-dot--uncomplete" /> Unchecked again{" "}
                                {taskDispositionStats.pctUncomplete != null ? `${taskDispositionStats.pctUncomplete}%` : "-"}
                              </li>
                              <li>
                                <span className="task-averages-dot task-averages-dot--missed" /> Missed (day ended){" "}
                                {taskDispositionStats.pctMissedEod != null ? `${taskDispositionStats.pctMissedEod}%` : "-"}
                              </li>
                            </ul>
                          </div>
                          <p className="task-averages-subline settings-hint">
                            Finishes vs deferrals (this week):{" "}
                            {taskDispositionStats.weekCompletePct != null ? `${taskDispositionStats.weekCompletePct}%` : "-"} · All-time:{" "}
                            {taskDispositionStats.allCompletePct != null ? `${taskDispositionStats.allCompletePct}%` : "-"}
                          </p>
                          <ul className="task-averages-metric-list">
                            <li className="task-averages-metric-row">
                              <span className="task-averages-metric-label">Completed</span>
                              <div className="task-averages-metric-track">
                                <span
                                  className="task-averages-metric-fill task-averages-metric-fill--complete"
                                  style={{ width: `${taskDispositionStats.pctCompleteShare ?? 0}%` }}
                                />
                              </div>
                              <span className="task-averages-metric-pct">{taskDispositionStats.pctCompleteShare != null ? `${taskDispositionStats.pctCompleteShare}%` : "-"}</span>
                            </li>
                            <li className="task-averages-metric-row">
                              <span className="task-averages-metric-label">Moved to tomorrow</span>
                              <div className="task-averages-metric-track">
                                <span
                                  className="task-averages-metric-fill task-averages-metric-fill--tomorrow"
                                  style={{ width: `${taskDispositionStats.pctTomorrow ?? 0}%` }}
                                />
                              </div>
                              <span className="task-averages-metric-pct">{taskDispositionStats.pctTomorrow != null ? `${taskDispositionStats.pctTomorrow}%` : "-"}</span>
                            </li>
                            <li className="task-averages-metric-row">
                              <span className="task-averages-metric-label">Deleted</span>
                              <div className="task-averages-metric-track">
                                <span
                                  className="task-averages-metric-fill task-averages-metric-fill--delete"
                                  style={{ width: `${taskDispositionStats.pctDelete ?? 0}%` }}
                                />
                              </div>
                              <span className="task-averages-metric-pct">{taskDispositionStats.pctDelete != null ? `${taskDispositionStats.pctDelete}%` : "-"}</span>
                            </li>
                            <li className="task-averages-metric-row">
                              <span className="task-averages-metric-label">Unchecked again</span>
                              <div className="task-averages-metric-track">
                                <span
                                  className="task-averages-metric-fill task-averages-metric-fill--uncomplete"
                                  style={{ width: `${taskDispositionStats.pctUncomplete ?? 0}%` }}
                                />
                              </div>
                              <span className="task-averages-metric-pct">{taskDispositionStats.pctUncomplete != null ? `${taskDispositionStats.pctUncomplete}%` : "-"}</span>
                            </li>
                            <li className="task-averages-metric-row">
                              <span className="task-averages-metric-label">Missed (day ended)</span>
                              <div className="task-averages-metric-track">
                                <span
                                  className="task-averages-metric-fill task-averages-metric-fill--missed"
                                  style={{ width: `${taskDispositionStats.pctMissedEod ?? 0}%` }}
                                />
                              </div>
                              <span className="task-averages-metric-pct">{taskDispositionStats.pctMissedEod != null ? `${taskDispositionStats.pctMissedEod}%` : "-"}</span>
                            </li>
                          </ul>
                        </>
                      ) : (
                        <p className="settings-hint task-averages-empty">Not enough logged actions yet - check off a few tasks and come back.</p>
                      )}
                      <div className="task-averages-streak-row">
                        <span className="task-averages-streak-label">All-done streak</span>
                        <span className="task-averages-streak-value">
                          {scheduleStreakStats.streak > 0
                            ? `${scheduleStreakStats.streak} day${scheduleStreakStats.streak === 1 ? "" : "s"} in a row with every task done`
                            : "Start a streak by finishing every task you schedule on a day."}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm task-averages-view-stats-btn"
                        aria-expanded={taskStatsExplainOpen}
                        onClick={() => setTaskStatsExplainOpen((o) => !o)}
                      >
                        {taskStatsExplainOpen ? "Hide stats" : "View stats"}
                      </button>
                      {taskStatsExplainOpen ? (
                        <p className="settings-hint task-averages-stats-explainer">
                          Percentages are from how you use tasks in PROYOU: completes, moving to tomorrow, deletes, unchecking, and (if enabled) automatic missed-at-day-end logs. Coach sees the same
                          numbers plus your <strong>all-done streak</strong> and whether your last seven scheduled days were all finished.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </section>
            )}

            {starred && routineSchedule.enabledNight !== false && routineAppliesToday(routineSchedule.night, new Date(tKey + "T12:00:00").getDay()) && (
              <section className="panel scroll-reveal" style={{ marginTop: 14 }}>
                <BedtimeRoutine 
                  routine={appState.bedtimeRoutine} 
                  onToggle={toggleBedtime}
                  allTasksDone={starred}
                />
              </section>
            )}
          </>
        ) : tab === "list" ? (
          <section className="panel list-page scroll-reveal">
            <div className="list-page-header">
              <h2 className="list-page-title">List</h2>
              <span
                className={
                  incompleteTasks.length === 0
                    ? "list-page-count list-page-count-done-row"
                    : "list-page-count"
                }
              >
                {incompleteTasks.length === 0 ? (
                  <>
                    <span className="list-page-count-done-text">All done for today!</span>
                    <span className="list-page-celebrate-wrap" aria-hidden>
                      <CelebrateIcon className="list-page-celebrate-icon" />
                    </span>
                  </>
                ) : (
                  `${incompleteTasks.length} task${incompleteTasks.length === 1 ? '' : 's'} remaining`
                )}
              </span>
            </div>

            {incompleteTasks.length === 0 ? (
              <div className="empty">All tasks complete!</div>
            ) : (
              <ul className="list list-page-list list-page-tasks">
                {incompleteTasks.map((t) => {
                  const dropdownKey = `${t.hour}-${t.category}-${t.id}`;
                  return (
                    <li
                      key={dropdownKey}
                      className={["list-row", t.energyLevel === "HEAVY" ? "list-row-heavy" : ""].filter(Boolean).join(" ")}
                      onClick={(e) => {
                        if (e.target.closest('.list-row-more, .check, input')) return;
                        const opening = taskDropdown !== dropdownKey;
                        const btn = e.currentTarget.querySelector("[data-task-menu-trigger]");
                        handleTaskMenuOpen(opening ? dropdownKey : null, opening && btn ? btn.getBoundingClientRect() : null);
                      }}
                    >
                      <div className="list-row-body list-row-body-task">
                        <span className="list-row-time" title="Scheduled time">
                          {to12Hour(t.hour)}
                        </span>
                        <label className="list-row-main check" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={!!t.done} onChange={() => toggleTask(t.hour, t.category, t.id)} />
                          <span className="checkmark" />
                          <span className={`list-row-title ${t.done ? 'item-text-done' : ''}`}>{t.text}</span>
                        </label>
                        <div className="list-row-actions">
                        {(taskHasAssociatedGroceryList(t) || groceryTextMatch(t.text)) && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm list-row-grocery"
                            title="Shopping checklist"
                            onClick={(e) => {
                              e.stopPropagation();
                              setGroceryListModal({ dayKey: tKey, hourKey: t.hour, category: t.category, taskId: t.id });
                            }}
                          >
                            {taskHasAssociatedGroceryList(t) ? "View list" : "List"}
                          </button>
                        )}
                        {taskHasWorkoutProgramAttachment(t) ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm list-row-grocery"
                            title="Open guided workout on Health"
                            onClick={(e) => {
                              e.stopPropagation();
                              beginWorkoutFromTask(tKey, t.hour, t.category, t);
                            }}
                          >
                            Begin workout
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="icon-btn list-row-action list-row-more"
                          title="Task options"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (taskDropdown === dropdownKey) {
                              handleTaskMenuOpen(null, null);
                            } else {
                              handleTaskMenuOpen(dropdownKey, e.currentTarget.getBoundingClientRect());
                            }
                          }}
                          data-task-menu-trigger
                          data-task-dropdown-key={dropdownKey}
                          aria-label="Task options"
                        >
                          <MenuIcon style={{ width: 18, height: 18 }} />
                        </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : tab === "monthly" ? (
          <section className="panel monthly-objectives-section scroll-reveal">
            <div className="panel-top">
              <div className="panel-title">
                <div className="meta">Big picture goals that don't clutter Today.</div>
              </div>
            </div>

            <form className="monthly-add monthly-add-bar" onSubmit={addMonthly}>
              <input className="input" value={monthlyText} onChange={(e) => setMonthlyText(e.target.value)} placeholder="Add a monthly objective…" aria-label="New objective" />
              <button className="btn btn-primary monthly-add-submit" type="submit">Add</button>
            </form>

            {appState.monthly.length === 0 ? (
              <div className="empty">Add your first monthly objective.</div>
            ) : (
              <ul className="list list-page-list monthly-objectives-list">
                {appState.monthly.map((m) => (
                  <li
                    key={m.id}
                    className={["list-row", "monthly-list-row", m.done ? "monthly-list-row-done" : ""].filter(Boolean).join(" ")}
                  >
                    {editingMonthlyId === m.id ? (
                      <div className="monthly-edit-row list-row-edit-row">
                        <input
                          className="input"
                          value={editingMonthlyText}
                          onChange={(e) => setEditingMonthlyText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") editMonthly(m.id, editingMonthlyText); if (e.key === "Escape") { setEditingMonthlyId(null); setEditingMonthlyText(""); } }}
                          autoFocus
                        />
                        <div className="list-row-edit-actions">
                          <button type="button" className="btn btn-sm btn-primary" onClick={() => editMonthly(m.id, editingMonthlyText)}>Save</button>
                          <button type="button" className="btn btn-sm" onClick={() => { setEditingMonthlyId(null); setEditingMonthlyText(""); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="list-row-body monthly-list-row-body">
                        <label className="list-row-main check monthly-list-check" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={m.done} onChange={() => toggleMonthly(m.id)} />
                          <span className="checkmark" />
                          <span className={`list-row-title ${m.done ? "item-text-done" : ""}`}>{m.text}</span>
                        </label>
                        <div className="list-row-actions">
                          <button
                            type="button"
                            className="icon-btn list-row-action list-row-more"
                            title="Objective options"
                            aria-label="Objective options"
                            data-list-menu-trigger
                            onClick={(e) => {
                              e.stopPropagation();
                              const anchorEl = e.currentTarget;
                              if (!anchorEl) return;
                              const rect = anchorEl.getBoundingClientRect();
                              dismissTaskDropdownOnly();
                              setSecondaryListMenu((prev) =>
                                prev?.kind === "monthly" && prev.id === m.id ? null : { kind: "monthly", id: m.id, rect }
                              );
                            }}
                          >
                            <MenuIcon style={{ width: 18, height: 18 }} />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : tab === "coach" ? (
          <section className="panel pattern-insights-section scroll-reveal">
            <div className="panel-top">
              <div className="panel-title">
                <div className="meta">Your data, not generic advice · ADHD-aware</div>
              </div>
            </div>

            {/* Pattern insight cards */}
            <div className="pattern-insights">
              <div className="insight-card">
                <span className="insight-label">Peak time</span>
                <span className="insight-value">{patternInsights.bestTime}</span>
                <span className="insight-detail">You complete most tasks in the {patternInsights.bestTime}.</span>
              </div>
              {patternInsights.leastCompletedCategory && (
                <div className="insight-card">
                  <span className="insight-label">Category to nurture</span>
                  <span className="insight-value">{patternInsights.leastCompletedCategory}</span>
                  <span className="insight-detail">
                    {Math.round((1 - patternInsights.leastCompletedRate) * 100)}% completion. Try one small win.
                  </span>
                </div>
              )}
              {patternInsights.sleepCorrelation && (patternInsights.sleepCorrelation.nightsWithRoutine > 0 || patternInsights.sleepCorrelation.nightsWithoutRoutine > 0) && (
                <div className="insight-card insight-sleep">
                  <span className="insight-label">Sleep correlation</span>
                  <span className="insight-value">
                    {patternInsights.sleepCorrelation.avgNextDayWithBedtime != null && patternInsights.sleepCorrelation.avgNextDayWithoutBedtime != null
                      ? `${patternInsights.sleepCorrelation.avgNextDayWithBedtime} vs ${patternInsights.sleepCorrelation.avgNextDayWithoutBedtime} tasks next day`
                      : patternInsights.sleepCorrelation.nightsWithRoutine > 0
                        ? `${patternInsights.sleepCorrelation.avgNextDayWithBedtime} tasks next day (${patternInsights.sleepCorrelation.nightsWithRoutine} nights)`
                        : "Complete routine to see impact."}
                  </span>
                  <span className="insight-detail">ADHD: consistency with wind-down often improves next-day focus.</span>
                </div>
              )}
              <div className="insight-card">
                <span className="insight-label">This week</span>
                <span className="insight-value">{patternInsights.todayCompletions} today</span>
                <span className="insight-detail">{patternInsights.totalCompletions} completions in history.</span>
              </div>
            </div>

            <h3 className="coach-subsection-title">Coach</h3>
            <div className="panel-title"><div className="meta">{prog.done}/{prog.total} tasks · Plan / Unstuck / Review</div></div>

            {/* Mode selector: Plan / Unstuck / Review */}
            <div className="coach-mode-tabs">
              {["plan", "unstuck", "review"].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`btn coach-mode-btn ${coachMode === m ? "active" : ""}`}
                  onClick={() => { setCoachMode(m); setCoachStructuredResult(null); setCoachResult(null); }}
                >
                  {m === "plan" ? "Plan my day" : m === "unstuck" ? "Unstuck" : "Review"}
                </button>
              ))}
            </div>

            {/* ADHD Coach: run mode → structured result with Apply */}
            <div className="coach-structured-section">
              <button
                type="button"
                className="btn btn-primary"
                disabled={coachLoading}
                onClick={() => callCoach(coachMode)}
              >
                {coachLoading ? "Thinking…" : coachMode === "plan" ? "Plan my day" : coachMode === "unstuck" ? "Pick one task & break it down" : "End-of-day review"}
              </button>
              {coachLoading && !coachStructuredResult && (
                <div className="coach-skeleton">
                  <div className="coach-skeleton-line" />
                  <div className="coach-skeleton-line short" />
                </div>
              )}
              {coachStructuredResult && (
                <div className="coach-output-card">
                  <p className="coach-output-summary">{coachStructuredResult.summary}</p>
                  {coachStructuredResult.followUp && <p className="coach-output-followup">{coachStructuredResult.followUp}</p>}
                  {coachStructuredResult.actions && coachStructuredResult.actions.length > 0 && (
                    <div className="coach-output-actions" style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <button type="button" className="btn btn-primary" onClick={() => applyCoachActions(coachStructuredResult.actions)}>
                        {coachMode === "unstuck" ? "Pin micro-steps to timeline" : "Apply plan"}
                      </button>
                      {coachMode === "unstuck" && (
                        <button type="button" className="btn btn-primary" onClick={() => startSprint(coachStructuredResult.actions)}>
                          Start Sprint (10 min)
                        </button>
                      )}
                    </div>
                  )}
                  <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => setCoachStructuredResult(null)}>Dismiss</button>
                </div>
              )}
            </div>

            {/* Question Input Form - Prominent */}
            <form className="coach-question-form" onSubmit={handleCoachQuestion} style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="input"
                  type="text"
                  value={coachQuestion}
                  onChange={(e) => setCoachQuestion(e.target.value)}
                  placeholder="Ask me anything about your schedule..."
                  disabled={coachLoading}
                  style={{ flex: 1, fontSize: '15px', padding: '12px 16px' }}
                />
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={coachLoading || !coachQuestion.trim()}
                  style={{ padding: '12px 24px' }}
                >
                  {coachLoading ? "Thinking…" : "Ask"}
                </button>
              </div>
            </form>

            <div className="coach-actions">
              <button
                className="btn btn-primary"
                type="button"
                disabled={coachLocked || coachLoading}
                onClick={() => {
                  if (!coachLocked) askCoach();
                }}
              >
                {coachLoading ? "Thinking…" : coachLocked ? `Coach in ${minsLeft}m` : "General Check-in"}
              </button>
              {(coachResult || coachConversation.length > 0) && (
                <button className="btn" type="button" onClick={() => {
                  setCoachResult(null);
                  setCoachConversation([]);
                  setCoachEdit(null);
                  setCoachToast(null);
                }}>
                  Clear
                </button>
              )}
            </div>

            {coachError && (
              <div className="coach-error">
                {coachError}
              </div>
            )}

            {coachToast && (
              <div className={`coach-toast ${coachToast.kind === "info" ? "coach-toast-info" : "coach-toast-ok"}`} role="status">
                <div className="coach-toast-title">{coachToast.text}</div>
                {coachToast.detail ? <div className="coach-toast-detail">{coachToast.detail}</div> : null}
              </div>
            )}

            {/* Conversation: structured follow-up sits directly under the latest coach reply */}
            {coachConversation.length > 0 && (
              <div className="coach-conversation" style={{ marginBottom: "var(--spacing-md)" }}>
                {coachConversation.map((msg, idx) => {
                  const showFollowUp =
                    coachResult &&
                    msg.role === "assistant" &&
                    idx === coachConversation.length - 1;
                  return (
                    <div key={idx} className={`coach-msg coach-msg-${msg.role}`}>
                      <div className="coach-msg-label">{msg.role === "user" ? "You" : "Coach"}</div>
                      <div className="coach-msg-content">{msg.content}</div>
                      {showFollowUp ? (
                        <div className="coach-inline-followup">
                          {renderCoachSuggestionCards(coachResult.suggestions)}
                          {(coachResult.followUp || coachResult.question) ? (
                            <div className="coach-block coach-inline-block">
                              <div className="coach-block-title">A question</div>
                              <p className="coach-message" style={{ marginTop: 0 }}>
                                {coachResult.followUp || coachResult.question}
                              </p>
                            </div>
                          ) : null}
                          {coachResult.insight ? (
                            <div className="coach-block coach-insight-block coach-inline-block">
                              <div className="coach-block-title">Observation</div>
                              <p className="coach-insight-text">{coachResult.insight}</p>
                            </div>
                          ) : null}
                          {coachResult.highlights && coachResult.highlights.length > 0 ? (
                            <div className="coach-block coach-inline-block">
                              <div className="coach-block-title">Today&apos;s focus</div>
                              <ul className="coach-list">
                                {coachResult.highlights.map((h, i) => (
                                  <li key={i}>{h}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {coachResult.ignoredMonthlies && coachResult.ignoredMonthlies.length > 0 ? (
                            <div className="coach-block coach-inline-block">
                              <div className="coach-block-title">Monthlies you might be ignoring</div>
                              <ul className="coach-list">
                                {coachResult.ignoredMonthlies.map((m) => (
                                  <li key={m.id || m.text}>{m.text}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {coachResult.percentSummary ? (
                            <div className="coach-block coach-inline-block">
                              <div className="coach-block-title">Completion snapshot</div>
                              <div className="coach-mono">{coachResult.percentSummary}</div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {!coachResult && !coachError && !coachLoading && coachConversation.length === 0 && (
              <div className="empty">
                Type a question above, or click &quot;General Check-in&quot; for an overview.
                <br />
                <br />
                <small style={{ opacity: 0.7 }}>
                  Expand <strong>Get to know you</strong> below so suggestions stay grounded in your goals.
                </small>
              </div>
            )}

            {/* Structured result when there is no chat thread (general check-in) */}
            {coachResult && coachConversation.length === 0 && (
              <div className="coach-body coach-body-v2">
                {coachResult.message ? <div className="coach-message">{coachResult.message}</div> : null}

                {renderCoachSuggestionCards(coachResult.suggestions)}

                {(coachResult.followUp || coachResult.question) ? (
                  <div className="coach-block">
                    <div className="coach-block-title">A question</div>
                    <p className="coach-message" style={{ marginTop: 0 }}>
                      {coachResult.followUp || coachResult.question}
                    </p>
                  </div>
                ) : null}

                {coachResult.insight ? (
                  <div className="coach-block coach-insight-block">
                    <div className="coach-block-title">Observation</div>
                    <p className="coach-insight-text">{coachResult.insight}</p>
                  </div>
                ) : null}

                {coachResult.highlights && coachResult.highlights.length > 0 ? (
                  <div className="coach-block">
                    <div className="coach-block-title">Today&apos;s focus</div>
                    <ul className="coach-list">
                      {coachResult.highlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {coachResult.ignoredMonthlies && coachResult.ignoredMonthlies.length > 0 ? (
                  <div className="coach-block">
                    <div className="coach-block-title">Monthlies you might be ignoring</div>
                    <ul className="coach-list">
                      {coachResult.ignoredMonthlies.map((m) => (
                        <li key={m.id || m.text}>{m.text}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {coachResult.percentSummary ? (
                  <div className="coach-block">
                    <div className="coach-block-title">Completion snapshot</div>
                    <div className="coach-mono">{coachResult.percentSummary}</div>
                  </div>
                ) : null}
              </div>
            )}

            <details className="coach-gtky-details">
              <summary className="coach-gtky-summary">
                {coachUserProfile.filled ? "Your coaching profile" : "Get to know you"}
              </summary>
              <div className="coach-gtky-body">
                <p className="settings-hint" style={{ marginBottom: 12 }}>
                  A few notes help the coach stay grounded in what matters to you. You can update this anytime.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <label className="label">What&apos;s your biggest challenge with planning or habits?</label>
                  <input
                    className="input"
                    value={coachUserProfile.biggestChallenge}
                    onChange={(e) => setCoachUserProfile((p) => ({ ...p, biggestChallenge: e.target.value }))}
                    placeholder="e.g. Overcommitting, starting late..."
                  />
                  <label className="label">When do you usually have the most energy?</label>
                  <input
                    className="input"
                    value={coachUserProfile.bestEnergyTime}
                    onChange={(e) => setCoachUserProfile((p) => ({ ...p, bestEnergyTime: e.target.value }))}
                    placeholder="e.g. Morning, after lunch..."
                  />
                  <label className="label">One goal you&apos;re working toward right now?</label>
                  <input
                    className="input"
                    value={coachUserProfile.oneGoal}
                    onChange={(e) => setCoachUserProfile((p) => ({ ...p, oneGoal: e.target.value }))}
                    placeholder="e.g. Ship the project, exercise 3x/week..."
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      const next = { ...coachUserProfile, filled: true };
                      setCoachUserProfile(next);
                      localStorage.setItem(COACH_USER_PROFILE_KEY, JSON.stringify(next));
                    }}
                  >
                    Save profile
                  </button>
                </div>
              </div>
            </details>

            {coachEdit ? (
              <div className="coach-edit-overlay" role="dialog" aria-modal="true" aria-labelledby="coach-edit-heading">
                <div className="coach-edit-modal surface-glass">
                  <div className="coach-edit-head">
                    <h3 id="coach-edit-heading" className="coach-edit-title">Edit before adding</h3>
                    <button type="button" className="icon-btn" aria-label="Close" onClick={() => setCoachEdit(null)}>
                      <CloseIcon />
                    </button>
                  </div>
                  <div className="coach-edit-body">
                    <label className="label" htmlFor="coach-edit-title-field">Title</label>
                    <input
                      id="coach-edit-title-field"
                      className="input"
                      value={coachEdit.title}
                      onChange={(e) => setCoachEdit((prev) => ({ ...prev, title: e.target.value }))}
                    />
                    <label className="label" htmlFor="coach-edit-time">Time</label>
                    <input
                      id="coach-edit-time"
                      className="input"
                      type="time"
                      value={coachEdit.hour}
                      onChange={(e) => setCoachEdit((prev) => ({ ...prev, hour: normalizeTimeKey(e.target.value) }))}
                    />
                    <label className="label" htmlFor="coach-edit-cat">Category</label>
                    <select
                      id="coach-edit-cat"
                      className="input"
                      value={coachEdit.category}
                      onChange={(e) => setCoachEdit((prev) => ({ ...prev, category: e.target.value }))}
                    >
                      {customCategories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="coach-edit-actions">
                    <button type="button" className="btn" onClick={() => setCoachEdit(null)}>Cancel</button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        const { s, title, hour, category } = coachEdit;
                        acceptCoachSuggestion(s, { title, hour, category });
                        setCoachEdit(null);
                      }}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : tab === "health" ? (
          <HealthPage
            health={health}
            setHealth={setHealth}
            profile={profile}
            setProfile={setProfile}
            realTodayKey={realTodayKey}
            appState={appState}
            onOpenHealthCalendar={openHealthCalendarFromHealth}
            onScheduleWorkoutTask={scheduleWorkoutFromHealth}
            onPracticeProgram={practiceProgramFromHealth}
            guidedSession={guidedWorkoutSession}
            onClearGuidedSession={() => setGuidedWorkoutSession(null)}
            onMarkGuidedTaskDone={markGuidedTaskDone}
            scrollToProgramBuilderSignal={healthProgramBuilderScroll}
          />
        ) : tab === "finance" ? (
          <section className="panel finance-panel surface-glass section-finance scroll-reveal">
            <div className="panel-top">
              <div className="panel-title">
                <div className="meta">Income, spending, savings & debt. Coach can help with habits.</div>
              </div>
            </div>

            <div className="health-nav-toggle surface-glass finance-nav-toggle">
              <label className="health-toggle-row">
                <input
                  type="checkbox"
                  checked={normalizeNavVisibility(profile.navVisibility).finance === true}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      navVisibility: { ...normalizeNavVisibility(p.navVisibility), finance: e.target.checked },
                    }))
                  }
                />
                <span>Show <strong>Finance</strong> in bottom navigation</span>
              </label>
            </div>

            <form className="input-group finance-quick-add" onSubmit={(e) => {
              e.preventDefault();
              const parsed = parseFinanceQuickInput(financeQuickInput);
              if (parsed) {
                addFinanceEntry(parsed.type, parsed.amount, parsed.label);
                setFinanceQuickInput("");
              }
            }}>
              <input
                className="input"
                type="text"
                value={financeQuickInput}
                onChange={(e) => setFinanceQuickInput(e.target.value)}
                placeholder="+500 income or -200 spent (or &quot;200 spent&quot;)"
                aria-label="Add income or expense"
              />
              <button type="submit" className="btn-primary" disabled={!financeQuickInput.trim()}>Add</button>
            </form>

            <div className="finance-totals surface-glass">
              <div className="finance-total-row">
                <span className="finance-total-label">Income (this month)</span>
                <span className="finance-total-value income">
                  +${(finance.incomeEntries || []).reduce((sum, e) => {
                    const d = new Date(e.dateISO);
                    const n = new Date();
                    if (d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()) return sum + (e.amount || 0);
                    return sum;
                  }, 0).toFixed(2)}
                </span>
              </div>
              <div className="finance-total-row">
                <span className="finance-total-label">Spent (this month)</span>
                <span className="finance-total-value expense">
                  -${(finance.expenseEntries || []).reduce((sum, e) => {
                    const d = new Date(e.dateISO);
                    const n = new Date();
                    if (d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()) return sum + (e.amount || 0);
                    return sum;
                  }, 0).toFixed(2)}
                </span>
              </div>
              <div className="finance-total-row finance-total-row-net">
                <span className="finance-total-label">Net (this month)</span>
                <span className="finance-total-value net">
                  ${(() => {
                    const income = (finance.incomeEntries || []).reduce((sum, e) => {
                      const d = new Date(e.dateISO);
                      const n = new Date();
                      if (d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()) return sum + (e.amount || 0);
                      return sum;
                    }, 0);
                    const spent = (finance.expenseEntries || []).reduce((sum, e) => {
                      const d = new Date(e.dateISO);
                      const n = new Date();
                      if (d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()) return sum + (e.amount || 0);
                      return sum;
                    }, 0);
                    return (income - spent).toFixed(2);
                  })()}
                </span>
              </div>
              <div className="finance-savings-block">
                <div className="finance-total-row finance-savings-header">
                  <span className="finance-total-label">Savings accounts</span>
                </div>
                <p className="finance-hint finance-savings-hint">Add each account and its balance; total savings below is the sum.</p>
                <ul className="finance-list finance-savings-list">
                  {(finance.savingsAccounts || []).length === 0 && (
                    <li className="finance-list-empty">No accounts yet. Add one with the form below.</li>
                  )}
                  {(finance.savingsAccounts || []).map((a) => (
                    <li key={a.id} className="finance-list-item finance-savings-row">
                      <input
                        className="input"
                        value={a.label}
                        onChange={(e) => {
                          const label = e.target.value;
                          setFinance((prev) => {
                            const next = (prev.savingsAccounts || []).map((x) => (x.id === a.id ? { ...x, label } : x));
                            return { ...prev, savingsAccounts: next, totalSavings: sumSavingsAccounts(next) };
                          });
                        }}
                        placeholder="e.g. Emergency fund"
                        aria-label="Savings account name"
                      />
                      <input
                        className="input finance-savings-balance-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={a.amount === 0 ? "" : a.amount}
                        onChange={(e) => {
                          const amount = parseFloat(e.target.value) || 0;
                          setFinance((prev) => {
                            const next = (prev.savingsAccounts || []).map((x) => (x.id === a.id ? { ...x, amount } : x));
                            return { ...prev, savingsAccounts: next, totalSavings: sumSavingsAccounts(next) };
                          });
                        }}
                        placeholder="0"
                        aria-label="Balance"
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => {
                          setFinance((prev) => {
                            const next = (prev.savingsAccounts || []).filter((x) => x.id !== a.id);
                            return { ...prev, savingsAccounts: next, totalSavings: sumSavingsAccounts(next) };
                          });
                        }}
                        aria-label="Remove account"
                      >
                        <TrashIcon />
                      </button>
                    </li>
                  ))}
                </ul>
                <form
                  className="finance-inline-form finance-savings-add"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const label = newSavingsLabel.trim() || "Account";
                    const amount = parseFloat(newSavingsAmount) || 0;
                    setFinance((prev) => {
                      const next = [...(prev.savingsAccounts || []), { id: uid(), label, amount }];
                      return { ...prev, savingsAccounts: next, totalSavings: sumSavingsAccounts(next) };
                    });
                    setNewSavingsLabel("");
                    setNewSavingsAmount("");
                  }}
                >
                  <input className="input" value={newSavingsLabel} onChange={(e) => setNewSavingsLabel(e.target.value)} placeholder="Account name" />
                  <input className="input finance-savings-balance-input" type="number" min="0" step="0.01" value={newSavingsAmount} onChange={(e) => setNewSavingsAmount(e.target.value)} placeholder="Balance" />
                  <button type="submit" className="btn btn-primary">Add account</button>
                </form>
              </div>
              <div className="finance-total-row savings">
                <span className="finance-total-label">Total savings</span>
                <span className="finance-total-value savings-total">${(finance.totalSavings || 0).toFixed(2)}</span>
              </div>
              <div className="finance-debt-block">
                <div className="finance-total-row finance-debt-header">
                  <span className="finance-total-label">Debts</span>
                </div>
                <p className="finance-hint finance-debt-hint">e.g. auto loan, credit cards, student loans. Amounts owed; total debt below is the sum.</p>
                <ul className="finance-list finance-debt-list">
                  {(finance.debtAccounts || []).length === 0 && (
                    <li className="finance-list-empty">No debts listed. Add one below if you want them in your snapshot.</li>
                  )}
                  {(finance.debtAccounts || []).map((a) => {
                    const paidSum = (finance.debtPayments || [])
                      .filter((p) => p.debtAccountId === a.id)
                      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
                    return (
                      <li key={a.id} className="finance-list-item finance-debt-row" style={{ flexWrap: "wrap" }}>
                        <input
                          className="input"
                          value={a.label}
                          onChange={(e) => {
                            const label = e.target.value;
                            setFinance((prev) => {
                              const next = (prev.debtAccounts || []).map((x) => (x.id === a.id ? { ...x, label } : x));
                              return { ...prev, debtAccounts: next, totalDebt: sumDebtAccounts(next) };
                            });
                          }}
                          placeholder="e.g. Auto loan, Visa"
                          aria-label="Debt type or name"
                        />
                        <input
                          className="input finance-debt-balance-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={a.amount === 0 ? "" : a.amount}
                          onChange={(e) => {
                            const amount = parseFloat(e.target.value) || 0;
                            setFinance((prev) => {
                              const next = (prev.debtAccounts || []).map((x) => (x.id === a.id ? { ...x, amount } : x));
                              return { ...prev, debtAccounts: next, totalDebt: sumDebtAccounts(next) };
                            });
                          }}
                          placeholder="0"
                          aria-label="Amount owed"
                        />
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => {
                            setFinance((prev) => {
                              const next = (prev.debtAccounts || []).filter((x) => x.id !== a.id);
                              return { ...prev, debtAccounts: next, totalDebt: sumDebtAccounts(next) };
                            });
                          }}
                          aria-label="Remove debt"
                        >
                          <TrashIcon />
                        </button>
                        <div className="finance-inline-form" style={{ width: "100%", marginTop: 8, flexWrap: "wrap" }}>
                          <span className="settings-hint" style={{ flex: "1 1 140px", marginRight: 8 }}>
                            Total logged pay-down: ${paidSum.toFixed(2)} (update the balance above when you pay it down, if you like)
                          </span>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            step="0.01"
                            style={{ width: 100 }}
                            placeholder="Payment"
                            value={debtPayDraft[a.id] ?? ""}
                            onChange={(e) => setDebtPayDraft((prev) => ({ ...prev, [a.id]: e.target.value }))}
                            aria-label={`Payment toward ${a.label}`}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              addDebtPaymentFor(a.id, debtPayDraft[a.id]);
                              setDebtPayDraft((prev) => ({ ...prev, [a.id]: "" }));
                            }}
                          >
                            Log payment
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <form
                  className="finance-inline-form finance-debt-add"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const label = newDebtLabel.trim() || "Debt";
                    const amount = parseFloat(newDebtAmount) || 0;
                    setFinance((prev) => {
                      const next = [...(prev.debtAccounts || []), { id: uid(), label, amount }];
                      return { ...prev, debtAccounts: next, totalDebt: sumDebtAccounts(next) };
                    });
                    setNewDebtLabel("");
                    setNewDebtAmount("");
                  }}
                >
                  <input className="input" value={newDebtLabel} onChange={(e) => setNewDebtLabel(e.target.value)} placeholder="What it is (auto, card…)" />
                  <input className="input finance-debt-balance-input" type="number" min="0" step="0.01" value={newDebtAmount} onChange={(e) => setNewDebtAmount(e.target.value)} placeholder="Owed" />
                  <button type="submit" className="btn btn-primary">Add debt</button>
                </form>
              </div>
              <div className="finance-total-row debt">
                <span className="finance-total-label">Total debt</span>
                <span className="finance-total-value debt-total">${(finance.totalDebt || 0).toFixed(2)}</span>
              </div>
              <div className="finance-total-row finance-total-row-ratio">
                <span className="finance-total-label">Debt / Savings ratio</span>
                <span className="finance-total-value ratio">
                  {(() => {
                    const s = finance.totalSavings || 0;
                    const d = finance.totalDebt || 0;
                    if (s <= 0) return d > 0 ? "n/a" : "0%";
                    return `${(Math.round((d / s) * 100))}%`;
                  })()}
                </span>
              </div>
              <div className="finance-total-row investments">
                <span className="finance-total-label">Investments</span>
                <input
                  className="input finance-investments-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={finance.totalInvestments === 0 ? "" : finance.totalInvestments}
                  onChange={(e) => setFinance((prev) => ({ ...prev, totalInvestments: parseFloat(e.target.value) || 0 }))}
                  onBlur={(e) => setFinance((prev) => ({ ...prev, totalInvestments: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                />
              </div>
              <div className="finance-total-row finance-total-row-total">
                <span className="finance-total-label">Liquid (savings − debt)</span>
                <span className="finance-total-value total">
                  ${((finance.totalSavings || 0) - (finance.totalDebt || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="finance-section">
              <h3 className="finance-section-title">Credit score log</h3>
              <p className="finance-hint">Optional - add when you check your score so Coach and trends stay grounded.</p>
              <form
                className="finance-inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  addCreditScoreEntry();
                }}
              >
                <input
                  className="input"
                  type="number"
                  min="300"
                  max="900"
                  value={newCreditScore}
                  onChange={(e) => setNewCreditScore(e.target.value)}
                  placeholder="Score"
                  style={{ width: 100 }}
                  aria-label="Credit score"
                />
                <input className="input" type="date" value={newCreditDate} onChange={(e) => setNewCreditDate(e.target.value)} aria-label="As of date" style={{ width: 150 }} />
                <button type="submit" className="btn btn-primary">
                  Save entry
                </button>
              </form>
              <ul className="finance-list">
                {(finance.creditScoreEntries || []).length === 0 && <li className="finance-list-empty">No scores logged yet.</li>}
                {(finance.creditScoreEntries || []).map((e) => (
                  <li key={e.id} className="finance-list-item">
                    <span className="finance-label">{String(e.dateISO || "").slice(0, 10)}</span>
                    <span className="finance-amount">{e.score}</span>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setFinance((prev) => ({
                        ...prev,
                        creditScoreEntries: (prev.creditScoreEntries || []).filter((x) => x.id !== e.id),
                      }))}
                      aria-label="Remove credit entry"
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="finance-section">
              <h3 className="finance-section-title">Recent income</h3>
              <ul className="finance-list">
                {(finance.incomeEntries || []).slice(0, 15).map((e) => (
                  <li key={e.id} className="finance-list-item income">
                    <span className="finance-meta finance-entry-date">{String(e.dateISO || "").slice(0, 10)}</span>
                    {e.label && <span className="finance-label">{e.label}</span>}
                    <span className="finance-amount">+${Number(e.amount).toFixed(2)}</span>
                    <button type="button" className="icon-btn" onClick={() => removeFinanceEntry("income", e.id)} aria-label="Remove"><TrashIcon /></button>
                  </li>
                ))}
                {(finance.incomeEntries || []).length === 0 && <li className="finance-list-empty">No income logged yet. Try +500</li>}
              </ul>
            </div>

            <div className="finance-section">
              <h3 className="finance-section-title">Recent spending</h3>
              <ul className="finance-list">
                {(finance.expenseEntries || []).slice(0, 15).map((e) => (
                  <li key={e.id} className="finance-list-item expense">
                    <span className="finance-meta finance-entry-date">{String(e.dateISO || "").slice(0, 10)}</span>
                    {e.label && <span className="finance-label">{e.label}</span>}
                    <span className="finance-amount">-${Number(e.amount).toFixed(2)}</span>
                    <button type="button" className="icon-btn" onClick={() => removeFinanceEntry("expense", e.id)} aria-label="Remove"><TrashIcon /></button>
                  </li>
                ))}
                {(finance.expenseEntries || []).length === 0 && <li className="finance-list-empty">No spending logged yet. Try -200 or &quot;50 coffee&quot;</li>}
              </ul>
            </div>

            <div className="finance-section">
              <h3 className="finance-section-title">Subscriptions</h3>
              <p className="finance-hint">Add a due day (1-31) to show &quot;Pay [name]&quot; on your schedule that day each month.</p>
              <form className="finance-inline-form" onSubmit={(e) => {
                e.preventDefault();
                if (newSubName.trim()) {
                  const dueDay = newSubDueDay.trim() ? parseInt(newSubDueDay, 10) : null;
                  addSubscription(newSubName.trim(), newSubAmount || 0, newSubCycle, dueDay);
                  setNewSubName("");
                  setNewSubAmount("");
                  setNewSubDueDay("");
                }
              }}>
                <input className="input" value={newSubName} onChange={(e) => setNewSubName(e.target.value)} placeholder="Netflix, gym…" />
                <input className="input" type="number" min="0" step="0.01" value={newSubAmount} onChange={(e) => setNewSubAmount(e.target.value)} placeholder="Amount" style={{ width: 90 }} />
                <select className="input" value={newSubCycle} onChange={(e) => setNewSubCycle(e.target.value)} style={{ width: 100 }}>
                  <option value="monthly">/mo</option>
                  <option value="yearly">/yr</option>
                </select>
                <input className="input" type="number" min="1" max="31" value={newSubDueDay} onChange={(e) => setNewSubDueDay(e.target.value)} placeholder="Due day (1-31)" style={{ width: 110 }} title="Day of month it’s due; adds to schedule that day" />
                <button type="submit" className="btn btn-primary">Add</button>
              </form>
              <ul className="finance-list">
                {(finance.subscriptions || []).map((s) => (
                  <li key={s.id} className="finance-list-item">
                    <span className="finance-label">{s.name}</span>
                    <span className="finance-amount">${Number(s.amount).toFixed(2)}/{s.cycle === "yearly" ? "yr" : "mo"}</span>
                    {s.dueDay != null && <span className="finance-meta">Due day {s.dueDay}</span>}
                    <button type="button" className="icon-btn" onClick={() => removeSubscription(s.id)} aria-label="Remove"><TrashIcon /></button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="finance-section">
              <h3 className="finance-section-title">Bills</h3>
              <p className="finance-hint">Add due date to get a reminder that day.</p>
              <form className="finance-inline-form" onSubmit={(e) => {
                e.preventDefault();
                if (newBillName.trim() && newBillDueDate.trim()) {
                  addBill(newBillName.trim(), newBillAmount || 0, newBillDueDate.trim());
                  setNewBillName("");
                  setNewBillAmount("");
                  setNewBillDueDate("");
                }
              }}>
                <input className="input" value={newBillName} onChange={(e) => setNewBillName(e.target.value)} placeholder="Bill name" />
                <input className="input" type="number" min="0" step="0.01" value={newBillAmount} onChange={(e) => setNewBillAmount(e.target.value)} placeholder="Amount" style={{ width: 90 }} />
                <input className="input" type="date" value={newBillDueDate} onChange={(e) => setNewBillDueDate(e.target.value)} aria-label="Due date" style={{ width: 140 }} />
                <button type="submit" className="btn btn-primary">Add</button>
              </form>
              <ul className="finance-list">
                {(finance.bills || []).map((b) => (
                  <li key={b.id} className="finance-list-item finance-bill-row">
                    <span className="finance-label">{b.name}</span>
                    {b.amount > 0 && <span className="finance-amount">${Number(b.amount).toFixed(2)}</span>}
                    {b.dueDate && <span className="finance-meta">Due {b.dueDate}</span>}
                    <div className="finance-bill-actions">
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => handleMarkBillPaid(b.id)}>
                        Mark paid
                      </button>
                      <button type="button" className="icon-btn" onClick={() => removeBill(b.id)} aria-label="Remove">
                        <TrashIcon />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="finance-section">
              <h3 className="finance-section-title">Wish list</h3>
              <form className="finance-inline-form" onSubmit={(e) => {
                e.preventDefault();
                if (newWishLabel.trim()) {
                  addWishItem(newWishLabel.trim(), newWishTarget || null);
                  setNewWishLabel("");
                  setNewWishTarget("");
                }
              }}>
                <input className="input" value={newWishLabel} onChange={(e) => setNewWishLabel(e.target.value)} placeholder="What to save for?" />
                <input className="input" type="number" min="0" step="0.01" value={newWishTarget} onChange={(e) => setNewWishTarget(e.target.value)} placeholder="Target $" style={{ width: 100 }} />
                <button type="submit" className="btn btn-primary">Add</button>
              </form>
              <ul className="finance-list">
                {(finance.wishList || []).map((w) => (
                  <li key={w.id} className="finance-list-item">
                    <span className="finance-label">{w.label}</span>
                    {w.targetAmount != null && <span className="finance-meta">Goal ${Number(w.targetAmount).toFixed(2)}</span>}
                    <button type="button" className="icon-btn" onClick={() => removeWishItem(w.id)} aria-label="Remove"><TrashIcon /></button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="finance-section">
              <h3 className="finance-section-title">Bank / statement notes</h3>
              <p className="finance-hint">Paste or type notes from statements. Coach uses this to spot patterns and suggest what to work on.</p>
              <textarea
                className="input finance-notes-textarea"
                value={finance.bankStatementNotes}
                onChange={(e) => setFinance((prev) => ({ ...prev, bankStatementNotes: e.target.value }))}
                placeholder="e.g. Biggest charges this month: Amazon 120, dining 80…"
                rows={4}
              />
            </div>

            {(() => {
              const overviews = finance.monthOverviews || [];
              const latest = overviews[0];
              const now = new Date();
              const spentThisMonth = (finance.expenseEntries || []).reduce((sum, e) => {
                const d = new Date(e.dateISO);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() ? sum + (Number(e.amount) || 0) : sum;
              }, 0);
              const incomeThisMonth = (finance.incomeEntries || []).reduce((sum, e) => {
                const d = new Date(e.dateISO);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() ? sum + (Number(e.amount) || 0) : sum;
              }, 0);
              const avgSpend = averageOverArchivedMonths(overviews, "expenseTotal");
              const avgIncome = averageOverArchivedMonths(overviews, "incomeTotal");
              const topAvg = aggregateTopExpensesAcrossMonths(overviews, 4);
              const decals = financeDecalForCurrentMonth({
                spentThisMonth,
                incomeThisMonth,
                overviews,
              });
              return (
                <div className="finance-section surface-glass" style={{ padding: 12, marginTop: 12 }}>
                  <h3 className="finance-section-title">Month summaries &amp; pace</h3>
                  <p className="finance-hint">
                    When the calendar month advances, last month&apos;s logged income and spending lines roll into a saved overview so the top of Finance stays about the current month.
                  </p>
                  {latest ? (
                    <div style={{ marginTop: 10 }}>
                      <div className="finance-total-row">
                        <span className="finance-total-label">Most recent overview ({latest.monthKey})</span>
                        <span className="finance-total-value net">${Number(latest.net || 0).toFixed(2)} net</span>
                      </div>
                      <p className="settings-hint" style={{ marginTop: 4, marginBottom: 0 }}>
                        Income ${Number(latest.incomeTotal || 0).toFixed(2)} · Spent ${Number(latest.expenseTotal || 0).toFixed(2)}
                        {latest.topExpenses && latest.topExpenses[0]
                          ? ` · Top: ${latest.topExpenses[0].label} $${Number(latest.topExpenses[0].amount || 0).toFixed(2)}`
                          : ""}
                      </p>
                    </div>
                  ) : (
                    <p className="settings-hint" style={{ marginTop: 8 }}>
                      No closed months yet - keep logging; summaries appear after your first month rollover.
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ marginTop: 10 }}
                    disabled={overviews.length === 0}
                    onClick={() => setFinanceOverviewsOpen(true)}
                  >
                    See all overviews
                  </button>
                  {overviews.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div className="finance-total-row">
                        <span className="finance-total-label">Avg spent (archived months)</span>
                        <span className="finance-total-value expense">
                          {avgSpend != null ? `$${avgSpend.toFixed(2)}` : "-"}
                        </span>
                      </div>
                      <div className="finance-total-row">
                        <span className="finance-total-label">Avg income (archived months)</span>
                        <span className="finance-total-value income">
                          {avgIncome != null ? `$${avgIncome.toFixed(2)}` : "-"}
                        </span>
                      </div>
                      {topAvg.length > 0 && (
                        <p className="settings-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                          Biggest spend labels on average:{" "}
                          {topAvg.map((x) => `${x.label} ~$${x.avg.toFixed(0)}`).join(" · ")}
                        </p>
                      )}
                      {decals.map((line, i) => (
                        <p key={i} className="settings-hint" style={{ marginTop: 8, fontStyle: "italic", marginBottom: 0 }}>
                          {line}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="finance-coach-cta">
              <button type="button" className="btn btn-primary" onClick={() => setTab("coach")}>
                <SparkleIcon style={{ width: 18, height: 18, marginRight: 8 }} />
                Ask Coach about my money
              </button>
            </div>
          </section>
        ) : tab === "notes" ? (
          <section className="panel notes-section scroll-reveal">
            <div className="panel-top">
              <div className="panel-title">
                <div className="meta">Jot down thoughts, ideas, and reminders</div>
              </div>
            </div>

            <div className="notes-search-wrap">
              <div className="notes-search">
                <input
                  className="input"
                  type="text"
                  value={noteSearch}
                  onChange={(e) => setNoteSearch(e.target.value)}
                  placeholder="Search notes..."
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={noteSearch.trim() ? true : false}
                  aria-controls="notes-search-dropdown"
                />
              </div>
              {noteSearch.trim() !== "" && (
                <div id="notes-search-dropdown" className="notes-search-dropdown" role="listbox" aria-label="Matching notes">
                  {noteSearchDropdownItems.length === 0 ? (
                    <div className="notes-search-dropdown-empty">No matching notes</div>
                  ) : (
                    noteSearchDropdownItems.map((note) => (
                      <button
                        key={note.id}
                        type="button"
                        role="option"
                        className="notes-search-dropdown-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setNoteSearch("");
                          window.setTimeout(() => {
                            document.querySelector(`[data-note-id="${note.id}"]`)?.scrollIntoView({
                              behavior: "smooth",
                              block: "nearest",
                            });
                          }, 0);
                        }}
                      >
                        {note.text.length > 120 ? `${note.text.slice(0, 120)}…` : note.text}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <form className="notes-add-form monthly-add notes-add-bar" onSubmit={addNote}>
              <textarea
                ref={newNoteTextareaRef}
                className="input notes-add-textarea"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note or idea…"
                aria-label="New note"
                rows={2}
              />
              <button className="btn btn-primary notes-add-submit" type="submit">Add</button>
            </form>

            {filteredNotes.length === 0 ? (
              <div className="empty">
                {noteSearch ? "No notes match your search." : "Add your first note or idea."}
              </div>
            ) : (
              <ul className="list list-page-list notes-list-page">
                {filteredNotes.map((note) => (
                  <li key={note.id} className="list-row note-list-row" data-note-id={note.id}>
                    {editingNoteId === note.id ? (
                      <div className="note-edit-row list-row-edit-row">
                        <input
                          className="input"
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { editNote(note.id, editingNoteText.trim()); setEditingNoteId(null); setEditingNoteText(""); } if (e.key === "Escape") { setEditingNoteId(null); setEditingNoteText(""); } }}
                          autoFocus
                        />
                        <div className="list-row-edit-actions">
                          <button type="button" className="btn btn-sm btn-primary" onClick={() => { editNote(note.id, editingNoteText.trim()); setEditingNoteId(null); setEditingNoteText(""); }}>Save</button>
                          <button type="button" className="btn btn-sm" onClick={() => { setEditingNoteId(null); setEditingNoteText(""); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="list-row-body note-list-row-body">
                        <div className="note-list-text-block">
                          <span className="note-date note-list-date">
                            {new Date(note.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                          <span className="list-row-title note-list-text">{note.text}</span>
                        </div>
                        <div className="list-row-actions">
                          <button
                            type="button"
                            className="icon-btn list-row-action list-row-more"
                            title="Note options"
                            aria-label="Note options"
                            data-list-menu-trigger
                            onClick={(e) => {
                              e.stopPropagation();
                              const anchorEl = e.currentTarget;
                              if (!anchorEl) return;
                              const rect = anchorEl.getBoundingClientRect();
                              dismissTaskDropdownOnly();
                              setSecondaryListMenu((prev) =>
                                prev?.kind === "note" && prev.id === note.id ? null : { kind: "note", id: note.id, rect }
                              );
                            }}
                          >
                            <MenuIcon style={{ width: 18, height: 18 }} />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        </main>
        <aside className="shell-rail" aria-hidden="true" />

        {taskDropdown && dropdownAnchorRect && ReactDOM.createPortal(
          (() => {
            const parts = taskDropdown.split('-');
            const hourKey = parts[0];
            const category = parts[1];
            const id = parts.slice(2).join('-') || parts[2];
            const editKey = `${hourKey}-${category}-${id}`;
            const isEditing = editingTaskTime === editKey;
            const closeDropdown = () => handleTaskMenuOpen(null, null);
            const dropdownMaxHeight = isEditing ? 340 : 440;
            const vv = typeof window !== "undefined" ? window.visualViewport : null;
            const vwForPanel =
              typeof window !== "undefined"
                ? Math.min(vv?.width ?? window.innerWidth, window.innerWidth)
                : 400;
            /** Edit time: native `input[type=time]` is wide on iOS — width must match computeDropdown margins (vw − 32). */
            const panelWidth = isEditing
              ? Math.max(240, Math.min(400, vwForPanel - 32))
              : Math.max(220, Math.min(300, vwForPanel - 24));
            const taskNodeForMenu = findTaskInAppState(appState, tKey, hourKey, category, id);
            const showOptionalRepeatBtn =
              taskNodeForMenu && (taskNodeForMenu.repeat ?? REPEAT_OPTIONS.NONE) === REPEAT_OPTIONS.NONE;
            const rect = dropdownAnchorRect;
            const { left, top, width } = computeDropdownPosition(rect, {
              panelWidth,
              maxHeight: dropdownMaxHeight,
              /** Avoid horizontal nudge for wide edit-time panel so `left + width` stays inside the viewport. */
              leftNudge: isEditing ? 0 : undefined,
            });
            return (
              <div
                className={["task-dropdown-portal", isEditing ? "task-dropdown-portal--edit-time" : ""]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  position: 'fixed',
                  left,
                  top,
                  width,
                  maxWidth:
                    "min(100vw - 32px, calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px) - 16px))",
                  zIndex: 'var(--z-popover)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="task-dropdown">
                  {isEditing ? (
                    <div className="dropdown-edit-time">
                      <label className="dropdown-edit-time-label">New time</label>
                      <div className="dropdown-time-input-wrap">
                        <input
                          type="time"
                          className="input dropdown-time-input"
                          value={editTaskTimeValue}
                          onChange={(e) => setEditTaskTimeValue(e.target.value)}
                          aria-label="Task time"
                        />
                      </div>
                      <div className="dropdown-edit-time-actions">
                        <button type="button" className="dropdown-item" onClick={() => { flushTaskMenuNoteForKeyRef.current(taskDropdown); changeTaskTime(hourKey, category, id, editTaskTimeValue); setEditingTaskTime(null); }}>
                          Save
                        </button>
                        <button type="button" className="dropdown-item" onClick={() => { setEditingTaskTime(null); closeDropdown(); }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="task-dropdown-note-section">
                        <label className="task-dropdown-section-label" htmlFor="task-menu-note">
                          Notes (this task)
                        </label>
                        <textarea
                          id="task-menu-note"
                          className="input task-dropdown-note-input"
                          rows={3}
                          value={taskMenuNoteDraft}
                          onChange={(e) => setTaskMenuNoteDraft(e.target.value)}
                          onBlur={() => patchTaskFields(tKey, hourKey, category, id, { taskNote: taskMenuNoteDraft.trim() })}
                          placeholder="Private note for this task…"
                          aria-label="Notes for this task"
                        />
                        {showOptionalRepeatBtn ? (
                          <button
                            type="button"
                            className="btn btn-sm task-dropdown-repeat-btn"
                            onClick={() => {
                              ensureTaskOptionalRepeat(tKey, hourKey, category, id);
                            }}
                          >
                            <RepeatIcon style={{ width: 14, height: 14, marginRight: 6, verticalAlign: "middle" }} />
                            Add to Past tasks (optional repeat)
                          </button>
                        ) : taskNodeForMenu && (taskNodeForMenu.repeat ?? REPEAT_OPTIONS.NONE) === REPEAT_OPTIONS.OPTIONAL ? (
                          <p className="task-dropdown-repeat-hint">Saved for Past tasks</p>
                        ) : null}
                      </div>
                      <div className="task-dropdown-actions-block">
                        <button type="button" className="dropdown-item task-dropdown-move-item" onClick={() => { moveTaskToTomorrow(hourKey, category, id); closeDropdown(); }}>
                          <CalendarIcon style={{ marginRight: '8px' }} />
                          Move to tomorrow
                        </button>
                        {(() => {
                          const taskNode = findTaskInAppState(appState, tKey, hourKey, category, id);
                          return taskNode && groceryTextMatch(taskNode.text) ? (
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => {
                                setGroceryListModal({ dayKey: tKey, hourKey, category, taskId: id });
                                closeDropdown();
                              }}
                            >
                              Shopping / errand list
                            </button>
                          ) : null;
                        })()}
                        <button
                          type="button"
                          className="dropdown-item"
                          onClick={() => {
                            appendNoteFromTask(hourKey, category, id);
                            closeDropdown();
                          }}
                        >
                          Add to Notes
                        </button>
                        <button
                          type="button"
                          className="dropdown-item"
                          onClick={() => {
                            flushTaskMenuNoteForKeyRef.current(taskDropdown);
                            setEditTaskTimeValue(hourKey);
                            setEditingTaskTime(editKey);
                          }}
                        >
                          Edit time
                        </button>
                        <button type="button" className="dropdown-item" onClick={() => { closeDropdown(); }}>
                          Keep task
                        </button>
                        <button
                          type="button"
                          className="dropdown-item dropdown-item-danger"
                          onClick={() => {
                            flushTaskMenuNoteForKeyRef.current(taskDropdown);
                            deleteTask(hourKey, category, id);
                            closeDropdown();
                          }}
                        >
                          <TrashIcon style={{ width: 16, height: 16, marginRight: 8, verticalAlign: "middle" }} />
                          Delete task
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })(),
          document.body
        )}

        {secondaryListMenu?.rect && ReactDOM.createPortal(
          (() => {
            const rect = secondaryListMenu.rect;
            const dropdownMaxHeight = 220;
            const panelWidth = 216;
            const { left, top, width } = computeDropdownPosition(rect, { panelWidth, maxHeight: dropdownMaxHeight });
            const closeSecondary = () => setSecondaryListMenu(null);
            return (
              <div
                className="task-dropdown-portal"
                style={{
                  position: "fixed",
                  left,
                  top,
                  width,
                  maxWidth:
                    "min(100vw - 32px, calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px) - 16px))",
                  zIndex: "var(--z-popover)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="task-dropdown">
                  {secondaryListMenu.kind === "monthly" && (
                    <>
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() => {
                          const row = appState.monthly.find((x) => x.id === secondaryListMenu.id);
                          if (row) {
                            setEditingMonthlyId(row.id);
                            setEditingMonthlyText(row.text);
                          }
                          closeSecondary();
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="dropdown-item dropdown-item-danger"
                        onClick={() => {
                          deleteMonthly(secondaryListMenu.id);
                          closeSecondary();
                        }}
                      >
                        <TrashIcon style={{ width: 16, height: 16, marginRight: 8, verticalAlign: "middle" }} />
                        Delete
                      </button>
                    </>
                  )}
                  {secondaryListMenu.kind === "note" && (
                    <>
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() => {
                          const n = notes.find((x) => x.id === secondaryListMenu.id);
                          if (n) {
                            setEditingNoteId(n.id);
                            setEditingNoteText(n.text);
                          }
                          closeSecondary();
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="dropdown-item dropdown-item-danger"
                        onClick={() => {
                          deleteNote(secondaryListMenu.id);
                          closeSecondary();
                        }}
                      >
                        <TrashIcon style={{ width: 16, height: 16, marginRight: 8, verticalAlign: "middle" }} />
                        Delete
                      </button>
                    </>
                  )}
                  {secondaryListMenu.kind === "grocery" && (
                    <button
                      type="button"
                      className="dropdown-item dropdown-item-danger"
                      onClick={() => {
                        const { dayKey, hourKey, category, taskId, itemId } = secondaryListMenu;
                        updateTaskGroceryList(dayKey, hourKey, category, taskId, (gl) => ({
                          ...gl,
                          items: gl.items.filter((x) => x.id !== itemId),
                        }));
                        closeSecondary();
                      }}
                    >
                      <TrashIcon style={{ width: 16, height: 16, marginRight: 8, verticalAlign: "middle" }} />
                      Remove line
                    </button>
                  )}
                </div>
              </div>
            );
          })(),
          document.body
        )}

        <WorkoutProgramPickerModal
          open={!!workoutProgramPicker}
          taskPreview={workoutProgramPicker?.text || ""}
          programs={listSelectablePrograms(health)}
          onCancel={() => setWorkoutProgramPicker(null)}
          onConfirm={confirmWorkoutProgramPick}
        />

        {groceryListPrompt && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="grocery-prompt-title" onClick={() => setGroceryListPrompt(null)}>
            <div className="modal grocery-prompt-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <h3 id="grocery-prompt-title">Shopping or errand list?</h3>
              <p className="settings-hint">
                If a task matches your list keywords (defaults include <strong>grocery</strong> and <strong>store</strong>), you can attach a checklist. Edit keywords under{" "}
                <strong>Settings → Customization</strong>. The list saves on the task and syncs with your schedule.
              </p>
              <p className="settings-hint" style={{ marginTop: 6 }}>
                Keywords: <strong>{groceryKeywordsNorm.join(", ")}</strong>
              </p>
              {(profile.grocerySavedLists || []).length > 0 && (
                <>
                  <label className="label" style={{ marginTop: 12, display: "block" }}>
                    Start from a saved list
                  </label>
                  <select
                    className="input modal-input"
                    style={{ marginTop: 6 }}
                    value={groceryLoadListId}
                    onChange={(e) => setGroceryLoadListId(e.target.value)}
                    aria-label="Saved checklist"
                  >
                    <option value="">- Pick a saved list -</option>
                    {(profile.grocerySavedLists || []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setGroceryListModal({ ...groceryListPrompt });
                    setGroceryListPrompt(null);
                    setGroceryLoadListId("");
                  }}
                >
                  Open list
                </button>
                {groceryLoadListId ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      const list = (profile.grocerySavedLists || []).find((x) => x.id === groceryLoadListId);
                      if (!list) return;
                      const mapped = list.items.map((it) => ({ id: uid(), text: it.text, done: false }));
                      updateTaskGroceryList(
                        groceryListPrompt.dayKey,
                        groceryListPrompt.hourKey,
                        groceryListPrompt.category,
                        groceryListPrompt.taskId,
                        (gl) => ({ ...gl, items: mapped })
                      );
                      setGroceryListModal({ ...groceryListPrompt });
                      setGroceryListPrompt(null);
                      setGroceryLoadListId("");
                    }}
                  >
                    Apply saved &amp; open
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setGroceryListPrompt(null);
                    setGroceryLoadListId("");
                  }}
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        )}

        {groceryListModal && (() => {
          const { dayKey, hourKey, category, taskId } = groceryListModal;
          const task = findTaskInAppState(appState, dayKey, hourKey, category, taskId);
          if (!task) {
            return (
              <div className="modal-overlay" onClick={() => setGroceryListModal(null)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <p>That task is no longer here.</p>
                  <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setGroceryListModal(null)}>
                    Close
                  </button>
                </div>
              </div>
            );
          }
          const items = task.groceryList?.items && Array.isArray(task.groceryList.items) ? task.groceryList.items : [];
          return (
            <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="grocery-modal-title" onClick={() => setGroceryListModal(null)}>
              <div className="modal grocery-list-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <h3 id="grocery-modal-title" style={{ margin: 0 }}>
                    Checklist
                  </h3>
                  <button type="button" className="btn-icon" aria-label="Close" onClick={() => setGroceryListModal(null)}>
                    <CloseIcon style={{ width: 22, height: 22 }} />
                  </button>
                </div>
                <p className="settings-hint" style={{ marginTop: 8 }}>
                  {task.text}
                </p>
                <ul className="grocery-modal-items">
                  {items.length === 0 ? (
                    <li className="settings-hint grocery-checklist-empty" style={{ listStyle: "none", padding: "8px 0" }}>
                      No lines yet. Add below.
                    </li>
                  ) : (
                    items.map((it) => (
                      <li key={it.id} className="grocery-modal-item grocery-checklist-row">
                        <div className="list-row-body grocery-checklist-row-body">
                          <label className="list-row-main check grocery-checklist-check" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={!!it.done}
                              onChange={() =>
                                updateTaskGroceryList(dayKey, hourKey, category, taskId, (gl) => ({
                                  ...gl,
                                  items: gl.items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)),
                                }))
                              }
                            />
                            <span className="checkmark" />
                            <span className={`list-row-title grocery-checklist-text ${it.done ? "item-text-done" : ""}`}>{it.text}</span>
                          </label>
                          <div className="list-row-actions">
                            <button
                              type="button"
                              className="icon-btn list-row-action list-row-more"
                              title="Line options"
                              aria-label="Checklist line options"
                              data-list-menu-trigger
                              onClick={(e) => {
                                e.stopPropagation();
                                const anchorEl = e.currentTarget;
                                if (!anchorEl) return;
                                const rect = anchorEl.getBoundingClientRect();
                                dismissTaskDropdownOnly();
                                setSecondaryListMenu((prev) =>
                                  prev?.kind === "grocery" && prev.itemId === it.id
                                    ? null
                                    : {
                                        kind: "grocery",
                                        dayKey,
                                        hourKey,
                                        category,
                                        taskId,
                                        itemId: it.id,
                                        rect,
                                      }
                                );
                              }}
                            >
                              <MenuIcon style={{ width: 18, height: 18 }} />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
                <form
                  className="input-group grocery-add-row"
                  style={{ marginTop: 12 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const line = normalizeText(groceryNewItem);
                    if (!line) return;
                    updateTaskGroceryList(dayKey, hourKey, category, taskId, (gl) => ({
                      ...gl,
                      items: [...gl.items, { id: uid(), text: line, done: false }],
                    }));
                    setGroceryNewItem("");
                  }}
                >
                  <input
                    className="input"
                    value={groceryNewItem}
                    onChange={(e) => setGroceryNewItem(e.target.value)}
                    placeholder="Add item…"
                    aria-label="Add checklist line"
                  />
                  <button type="submit" className="btn btn-primary" disabled={!groceryNewItem.trim()}>
                    Add
                  </button>
                </form>
                <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      const title = window.prompt("Name this checklist for reuse", String(task.text || "").slice(0, 48));
                      if (!title || !String(title).trim()) return;
                      const toSave = items.map((it) => ({ id: uid(), text: String(it.text || "").trim(), done: false })).filter((it) => it.text);
                      if (toSave.length === 0) {
                        window.alert("Add at least one line before saving.");
                        return;
                      }
                      setProfile((p) => ({
                        ...p,
                        grocerySavedLists: [
                          { id: uid(), title: String(title).trim(), savedAt: new Date().toISOString(), items: toSave },
                          ...(p.grocerySavedLists || []),
                        ].slice(0, 40),
                      }));
                    }}
                  >
                    Save as reusable list
                  </button>
                  {(profile.grocerySavedLists || []).length > 0 && (
                    <>
                      <select
                        className="input"
                        style={{ minWidth: 160 }}
                        value={groceryLoadListId}
                        onChange={(e) => setGroceryLoadListId(e.target.value)}
                        aria-label="Replace with saved list"
                      >
                        <option value="">Load saved…</option>
                        {(profile.grocerySavedLists || []).map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.title}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={!groceryLoadListId}
                        onClick={() => {
                          const list = (profile.grocerySavedLists || []).find((x) => x.id === groceryLoadListId);
                          if (!list) return;
                          updateTaskGroceryList(dayKey, hourKey, category, taskId, (gl) => ({
                            ...gl,
                            items: list.items.map((it) => ({ id: uid(), text: it.text, done: false })),
                          }));
                          setGroceryLoadListId("");
                        }}
                      >
                        Replace lines
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {financeOverviewsOpen && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="fin-over-title" onClick={() => setFinanceOverviewsOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h3 id="fin-over-title" style={{ margin: 0 }}>
                  Month overviews
                </h3>
                <button type="button" className="btn-icon" aria-label="Close" onClick={() => setFinanceOverviewsOpen(false)}>
                  <CloseIcon style={{ width: 22, height: 22 }} />
                </button>
              </div>
              <ul className="finance-list" style={{ marginTop: 12 }}>
                {(finance.monthOverviews || []).length === 0 && <li className="finance-list-empty">No archived months yet.</li>}
                {(finance.monthOverviews || []).map((o) => (
                  <li key={o.monthKey + (o.archivedAt || "")} className="finance-list-item">
                    <span className="finance-label">{o.monthKey}</span>
                    <span className="finance-meta">Net ${Number(o.net || 0).toFixed(2)}</span>
                    <span className="finance-amount" style={{ fontSize: "0.85rem" }}>
                      in {Number(o.incomeTotal || 0).toFixed(0)} / out {Number(o.expenseTotal || 0).toFixed(0)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {showMonthCalendar && (
          <div className="modal-overlay" onClick={() => setShowMonthCalendar(false)} aria-modal="true" role="dialog" aria-label="Calendar">
            <div className="modal calendar-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="calendar-sheet-header">
                <h3 className="calendar-sheet-title">Calendar</h3>
                <button type="button" className="btn-icon" onClick={() => setShowMonthCalendar(false)} aria-label="Close calendar">
                  <CloseIcon style={{ width: 22, height: 22 }} />
                </button>
              </div>
              <div className="panel month-calendar-wrap">
                <MonthCalendar
                  days={appState.days || {}}
                  year={monthCalendarMonth.year}
                  month={monthCalendarMonth.month}
                  categories={customCategories}
                  onSelectDay={(dayKey) => {
                    setSelectedDayKey(dayKey);
                    setShowMonthCalendar(false);
                  }}
                  onBack={() => setShowMonthCalendar(false)}
                  onPrevMonth={() => setMonthCalendarMonth((prev) => {
                    const d = new Date(prev.year, prev.month - 1, 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })}
                  onNextMonth={() => setMonthCalendarMonth((prev) => {
                    const d = new Date(prev.year, prev.month + 1, 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })}
                />
              </div>
            </div>
          </div>
        )}

        {showSettings && (
          <div
            className="modal-overlay"
            onClick={() => {
              setShowPrivacyPolicy(false);
              setSettingsSubView("main");
              setShowSettings(false);
            }}
          >
            <div className="modal settings-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="settings-modal-title">
              <div className="settings-modal-header">
                {settingsSubView === "notifications" ? (
                  <button
                    type="button"
                    className="btn-icon settings-modal-close settings-modal-close-left"
                    onClick={() => setSettingsSubView("main")}
                    aria-label="Back to settings"
                  >
                    <ChevronLeftIcon style={{ width: 22, height: 22 }} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-icon settings-modal-close settings-modal-close-left"
                    onClick={() => {
                      setShowPrivacyPolicy(false);
                      setSettingsSubView("main");
                      setShowSettings(false);
                    }}
                    aria-label="Close settings"
                  >
                    <CloseIcon style={{ width: 22, height: 22 }} />
                  </button>
                )}
                <h3 id="settings-modal-title" className="settings-modal-title">
                  {settingsSubView === "notifications" ? "Notifications" : "Settings"}
                </h3>
                <span className="settings-modal-header-spacer" aria-hidden="true" />
              </div>

              <div className="settings-modal-body">
              {settingsSubView === "notifications" ? (
              <div className="settings-notifications-subview">
              {isCapacitorNativeApp() ? (
                <div className="settings-section">
                  <label className="label">Notifications</label>
                  <div className="settings-push-actions" style={{ flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={async () => {
                        try {
                          if (Capacitor.getPlatform() === "ios") {
                            await resyncIosTaskLocalNotifications(appState.days, realTodayKey, customCategories, profile);
                          }
                          await notificationService.requestPermission();
                          await refreshNativeNotificationDiagnostics();
                          const pushResult = await notificationService.enablePush();
                          if (pushResult?.ok) {
                            await notificationService.syncRemindersToServer(pushRemindersList);
                          }
                          await refreshNativeNotificationDiagnostics();
                          let localGranted = true;
                          if (Capacitor.getPlatform() === "ios") {
                            try {
                              const lp = await LocalNotifications.checkPermissions();
                              localGranted = lp.display === "granted";
                            } catch {
                              localGranted = false;
                            }
                          }
                          const remoteOk = !!pushResult?.ok;
                          let msg = "";
                          if (Capacitor.getPlatform() === "ios") {
                            if (localGranted && remoteOk) {
                              msg =
                                "Task reminders are scheduled for the next several days, and remote alerts are connected. Turn on Remind me on each task you want alerts for.";
                            } else if (localGranted) {
                              msg = `Task reminders are scheduled. Remote alerts: ${pushResult?.hint || "could not finish — check connection or try again."}`;
                            } else if (remoteOk) {
                              msg =
                                "Remote alerts are on. For on-device task times, allow Notifications for this app in system settings, then tap this button again.";
                            } else {
                              msg =
                                (pushResult?.hint || "Setup did not finish.") +
                                " If alerts are missing, enable Notifications for this app in system settings.";
                            }
                          } else {
                            msg = remoteOk
                              ? "Notifications are on and your reminder list is synced."
                              : pushResult?.hint || "Could not enable remote notifications.";
                          }
                          alert(msg);
                        } catch (e) {
                          alert(e?.message || String(e));
                        }
                      }}
                    >
                      {notificationService.permission === "granted" ? (
                        <>
                          <CheckIcon style={{ width: 16, height: 16, marginRight: 6, verticalAlign: "middle" }} />
                          Allow notifications and sync reminders
                        </>
                      ) : (
                        "Allow notifications and sync reminders"
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={async () => {
                        const r = await notificationService.openNativeNotificationSettings();
                        if (!r?.ok) alert(r?.hint || "Could not open Settings.");
                      }}
                    >
                      Open system settings
                    </button>
                  </div>
                </div>
              ) : (
                <div className="settings-section">
                  <label className="label">Notifications</label>
                  <div className="settings-push-actions" style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={async () => {
                        const granted = await notificationService.requestPermission();
                        if (!granted) {
                          alert("Please enable notifications in your browser settings to receive task reminders.");
                          return;
                        }
                        const result = await notificationService.enablePush();
                        if (result?.ok) {
                          await notificationService.syncRemindersToServer(pushRemindersList);
                          alert(
                            "Notifications and background reminders are set up. You can get task reminders and gentle nudges when this tab is open or in the background (when your site supports push)."
                          );
                        } else {
                          alert(
                            result?.hint ||
                              "Browser notifications are on, but background reminders could not connect. You may still get reminders while this tab is open."
                          );
                        }
                      }}
                    >
                      {notificationService.permission === "granted" ? (
                        <>
                          <CheckIcon style={{ width: 16, height: 16, marginRight: 6, verticalAlign: "middle" }} />
                          Allow notifications and background reminders
                        </>
                      ) : (
                        "Allow notifications and background reminders"
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="settings-section settings-notifications-dashboard">
                <label className="label">Notifications dashboard</label>

                <div className="settings-subsection">
                  <label className="label" style={{ fontSize: "0.95rem" }}>
                    Master switches
                  </label>
                  <label className="settings-toggle-row" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={normalizeNotificationPrefs(profile.notificationPrefs).taskPushEnabled !== false}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          notificationPrefs: {
                            ...normalizeNotificationPrefs(p.notificationPrefs),
                            taskPushEnabled: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span>Task reminders (on-device schedule and remote sync)</span>
                  </label>
                  <label className="settings-toggle-row" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={normalizeNotificationPrefs(profile.notificationPrefs).habitPushEnabled !== false}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          notificationPrefs: {
                            ...normalizeNotificationPrefs(p.notificationPrefs),
                            habitPushEnabled: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span>Habit reminder nudges</span>
                  </label>
                </div>

                <div className="settings-subsection" style={{ marginTop: 16 }}>
                  <label className="label" style={{ fontSize: "0.95rem" }}>
                    Default reminders for new tasks
                  </label>
                  <label className="settings-toggle-row" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 10 }}>
                    <input
                      type="checkbox"
                      checked={profile.defaultTaskRemindersOn !== false}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          defaultTaskRemindersOn: e.target.checked,
                        }))
                      }
                    />
                    <span>Turn on reminders for new tasks</span>
                  </label>
                  <label
                    className="settings-hint"
                    style={{ display: "block", marginBottom: 6, opacity: profile.defaultTaskRemindersOn !== false ? 1 : 0.45 }}
                  >
                    Remind me before task starts
                  </label>
                  <select
                    className="input modal-input"
                    style={{ marginBottom: 10 }}
                    disabled={profile.defaultTaskRemindersOn === false}
                    value={
                      profile.defaultRemindBeforeMinutes == null || profile.defaultRemindBeforeMinutes === 0
                        ? ""
                        : String(profile.defaultRemindBeforeMinutes)
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      setProfile((p) => ({
                        ...p,
                        defaultRemindBeforeMinutes: v === "" ? null : Number(v),
                      }));
                    }}
                    aria-label="Default minutes before task"
                  >
                    {TASK_REMINDER_BEFORE_OPTIONS.map((o) => (
                      <option key={o.label} value={o.value == null ? "" : String(o.value)}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <label
                    className="settings-toggle-row"
                    style={{ display: "flex", alignItems: "center", gap: 8, opacity: profile.defaultTaskRemindersOn !== false ? 1 : 0.45 }}
                  >
                    <input
                      type="checkbox"
                      disabled={profile.defaultTaskRemindersOn === false}
                      checked={profile.defaultRemindAtStart !== false}
                      onChange={(e) => setProfile((p) => ({ ...p, defaultRemindAtStart: e.target.checked }))}
                    />
                    <span>Also notify when the task starts</span>
                  </label>
                </div>

                <div className="settings-subsection" style={{ marginTop: 16 }}>
                  <label className="label" style={{ fontSize: "0.95rem" }}>
                    Task reminder timing
                  </label>
                  <label className="settings-toggle-row" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <input
                      type="checkbox"
                      checked={normalizeNotificationPrefs(profile.notificationPrefs).taskRemindBeforeEnabled !== false}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          notificationPrefs: {
                            ...normalizeNotificationPrefs(p.notificationPrefs),
                            taskRemindBeforeEnabled: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span>Remind me before the task starts</span>
                  </label>
                  <div className="settings-inline-row" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 8, opacity: normalizeNotificationPrefs(profile.notificationPrefs).taskRemindBeforeEnabled === false ? 0.45 : 1 }}>
                    <label className="settings-hint" htmlFor="notif-task-before-mins">
                      Minutes before (1–120)
                    </label>
                    <input
                      id="notif-task-before-mins"
                      className="input modal-input"
                      type="number"
                      min={1}
                      max={120}
                      disabled={normalizeNotificationPrefs(profile.notificationPrefs).taskRemindBeforeEnabled === false}
                      value={normalizeNotificationPrefs(profile.notificationPrefs).taskRemindBeforeMinutes}
                      onChange={(e) => {
                        const v = Math.min(120, Math.max(1, Math.round(Number(e.target.value) || 5)));
                        setProfile((p) => ({
                          ...p,
                          notificationPrefs: {
                            ...normalizeNotificationPrefs(p.notificationPrefs),
                            taskRemindBeforeMinutes: v,
                          },
                        }));
                      }}
                      style={{ width: 88 }}
                    />
                  </div>
                  <label className="settings-toggle-row" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                    <input
                      type="checkbox"
                      checked={normalizeNotificationPrefs(profile.notificationPrefs).taskRemindAtStartEnabled !== false}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          notificationPrefs: {
                            ...normalizeNotificationPrefs(p.notificationPrefs),
                            taskRemindAtStartEnabled: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span>Remind at the start time of the task</span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    style={{ marginTop: 12 }}
                    onClick={() => {
                      const np = normalizeNotificationPrefs(profile.notificationPrefs);
                      setProfile((p) => ({
                        ...p,
                        defaultTaskRemindersOn: np.taskRemindBeforeEnabled || np.taskRemindAtStartEnabled,
                        defaultRemindBeforeMinutes: np.taskRemindBeforeEnabled ? np.taskRemindBeforeMinutes : null,
                        defaultRemindAtStart: np.taskRemindAtStartEnabled,
                      }));
                    }}
                  >
                    Apply as defaults for new tasks
                  </button>
                </div>

                <div className="settings-subsection" style={{ marginTop: 18 }}>
                  <label className="label" style={{ fontSize: "0.95rem" }}>
                    Habit reminder cadence
                  </label>
                  <select
                    className="input modal-input"
                    style={{ marginTop: 8 }}
                    value={normalizeNotificationPrefs(profile.notificationPrefs).habitReminderMode}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        notificationPrefs: {
                          ...normalizeNotificationPrefs(p.notificationPrefs),
                          habitReminderMode: e.target.value,
                        },
                      }))
                    }
                  >
                    <option value="custom">Custom (per habit: hourly or choose times)</option>
                    <option value="daily">Once per day</option>
                    <option value="hourly">Every hour</option>
                    <option value="every30">Every 30 minutes</option>
                  </select>
                  <div className="settings-inline-row" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, alignItems: "center" }}>
                    <label className="settings-hint" htmlFor="notif-quiet-start">
                      Quiet hours from
                    </label>
                    <input
                      id="notif-quiet-start"
                      className="input modal-input"
                      type="time"
                      value={normalizeNotificationPrefs(profile.notificationPrefs).habitQuietStart}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          notificationPrefs: {
                            ...normalizeNotificationPrefs(p.notificationPrefs),
                            habitQuietStart: normalizeTimeKey(e.target.value),
                          },
                        }))
                      }
                    />
                    <label className="settings-hint" htmlFor="notif-quiet-end">
                      to
                    </label>
                    <input
                      id="notif-quiet-end"
                      className="input modal-input"
                      type="time"
                      value={normalizeNotificationPrefs(profile.notificationPrefs).habitQuietEnd}
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          notificationPrefs: {
                            ...normalizeNotificationPrefs(p.notificationPrefs),
                            habitQuietEnd: normalizeTimeKey(e.target.value),
                          },
                        }))
                      }
                    />
                  </div>
                  {normalizeNotificationPrefs(profile.notificationPrefs).habitReminderMode === "daily" ? (
                    <div className="settings-inline-row" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, alignItems: "center" }}>
                      <label className="settings-hint" htmlFor="notif-daily-time">
                        Daily ping at
                      </label>
                      <input
                        id="notif-daily-time"
                        className="input modal-input"
                        type="time"
                        value={normalizeNotificationPrefs(profile.notificationPrefs).habitDailyTime}
                        onChange={(e) =>
                          setProfile((p) => ({
                            ...p,
                            notificationPrefs: {
                              ...normalizeNotificationPrefs(p.notificationPrefs),
                              habitDailyTime: normalizeTimeKey(e.target.value),
                            },
                          }))
                        }
                      />
                    </div>
                  ) : null}
                </div>

                <div className="settings-subsection" style={{ marginTop: 18 }}>
                  <label className="label" style={{ fontSize: "0.95rem" }}>
                    Per-habit reminders
                  </label>
                  {(habitTracker.habits || []).length === 0 ? (
                    <p className="settings-hint">No habits yet. Add some under <strong>Settings → Customization → Habit tracker</strong>.</p>
                  ) : (
                    <ul className="notif-habit-toggle-list">
                      {(habitTracker.habits || []).map((h) => {
                        const row = normalizeHabitRow(h);
                        if (!row) return null;
                        return (
                          <li key={row.id} className="notif-habit-toggle-row">
                            <span>{row.label}</span>
                            <label className="settings-toggle-row" style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                              <input
                                type="checkbox"
                                checked={row.reminderPushEnabled !== false}
                                onChange={(e) =>
                                  setHabitTracker((prev) => ({
                                    ...prev,
                                    habits: (prev.habits || []).map((x) =>
                                      x.id === row.id
                                        ? normalizeHabitRow({ ...x, reminderPushEnabled: e.target.checked })
                                        : x
                                    ),
                                  }))
                                }
                              />
                              <span>Remind</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {!isCapacitorNativeApp() && (
              <div className="settings-section">
                <label className="label">Test background reminder</label>
                <div className="settings-push-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={async () => {
                      const subscription = await notificationService.getWebPushSubscription();
                      if (!subscription) {
                        alert(
                          'No push subscription on this device yet. Use "Allow notifications and background reminders" above first, then try again.'
                        );
                        return;
                      }
                      const res = await fetch(apiUrl("/api/push/send"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          subscription,
                          title: "Test",
                          body: "If you see this, background reminders are working.",
                        }),
                      });
                      const j = await res.json().catch(() => ({}));
                      if (res.ok && j.sent > 0) {
                        alert(`Sent test to ${j.sent} device(s). Check your notification tray.`);
                      } else if (res.ok && j.sent === 0) {
                        alert(
                          'No saved device connection yet. Use "Allow notifications and background reminders" above first, then try again.'
                        );
                      } else {
                        alert(j.hint || j.error || `Test failed (${res.status}).`);
                      }
                    }}
                  >
                    Send test
                  </button>
                </div>
              </div>
              )}

              <details className="settings-accordion settings-notifications-instructions">
                <summary className="settings-accordion-summary">Instructions</summary>
                <div className="settings-accordion-panel settings-notifications-instructions-panel">
                  <p className="settings-hint">
                    On the <strong>phone app</strong>, use <strong>Allow notifications and sync reminders</strong> once to schedule on-device task alerts (where supported), allow remote delivery, and sync your reminder list to the hosted service. Use <strong>Open system settings</strong> if you previously chose Don&apos;t allow.
                  </p>
                  <p className="settings-hint">
                    <strong>iPhone:</strong> Task times use scheduled local alerts for each task with Remind me (before start and/or at start). Remote registration keeps a backup path so nudges can still reach you when the app is not in the foreground; behavior depends on iOS and battery settings.
                  </p>
                  <p className="settings-hint">
                    <strong>Android:</strong> Task reminders use push and your system notification settings; battery saver can delay delivery.
                  </p>
                  <p className="settings-hint">
                    <strong>Browser:</strong> Use <strong>Allow notifications and background reminders</strong> for permission plus optional push when your deployment supports it. In-browser reminders still need the tab or site allowed by the browser.
                  </p>
                  <p className="settings-hint">
                    <strong>Notifications dashboard:</strong> Master switches control task delivery and habit nudges. <strong>Default reminders for new tasks</strong> sets what new tasks start with; change any task under Details → Remind me.
                  </p>
                  <p className="settings-hint">
                    <strong>How delivery differs:</strong> On iPhone, task reminder times are scheduled locally when Remind me is on. On Android, reminders follow push and permission. In the browser, reminders depend on permission and push connection. <strong>Habits</strong> use the cadence and quiet hours here for in-app nudges while you use the app; the same schedule is stored on the server for backup pings when you are away. Very frequent habit modes can be batched or delayed by the OS when the app is closed; quiet hours still apply.
                  </p>
                  <p className="settings-hint">
                    <strong>Default reminders for new tasks:</strong> Applied when you add a task. On iPhone, keep the app updated so local alerts can fire at the right time.
                  </p>
                  <p className="settings-hint">
                    <strong>Task reminder timing:</strong> Used for syncing your reminder preferences to the server and for on-device scheduling on iPhone when Remind me is on. Per-task overrides stay on the task card.
                  </p>
                  <p className="settings-hint">
                    <strong>Habit reminder cadence:</strong> Quiet hours apply to all modes. In-app habit checks run about every 20 seconds while the app is open. <strong>Custom</strong> uses each habit&apos;s hourly or clock list from Settings → Customization → Habit tracker.
                  </p>
                  <p className="settings-hint">
                    <strong>Per-habit reminders:</strong> Turn off Remind for habits you don&apos;t want pinged.
                  </p>
                  <p className="settings-hint">
                    <strong>Background reminders (browser):</strong> Optional push connects this device to your hosted deployment so reminder pings can arrive after you close the tab. On iPhone Safari, add the app from the Share menu first. After connecting, use <strong>Send test</strong> to confirm.
                  </p>
                </div>
              </details>
              </div>
              ) : (
              <>
              <details className="settings-accordion" open>
                <summary className="settings-accordion-summary">Customization</summary>
                <div className="settings-accordion-panel">
                <details className="settings-sub-accordion settings-habit-sub" open>
                  <summary className="settings-sub-accordion-summary">Habit tracker</summary>
                  <div className="settings-sub-accordion-panel">
                    <div className="settings-section">
                <label className="label">Habit check-ins</label>
                <p className="settings-hint">
                  Habits you want to <strong>build</strong> or <strong>break</strong>. On Today, the app asks once a day whether you did them.{" "}
                  <strong>Reminder nudges</strong> (hourly, every 30 minutes, daily, quiet hours, on/off per habit) are set in{" "}
                  <strong>Notifications &amp; reminders</strong> (button below in Customization). When that page is set to <strong>Custom</strong>, you can pick hourly vs exact times here for each habit.
                </p>
                <ul className="habit-settings-list">
                  {(habitTracker.habits || []).map((h) => {
                    const row = normalizeHabitRow(h) || h;
                    const sch = row.reminderSchedule || "none";
                    const hours = row.reminderHours || [];
                    const dashNp = normalizeNotificationPrefs(profile.notificationPrefs);
                    return (
                      <li key={row.id} className="habit-settings-card">
                        <div className="habit-settings-card-head">
                          <div className="habit-settings-card-title">
                            {row.label}{" "}
                            <span className="settings-hint" style={{ marginLeft: 6 }}>
                              ({row.direction === "break" ? "break" : "build"})
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm routine-template-remove"
                            onClick={() =>
                              setHabitTracker((prev) => ({
                                habits: (prev.habits || []).filter((x) => x.id !== row.id),
                                log: Object.fromEntries(
                                  Object.entries(prev.log || {}).map(([dk, day]) => [
                                    dk,
                                    typeof day === "object" && day != null
                                      ? Object.fromEntries(Object.entries(day).filter(([k]) => k !== row.id))
                                      : day,
                                  ])
                                ),
                              }))
                            }
                            aria-label={`Remove habit ${row.label}`}
                          >
                            <TrashIcon style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                        {dashNp.habitReminderMode === "custom" ? (
                          <>
                            <label className="habit-settings-remind-label" htmlFor={`habit-remind-${row.id}`}>
                              Reminders (custom)
                            </label>
                            <select
                              id={`habit-remind-${row.id}`}
                              className="input habit-settings-remind-select"
                              value={sch}
                              onChange={(e) => {
                                const v = e.target.value;
                                setHabitTracker((prev) => ({
                                  ...prev,
                                  habits: (prev.habits || []).map((x) =>
                                    x.id === row.id
                                      ? normalizeHabitRow({
                                          ...x,
                                          reminderSchedule: v === "hourly" || v === "hours" ? v : "none",
                                          reminderHours: v === "hours" ? (Array.isArray(x.reminderHours) ? x.reminderHours : []) : [],
                                        })
                                      : x
                                  ),
                                }));
                              }}
                            >
                              <option value="none">None</option>
                              <option value="hourly">Hourly (uses quiet hours from the notifications page)</option>
                              <option value="hours">Choose times</option>
                            </select>
                            {sch === "hours" && (
                              <div className="habit-reminder-hours">
                                <div className="habit-reminder-hour-chips">
                                  {hours.map((hm) => (
                                    <span key={hm} className="habit-reminder-chip">
                                      {to12Hour(hm)}
                                      <button
                                        type="button"
                                        aria-label={`Remove ${hm}`}
                                        onClick={() =>
                                          setHabitTracker((prev) => ({
                                            ...prev,
                                            habits: (prev.habits || []).map((x) =>
                                              x.id === row.id
                                                ? normalizeHabitRow({
                                                    ...x,
                                                    reminderHours: hours.filter((t) => t !== hm),
                                                  })
                                                : x
                                            ),
                                          }))
                                        }
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                                <div className="habit-reminder-add-row">
                                  <input
                                    className="input"
                                    type="time"
                                    value={habitReminderDraft[row.id] ?? "09:00"}
                                    onChange={(e) =>
                                      setHabitReminderDraft((d) => ({ ...d, [row.id]: e.target.value }))
                                    }
                                    aria-label={`Add reminder time for ${row.label}`}
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    onClick={() => {
                                      const draft = habitReminderDraft[row.id] ?? "09:00";
                                      const slot = normalizeTimeKey(draft);
                                      setHabitTracker((prev) => ({
                                        ...prev,
                                        habits: (prev.habits || []).map((x) => {
                                          if (x.id !== row.id) return x;
                                          const cur = normalizeHabitRow(x)?.reminderHours || [];
                                          if (cur.includes(slot)) return x;
                                          return normalizeHabitRow({ ...x, reminderHours: [...cur, slot].sort() });
                                        }),
                                      }));
                                    }}
                                  >
                                    Add time
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="settings-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                            Nudges use the <strong>global schedule</strong> from Notifications &amp; reminders (not per-habit clocks).
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="settings-add-type" style={{ marginTop: 10 }}>
                  <input
                    className="input modal-input"
                    type="text"
                    value={newHabitLabel}
                    onChange={(e) => setNewHabitLabel(e.target.value)}
                    placeholder="e.g. Drink water / stretch"
                    aria-label="New habit label"
                  />
                  <select
                    className="input"
                    value={newHabitDirection}
                    onChange={(e) => setNewHabitDirection(e.target.value)}
                    aria-label="Build or break habit"
                    style={{ minWidth: 100 }}
                  >
                    <option value="build">Build</option>
                    <option value="break">Break</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      const label = (newHabitLabel || "").trim();
                      if (!label) return;
                      const next = normalizeHabitRow({
                        id: uid(),
                        label,
                        direction: newHabitDirection === "break" ? "break" : "build",
                        reminderSchedule: "none",
                        reminderHours: [],
                      });
                      if (!next) return;
                      setHabitTracker((prev) => ({
                        habits: [...(prev.habits || []), next],
                        log: prev.log || {},
                      }));
                      setNewHabitLabel("");
                    }}
                  >
                    Add habit
                  </button>
                </div>
                    </div>
                  </div>
                </details>

              <div className="settings-section">
                <details className="settings-sub-accordion settings-dock-sub">
                  <summary className="settings-sub-accordion-summary">Bottom navigation</summary>
                  <div className="settings-sub-accordion-panel">
                    <p className="settings-hint">
                      <strong>Today</strong> always stays first in the app bar. Drag blocks to reorder other tabs. Open the menu on a tab to remove it from the dock or move it next to Today (first slot after Today).
                    </p>
                    <div className="settings-dock-blocks" role="list">
                      {normalizeDockOrder(profile.dockOrder).map((rowId) => {
                        const row = DOCK_NAV_SETTINGS_ROWS.find((r) => r.id === rowId);
                        if (!row) return null;
                        const Icon = DOCK_EDITOR_ICON_BY_ID[row.id] || MenuIcon;
                        const nv = normalizeNavVisibility(profile.navVisibility);
                        const onDock = nv[row.id] === true;
                        const menuOpen = dockNavEditorMenuId === row.id;
                        return (
                          <div
                            key={row.id}
                            role="listitem"
                            className={[
                              "settings-dock-block",
                              dockNavDragOverId === row.id ? "is-drag-over" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            draggable
                            onDragStart={(e) => {
                              setDockNavEditorMenuId(null);
                              e.dataTransfer.effectAllowed = "move";
                              try {
                                e.dataTransfer.setData("text/plain", row.id);
                              } catch {
                                /* ignore */
                              }
                              dockNavDragSourceRef.current = row.id;
                            }}
                            onDragEnd={() => {
                              dockNavDragSourceRef.current = null;
                              setDockNavDragOverId(null);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                              setDockNavDragOverId(row.id);
                            }}
                            onDragLeave={(e) => {
                              if (!e.currentTarget.contains(e.relatedTarget)) setDockNavDragOverId(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              reorderDockNavOnDrop(row.id);
                            }}
                          >
                            <div className="settings-dock-block-main">
                              <span className="settings-dock-grip" aria-hidden="true" title="Drag to reorder">
                                <span className="settings-dock-grip-line" />
                                <span className="settings-dock-grip-line" />
                                <span className="settings-dock-grip-line" />
                              </span>
                              <Icon className="settings-dock-block-icon" aria-hidden />
                              <div className="settings-dock-block-text">
                                <span className="settings-dock-block-title">{row.label}</span>
                                <span className={onDock ? "settings-dock-block-status is-on" : "settings-dock-block-status is-off"}>
                                  {onDock ? "On dock" : "Hidden — shortcut on Today"}
                                </span>
                              </div>
                            </div>
                            <div className="settings-dock-block-menu-wrap">
                              <button
                                type="button"
                                className="settings-dock-block-menu-btn icon-btn"
                                aria-expanded={menuOpen}
                                aria-haspopup="true"
                                aria-label={`Options for ${row.label}`}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDockNavEditorMenuId((prev) => (prev === row.id ? null : row.id));
                                }}
                              >
                                <MenuIcon style={{ width: 20, height: 20 }} />
                              </button>
                              {menuOpen ? (
                                <div className="settings-dock-block-menu" role="menu">
                                  {onDock ? (
                                    <button
                                      type="button"
                                      className="settings-dock-menu-item"
                                      role="menuitem"
                                      onClick={() => removeDockNavFromBar(row.id)}
                                    >
                                      Remove from bottom nav
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="settings-dock-menu-item"
                                      role="menuitem"
                                      onClick={() => {
                                        setProfile((p) => ({
                                          ...p,
                                          navVisibility: { ...normalizeNavVisibility(p.navVisibility), [row.id]: true },
                                        }));
                                        setDockNavEditorMenuId(null);
                                      }}
                                    >
                                      Add to bottom nav
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="settings-dock-menu-item"
                                    role="menuitem"
                                    onClick={() => moveDockNavNextToToday(row.id)}
                                  >
                                    Move next to Today
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </details>
              </div>

              <div className="settings-section">
                <label className="label">Task completion messages</label>
                <p className="settings-hint">
                  Pop-up line when you check off a task. Tap outside the card to dismiss it anytime. Turning this off still saves the task; you just won&apos;t see the affirmation.
                </p>
                <label className="settings-toggle-row" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    checked={profile.completionAffirmationsOn !== false}
                    onChange={(e) => setProfile((p) => ({ ...p, completionAffirmationsOn: e.target.checked }))}
                  />
                  <span>Show completion affirmations</span>
                </label>
                <label className="settings-hint" style={{ display: "block", marginBottom: 6, opacity: profile.completionAffirmationsOn !== false ? 1 : 0.45 }}>
                  Tone
                </label>
                <select
                  className="input modal-input"
                  style={{ marginBottom: 0 }}
                  disabled={profile.completionAffirmationsOn === false}
                  value={
                    profile.completionAffirmationTone === "matter-of-fact" ||
                    profile.completionAffirmationTone === "funny" ||
                    profile.completionAffirmationTone === "harsh"
                      ? profile.completionAffirmationTone
                      : "supportive"
                  }
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      completionAffirmationTone: /** @type {any} */ (e.target.value),
                    }))
                  }
                  aria-label="Completion message tone"
                >
                  <option value="supportive">Supportive - warm and encouraging</option>
                  <option value="matter-of-fact">Matter of fact - short and neutral</option>
                  <option value="funny">Funny - playful</option>
                  <option value="harsh">Harsh - blunt tough-love (still PG)</option>
                </select>
              </div>

              <div className="settings-section">
                <label className="label">Morning routine (optional add-on)</label>
                <label className="settings-toggle-row" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <input type="checkbox" checked={routineSchedule.enabledMorning !== false} onChange={(e) => setRoutineSchedule((s) => ({ ...s, enabledMorning: e.target.checked }))} />
                  <span>Show morning routine on Today</span>
                </label>
                <p className="settings-hint">Steps that appear at the start of your day. Choose which days to show it.</p>
                <ul className="routine-template-list">
                  {morningRoutineTemplate.map((r, idx) => (
                    <li key={r.id} className="routine-template-item">
                      <input
                        className="input routine-template-input"
                        type="text"
                        value={r.text}
                        onChange={(e) => setMorningRoutineTemplate((prev) => prev.map((x, i) => i === idx ? { ...x, text: e.target.value } : x))}
                        aria-label={`Morning step ${idx + 1}`}
                      />
                      <button type="button" className="btn btn-ghost btn-sm routine-template-remove" onClick={() => setMorningRoutineTemplate((prev) => prev.filter((_, i) => i !== idx))} aria-label="Remove step">
                        <TrashIcon style={{ width: 14, height: 14 }} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn btn-sm" onClick={() => setMorningRoutineTemplate((prev) => [...prev, { id: `morning-${Date.now()}`, text: "New step" }])}>
                  Add step
                </button>
                <p className="settings-hint" style={{ marginTop: 8 }}>Show on:</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  <button type="button" className={`btn btn-sm ${routineSchedule.morning === "every" ? "btn-primary" : ""}`} onClick={() => setRoutineSchedule((s) => ({ ...s, morning: "every" }))}>
                    Every day
                  </button>
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                    const arr = Array.isArray(routineSchedule.morning) ? routineSchedule.morning : [];
                    const on = routineSchedule.morning === "every" || arr.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        className={`btn btn-sm ${on ? "btn-primary" : ""}`}
                        onClick={() => setRoutineSchedule((s) => {
                          const next = Array.isArray(s.morning) ? s.morning : (s.morning === "every" ? [0, 1, 2, 3, 4, 5, 6] : []);
                          const has = next.includes(d);
                          const nextArr = has ? next.filter((x) => x !== d) : [...next, d].sort((a, b) => a - b);
                          return { ...s, morning: nextArr.length === 7 ? "every" : nextArr.length === 0 ? "every" : nextArr };
                        })}
                      >
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="settings-section">
                <label className="label">Wind-down routine (optional add-on)</label>
                <label className="settings-toggle-row" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <input type="checkbox" checked={routineSchedule.enabledNight !== false} onChange={(e) => setRoutineSchedule((s) => ({ ...s, enabledNight: e.target.checked }))} />
                  <span>Show wind-down routine on Today</span>
                </label>
                <p className="settings-hint">Edit the steps that appear in your nightly routine.</p>
                <ul className="routine-template-list">
                  {routineTemplate.map((r, idx) => (
                    <li key={r.id} className="routine-template-item">
                      <input
                        className="input routine-template-input"
                        type="text"
                        value={r.text}
                        onChange={(e) => setRoutineTemplate((prev) => prev.map((x, i) => i === idx ? { ...x, text: e.target.value } : x))}
                        aria-label={`Step ${idx + 1}`}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm routine-template-remove"
                        onClick={() => setRoutineTemplate((prev) => prev.filter((_, i) => i !== idx))}
                        aria-label="Remove step"
                      >
                        <TrashIcon style={{ width: 14, height: 14 }} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setRoutineTemplate((prev) => [...prev, { id: `step-${Date.now()}`, text: "New step" }])}
                >
                  Add step
                </button>
                <p className="settings-hint" style={{ marginTop: 8 }}>Show on:</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  <button type="button" className={`btn btn-sm ${routineSchedule.night === "every" ? "btn-primary" : ""}`} onClick={() => setRoutineSchedule((s) => ({ ...s, night: "every" }))}>
                    Every day
                  </button>
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                    const arr = Array.isArray(routineSchedule.night) ? routineSchedule.night : [];
                    const on = routineSchedule.night === "every" || arr.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        className={`btn btn-sm ${on ? "btn-primary" : ""}`}
                        onClick={() => setRoutineSchedule((s) => {
                          const next = Array.isArray(s.night) ? s.night : (s.night === "every" ? [0, 1, 2, 3, 4, 5, 6] : []);
                          const has = next.includes(d);
                          const nextArr = has ? next.filter((x) => x !== d) : [...next, d].sort((a, b) => a - b);
                          return { ...s, night: nextArr.length === 7 ? "every" : nextArr.length === 0 ? "every" : nextArr };
                        })}
                      >
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="settings-section">
                <label className="label">Task types</label>
                <p className="settings-hint">Types for organizing tasks (e.g. Work, Personal). Quick add and tasks use these.</p>
                <ul className="routine-template-list">
                  {customCategories.map((cat) => (
                    <li key={cat} className="routine-template-item">
                      <span className="routine-template-input" style={{ flex: 1 }}>{cat}</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm routine-template-remove"
                        onClick={() => {
                          if (customCategories.length <= 1) return;
                          setCustomCategories((prev) => prev.filter((c) => c !== cat));
                        }}
                        disabled={customCategories.length <= 1}
                        aria-label={`Remove type ${cat}`}
                      >
                        <TrashIcon style={{ width: 14, height: 14 }} />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="settings-add-type">
                  <input
                    className="input modal-input"
                    type="text"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="New type name"
                    aria-label="New task type"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const name = (newTypeName || "").trim();
                        if (name && !customCategories.includes(name)) {
                          setCustomCategories((prev) => [...prev, name]);
                          setNewTypeName("");
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      const name = (newTypeName || "").trim();
                      if (name && !customCategories.includes(name)) {
                        setCustomCategories((prev) => [...prev, name]);
                        setNewTypeName("");
                      }
                    }}
                  >
                    Add type
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <label className="label">Shopping &amp; errand lists</label>
                <p className="settings-hint">
                  When a task title contains one of these words (whole word), PROYOU can offer a checklist. Defaults are similar to grocery, store, and errand - change them anytime.
                </p>
                <input
                  className="input modal-input"
                  value={
                    profile.groceryKeywords && profile.groceryKeywords.length
                      ? profile.groceryKeywords.join(", ")
                      : DEFAULT_GROCERY_KEYWORDS.join(", ")
                  }
                  onChange={(e) => {
                    const arr = [
                      ...new Set(
                        e.target.value
                          .split(/[,;\n]+/)
                          .map((k) => k.trim().toLowerCase())
                          .filter(Boolean)
                      ),
                    ];
                    setProfile((p) => ({ ...p, groceryKeywords: arr.length ? arr : null }));
                  }}
                  placeholder="grocery, store, errand"
                  aria-label="Keywords that trigger shopping checklist"
                />
                <label className="settings-toggle-row" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                  <input
                    type="checkbox"
                    checked={profile.logMissedTasksEod !== false}
                    onChange={(e) => setProfile((p) => ({ ...p, logMissedTasksEod: e.target.checked }))}
                  />
                  <span>Log tasks still incomplete when a calendar day ends (Coach &amp; stats)</span>
                </label>
                <p className="settings-hint" style={{ marginTop: 4 }}>
                  After midnight, the app can record unchecked tasks from the previous day as missed (once each). Turn this off if you prefer not to track that.
                </p>
                <p className="settings-hint" style={{ marginTop: 10 }}>
                  <strong>Saved lists</strong> - reuse lines from the checklist modal (&quot;Save as reusable list&quot;) or from the prompt when you add a matching task.
                </p>
                <ul className="routine-template-list">
                  {(profile.grocerySavedLists || []).length === 0 && (
                    <li className="settings-hint" style={{ listStyle: "none" }}>
                      No saved lists yet.
                    </li>
                  )}
                  {(profile.grocerySavedLists || []).map((l) => (
                    <li key={l.id} className="routine-template-item">
                      <span className="routine-template-input" style={{ flex: 1 }}>
                        {l.title} <span className="settings-hint">({(l.items || []).length} lines)</span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm routine-template-remove"
                        onClick={() =>
                          setProfile((p) => ({
                            ...p,
                            grocerySavedLists: (p.grocerySavedLists || []).filter((x) => x.id !== l.id),
                          }))
                        }
                        aria-label={`Remove saved list ${l.title}`}
                      >
                        <TrashIcon style={{ width: 14, height: 14 }} />
                      </button>
                    </li>
                  ))}
                </ul>
                <label className="label" style={{ marginTop: 12, display: "block" }}>
                  Attach a saved list to a task on Today
                </label>
                <p className="settings-hint">Pick today&apos;s task and a list, then apply (replaces existing checklist lines).</p>
                <div className="settings-add-type" style={{ flexWrap: "wrap" }}>
                  <select
                    className="input modal-input"
                    style={{ minWidth: 160 }}
                    value={listAttachTaskKey}
                    onChange={(e) => setListAttachTaskKey(e.target.value)}
                    aria-label="Task on today"
                  >
                    <option value="">- Task -</option>
                    {allTasksInDay(
                      mergeSubscriptionTasksIntoHours(
                        appState.days?.[realTodayKey]?.hours || {},
                        realTodayKey,
                        finance.subscriptions,
                        customCategories
                      ),
                      customCategories
                    ).map((t) => {
                      const v = `${t.hour}|${t.category}|${t.id}`;
                      return (
                        <option key={v} value={v}>
                          {to12Hour(t.hour)} · {t.category}: {String(t.text || "").slice(0, 42)}
                          {String(t.text || "").length > 42 ? "…" : ""}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    className="input modal-input"
                    style={{ minWidth: 140 }}
                    value={listAttachSavedId}
                    onChange={(e) => setListAttachSavedId(e.target.value)}
                    aria-label="Saved list"
                  >
                    <option value="">- List -</option>
                    {(profile.grocerySavedLists || []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={!listAttachTaskKey || !listAttachSavedId}
                    onClick={() => {
                      const list = (profile.grocerySavedLists || []).find((x) => x.id === listAttachSavedId);
                      if (!list) return;
                      const parts = String(listAttachTaskKey).split("|");
                      if (parts.length !== 3) return;
                      const [hourKey, category, taskId] = parts;
                      updateTaskGroceryList(realTodayKey, hourKey, category, taskId, (gl) => ({
                        ...gl,
                        items: list.items.map((it) => ({ id: uid(), text: it.text, done: false })),
                      }));
                      setListAttachSavedId("");
                      setListAttachTaskKey("");
                    }}
                  >
                    Apply to task
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <label className="label">Theme Color</label>
                <div className="theme-picker">
                  {Object.entries(THEMES).map(([key, themeData]) => {
                    const swatchInk = themeData.name === "Midnight" || themeData.name === "Mocha" ? "#fafafa" : "#333";
                    return (
                    <button
                      key={key}
                      className={`theme-option ${theme.name === themeData.name ? 'selected' : ''}`}
                      onClick={() => setTheme(themeData)}
                      style={{
                        background: themeData.gradient,
                        border: theme.name === themeData.name ? `3px solid ${swatchInk}` : '2px solid transparent'
                      }}
                      title={themeData.name}
                    >
                      {theme.name === themeData.name && <CheckIcon style={{ color: swatchInk, width: 18, height: 18 }} />}
                    </button>
                    );
                  })}
                </div>
              </div>
                </div>
              </details>

              <div className="settings-section settings-nav-deep-link-card">
                <label className="label">Notifications &amp; reminders</label>
                <p className="settings-hint">Device alerts, background sync, task and habit timing, quiet hours, and per-habit nudges.</p>
                <button type="button" className="btn btn-primary" onClick={() => setSettingsSubView("notifications")}>
                  Open notifications &amp; reminders
                </button>
              </div>

              

              <details className="settings-accordion">
                <summary className="settings-accordion-summary">Guides &amp; tours</summary>
                <div className="settings-accordion-panel">
              <div className="settings-section">
                <label className="label">Guides &amp; tours</label>
                <p className="settings-hint">
                  Replay the short overview of tabs and features, or the longer full walkthrough. Closing a tour with &quot;Exit&quot; does not mark it complete; finishing the last slide does.
                </p>
                <div className="settings-push-actions" style={{ flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-primary" onClick={() => startReplayFeatureTour("quick")}>
                    Replay quick tour
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => startReplayFeatureTour("full")}>
                    Replay full walkthrough
                  </button>
                </div>
              </div>
                </div>
              </details>

              <details className="settings-accordion">
                <summary className="settings-accordion-summary">Personal &amp; account</summary>
                <div className="settings-accordion-panel">
                  <div className="settings-section">
                    <label className="label">Account</label>
                    {!isFirebaseEnabled() ? (
                      <p className="settings-hint">
                        Add cloud sync in your deployment (environment variables) to sync your schedule, notes, finance, and settings across devices.
                      </p>
                    ) : (
                      <>
                        <p className="settings-hint settings-account-status" style={{ marginBottom: 12 }}>
                          {firebaseUser?.isAnonymous ? (
                            <>Logged in as <strong>guest</strong> (this browser)</>
                          ) : firebaseUser?.email ? (
                            <>
                              Logged in as <strong>{firebaseUser.email}</strong>
                            </>
                          ) : firebaseUser?.displayName ? (
                            <>
                              Logged in as <strong>{firebaseUser.displayName}</strong>
                            </>
                          ) : firebaseUser ? (
                            "Logged in"
                          ) : (
                            "Not signed in."
                          )}
                        </p>
                        {firebaseUser ? (
                          <>
                            <div className="settings-account-actions">
                              <button type="button" className="btn btn-sm" disabled={authBusy} onClick={() => void handleAuthSignOut()}>
                                Log out
                              </button>
                              <button
                                type="button"
                                id="delete-account-entry"
                                className="btn btn-sm settings-delete-account-btn"
                                disabled={authBusy}
                                onClick={() => openDeleteAccountFlow()}
                              >
                                {firebaseUser.isAnonymous ? "Delete guest data" : "Delete account"}
                              </button>
                            </div>
                            <p className="settings-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                              Opens a short flow. Your account is removed permanently (not deactivated), then this device reloads.
                            </p>
                          </>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="settings-section">
                    <label className="label">Your name</label>
                    <input
                      className="input modal-input"
                      type="text"
                      value={profile.userName}
                      onChange={(e) => setProfile((p) => ({ ...p, userName: e.target.value.trim() }))}
                      placeholder="e.g. Sarah"
                      aria-label="Your name"
                    />
                  </div>
                  <div className="settings-section">
                    <label className="label">Birthday (for greetings)</label>
                    <input
                      className="input modal-input"
                      type="text"
                      value={profile.userBirthday}
                      onChange={(e) => setProfile((p) => ({ ...p, userBirthday: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                      placeholder="MMDD e.g. 0315"
                      aria-label="Birthday month and day"
                      maxLength={4}
                    />
                    <p className="settings-hint">Enter as MMDD (e.g. 0315 for March 15). We&apos;ll wish you happy birthday on the day.</p>
                  </div>
                </div>
              </details>

              </>
              )}
              </div>

              <div className="settings-modal-footer">
                <div className="settings-privacy-footer">
                  <button
                    type="button"
                    className="settings-privacy-link"
                    id="settings-privacy-policy"
                    onClick={() => setShowPrivacyPolicy(true)}
                  >
                    Privacy Policy
                  </button>
                </div>

                <div className="modal-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setShowPrivacyPolicy(false);
                      setSettingsSubView("main");
                      setShowSettings(false);
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showSettings && showPrivacyPolicy && (
          <div
            className="modal-overlay privacy-policy-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-policy-title"
            onClick={() => setShowPrivacyPolicy(false)}
          >
            <div className="modal privacy-policy-modal" onClick={(e) => e.stopPropagation()}>
              <div className="privacy-policy-modal-header">
                <h3 id="privacy-policy-title" className="privacy-policy-modal-title">
                  Privacy Policy
                </h3>
                <button
                  type="button"
                  className="btn-icon settings-modal-close"
                  onClick={() => setShowPrivacyPolicy(false)}
                  aria-label="Close privacy policy"
                >
                  <CloseIcon style={{ width: 22, height: 22 }} />
                </button>
              </div>
              <div className="privacy-policy-body">
                <p>
                  ProYou collects limited account information, including email address and account identifiers, for
                  login and authentication.
                </p>
                <p>
                  ProYou does not collect, transmit, or store the tasks, notes, schedules, or other personal planning
                  content users create in the app, which remains on the user's device.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* In-app task banner: Start / Snooze / Skip or Wrap it up */}
        {taskBanner && tab === "today" && isSameDayKey(tKey, realTodayKey) && (
          <div className="inapp-banner" aria-live="polite">
            <div
              className="inapp-banner-content inapp-banner-content-tappable"
              role="button"
              tabIndex={0}
              aria-label="Open this task in your day"
              onClick={(e) => {
                if (e.target.closest("button")) return;
                goToTaskFromBannerAndDismiss();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  goToTaskFromBannerAndDismiss();
                }
              }}
            >
              {taskBannerTapHint ? (
                <p className="inapp-banner-tap-hint">Tap this card to jump to the task in your timeline.</p>
              ) : null}
              {taskBanner.type === "start" ? (
                <div className="inapp-banner-inner">
                  <span className="inapp-banner-title">Next up</span>
                  <span className="inapp-banner-task">{taskBanner.task.text}</span>
                  <div className="inapp-banner-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => goToTaskFromBannerAndDismiss()}>
                      Start
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        localStorage.setItem("taskBannerSnoozeUntil", String(Date.now() + 5 * 60 * 1000));
                        setTaskBanner(null);
                        setTaskBannerTapHint(false);
                      }}
                    >
                      Snooze
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setTaskBanner(null);
                        setTaskBannerTapHint(false);
                      }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ) : (
                <div className="inapp-banner-inner">
                  <span className="inapp-banner-title">Wrap it up</span>
                  <span className="inapp-banner-task">
                    {taskBanner.nextTask ? `Next: ${taskBanner.nextTask.text}` : "Next"}
                  </span>
                  <div className="inapp-banner-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => goToTaskFromBannerAndDismiss()}>
                      OK
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Toast Notification - tap dimmed area outside card to dismiss */}
        {toastNotification && (
          <>
            <button
              type="button"
              className="toast-dismiss-overlay"
              aria-label="Dismiss message"
              onClick={() => {
                if (toastDismissTimerRef.current) {
                  clearTimeout(toastDismissTimerRef.current);
                  toastDismissTimerRef.current = null;
                }
                setToastNotification(null);
              }}
            />
            <div className="toast-notification" role="status">
              <div className="toast-content">
                <SparkleIcon style={{ width: "20px", height: "20px", flexShrink: 0 }} />
                <div className="toast-text">
                  <div className="toast-message">{String(toastNotification.message || "")}</div>
                  {toastNotification.taskText ? <div className="toast-task">{toastNotification.taskText}</div> : null}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Morning Greeting */}
        {morningGreeting && (
          <div className="modal-overlay celebration-overlay" onClick={() => setMorningGreeting(false)}>
            <div className="modal celebration-modal" onClick={(e) => e.stopPropagation()}>
              {(() => {
                const now = new Date();
                const monthDay = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
                const birthInput = (profile.userBirthday || "").replace(/\D/g, "").padStart(4, "0").slice(-4);
                const isBirthday = birthInput.length === 4 && birthInput === monthDay;
                const displayName = (profile.userName || "").trim() || "you";
                return (
                  <div className="celebration-modal-inner">
                    <h3 style={{ fontSize: "24px", marginBottom: "8px" }}>
                      Good morning, {displayName}
                    </h3>
                    {isBirthday && (
                      <p className="celebration-task" style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px", color: "var(--theme-accent)" }}>
                        Happy birthday!
                      </p>
                    )}
                    <p className="celebration-task" style={{ fontSize: "16px", lineHeight: "1.6" }}>
                      {(() => {
                        const patterns = analyzePatterns();
                        if (patterns.totalCompletions > 10) {
                          return "You usually do better when you start with one small task. Want to pick one together?";
                        }
                        return "How would you like to show up today?";
                      })()}
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={() => setMorningGreeting(false)}
                      style={{ marginTop: "24px" }}
                    >
                      Let&apos;s begin
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {onboardingActive && !authWaiting && !showLoginGate && (
          <OnboardingFlow
            step={onboardingStep}
            setStep={setOnboardingStep}
            onExitComplete={finishOnboardingWizard}
            onExitSkipAll={() => finishOnboardingWizard(null)}
            onFinishSetup={finishOnboardingWizard}
            firebaseOn={firebaseOn}
            profile={profile}
            setProfile={setProfile}
            theme={theme}
            setTheme={setTheme}
            themesMap={THEMES}
            habitTracker={habitTracker}
            setHabitTracker={setHabitTracker}
            routineTemplate={routineTemplate}
            setRoutineTemplate={setRoutineTemplate}
            morningRoutineTemplate={morningRoutineTemplate}
            setMorningRoutineTemplate={setMorningRoutineTemplate}
            routineSchedule={routineSchedule}
            setRoutineSchedule={setRoutineSchedule}
            customCategories={customCategories}
            setCustomCategories={setCustomCategories}
            suggestedCategories={DEFAULT_CATEGORIES}
            fallbackMorningTemplate={MORNING_ROUTINE.map((r) => ({ id: r.id, text: r.text }))}
            fallbackNightTemplate={BEDTIME_ROUTINE.map((r) => ({ id: r.id, text: r.text }))}
          />
        )}

        {featureWalkthroughMode && !authWaiting && !showLoginGate && (
          <FeatureWalkthrough
            mode={featureWalkthroughMode}
            onComplete={completeFeatureWalkthrough}
            onDismiss={dismissFeatureWalkthrough}
          />
        )}

        {deleteAccountOpen &&
          ReactDOM.createPortal(
            <div
              className="delete-account-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
              onClick={(e) => {
                if (e.target === e.currentTarget && deleteAccountPhase === "intro") closeDeleteAccountFlow();
              }}
            >
              <div className="delete-account-modal surface-glass" onClick={(e) => e.stopPropagation()}>
                <div className="delete-account-modal-head">
                  <h2 id="delete-account-title" className="delete-account-title">
                    {firebaseUser?.isAnonymous ? "Delete guest data" : "Delete account"}
                  </h2>
                  <button type="button" className="icon-btn" aria-label="Close" onClick={() => closeDeleteAccountFlow()}>
                    <CloseIcon />
                  </button>
                </div>

                {deleteAccountPhase === "intro" ? (
                  <div className="delete-account-body">
                    <p className="delete-account-lead">
                      This permanently deletes your PROYOU account and synced data from our servers, not a pause or hide.
                    </p>
                    <ul className="delete-account-list">
                      <li>Your schedule, notes, finance entries, habits, and coach profile in sync storage</li>
                      <li>Your sign-in for this app (you can create a new account later if you want)</li>
                    </ul>
                    <p className="settings-hint" style={{ marginBottom: 0 }}>
                      When deletion succeeds, you&apos;ll see a short confirmation, then this device reloads.
                    </p>
                    <div className="delete-account-actions">
                      <button type="button" className="btn" onClick={() => closeDeleteAccountFlow()}>
                        Cancel
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => setDeleteAccountPhase("confirm")}>
                        Continue
                      </button>
                    </div>
                  </div>
                ) : null}

                {deleteAccountPhase === "confirm" ? (
                  <div className="delete-account-body">
                    <p className="delete-account-lead">
                      To confirm, type <strong>{ACCOUNT_DELETE_CONFIRM_PHRASE}</strong> in the box, then tap delete.
                    </p>
                    <label className="label" htmlFor="delete-account-confirm-input">
                      Confirmation
                    </label>
                    <input
                      id="delete-account-confirm-input"
                      className="input"
                      type="text"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={deleteAccountPhrase}
                      onChange={(e) => setDeleteAccountPhrase(e.target.value)}
                      placeholder={ACCOUNT_DELETE_CONFIRM_PHRASE}
                    />
                    <div className="delete-account-actions">
                      <button type="button" className="btn" onClick={() => { setDeleteAccountPhase("intro"); setDeleteAccountPhrase(""); setDeleteAccountError(""); }}>
                        Back
                      </button>
                      <button
                        type="button"
                        className="btn settings-delete-account-btn"
                        disabled={authBusy || deleteAccountPhrase.trim() !== ACCOUNT_DELETE_CONFIRM_PHRASE}
                        onClick={() => void executeAccountDeletion()}
                      >
                        {firebaseUser?.isAnonymous ? "Permanently delete guest data" : "Permanently delete account"}
                      </button>
                    </div>
                  </div>
                ) : null}

                {deleteAccountPhase === "success" ? (
                  <div className="delete-account-body delete-account-success">
                    <p className="delete-account-lead" style={{ marginBottom: 0 }}>
                      <strong>Account removed.</strong> Signing you out and reloading…
                    </p>
                  </div>
                ) : null}

                {deleteAccountPhase === "error" ? (
                  <div className="delete-account-body">
                    <p className="delete-account-inline-error">{deleteAccountError || "Something went wrong."}</p>
                    <div className="delete-account-actions">
                      <button type="button" className="btn" onClick={() => closeDeleteAccountFlow()}>
                        Close
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          setDeleteAccountError("");
                          setDeleteAccountPhrase("");
                          setDeleteAccountPhase("confirm");
                        }}
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body
          )}

      </div>
        </>
      )}
    </div>
  );
}
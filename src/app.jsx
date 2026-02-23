import React, { useEffect, useMemo, useState } from "react";
import { 
  StarIcon, StarEmptyIcon, TrashIcon, SparkleIcon, MoonIcon, CelebrateIcon, WindDownIcon,
  SettingsIcon, CloseIcon, ChevronLeftIcon, ChevronRightIcon, RepeatIcon, CalendarIcon,
  LightEnergyIcon, MediumEnergyIcon, HeavyEnergyIcon, GoodFeelingIcon, NeutralFeelingIcon, HardFeelingIcon, FireIcon, MenuIcon,
  CheckIcon, ArrowRightIcon, FinanceIcon, BulletIcon
} from "./Icons";
import { notificationService } from "./notifications";
import { generateCompletionMessage, checkEnergyBalance } from "./completionRitual";
import { 
  getTimeOfDay, 
  inferEmotionalState, 
  generateReminderMessage,
  generateWindDownMessage,
  getRandomQuote,
  GENTLE_ANCHOR_PROMPT
} from "./gentleAnchor";

/** ====== Config ====== **/
const CATEGORIES = ["RHEA", "EPC", "Personal"];
const STORAGE_KEY = "cute_schedule_v3";
const COACH_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const COACH_STORAGE_KEY = "cute_schedule_coach_meta_v1";
const THEME_STORAGE_KEY = "cute_schedule_theme_v1";
const NOTES_STORAGE_KEY = "cute_schedule_notes_v1";
const PATTERNS_STORAGE_KEY = "cute_schedule_patterns_v1";
const FINANCE_STORAGE_KEY = "cute_schedule_finance_v1";

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

const CATEGORY_TONES = {
  RHEA: {
    tone: "structured",
    style: "direct but supportive",
    example: "This task supports your professional goals."
  },
  EPC: {
    tone: "analytical",
    style: "clear and efficient",
    example: "Let's break this down systematically."
  },
  Personal: {
    tone: "nurturing",
    style: "soft and encouraging",
    example: "Take care of yourself first."
  }
};

// Classy lighter pink theme colors
const THEMES = {
  "Classic Pink": {
    primary: "#F8BBD0",
    secondary: "#F5A6C2",
    accent: "#F48FB1",
    gradient: "linear-gradient(135deg, #F8BBD0 0%, #F5A6C2 50%, #F48FB1 100%)",
    headerGradient: "linear-gradient(135deg, #F48FB1 0%, #F8BBD0 100%)",
    name: "Classic Pink"
  },
  "Rose Gold": {
    primary: "#F4C2C2",
    secondary: "#E8B4B8",
    accent: "#D4A5A5",
    gradient: "linear-gradient(135deg, #F4C2C2 0%, #E8B4B8 50%, #D4A5A5 100%)",
    headerGradient: "linear-gradient(135deg, #D4A5A5 0%, #F4C2C2 100%)",
    name: "Rose Gold"
  },
  "Blush": {
    primary: "#FFE5E5",
    secondary: "#FFD6D6",
    accent: "#FFC7C7",
    gradient: "linear-gradient(135deg, #FFE5E5 0%, #FFD6D6 50%, #FFC7C7 100%)",
    headerGradient: "linear-gradient(135deg, #FFC7C7 0%, #FFE5E5 100%)",
    name: "Blush"
  },
  "Lavender": {
    primary: "#E6D5F7",
    secondary: "#D4B5F0",
    accent: "#C295E9",
    gradient: "linear-gradient(135deg, #E6D5F7 0%, #D4B5F0 50%, #C295E9 100%)",
    headerGradient: "linear-gradient(135deg, #C295E9 0%, #E6D5F7 100%)",
    name: "Lavender"
  },
  "Peach": {
    primary: "#FFE4D6",
    secondary: "#FFD4C4",
    accent: "#FFC4B2",
    gradient: "linear-gradient(135deg, #FFE4D6 0%, #FFD4C4 50%, #FFC4B2 100%)",
    headerGradient: "linear-gradient(135deg, #FFC4B2 0%, #FFE4D6 100%)",
    name: "Peach"
  }
};

const BEDTIME_ROUTINE = [
  { id: "skincare", text: "Skincare routine" },
  { id: "teeth", text: "Brush your teeth" },
  { id: "tea", text: "Make tea" },
  { id: "chill", text: "Read or draw in bed" },
];


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

function prettyToday(d = new Date()) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
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

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeText(s) {
  return String(s || "").trim();
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

function formatDateInput(key) {
  // key is YYYY-MM-DD already
  return key;
}

function addDaysKey(dayKeyStr, deltaDays) {
  const [y, m, d] = dayKeyStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return todayKey(dt);
}

function isSameDayKey(a, b) {
  return String(a) === String(b);
}

/** Simple NL parse for quick add: "Call Martin 11am", "EPC 3pm email Roberto", "RHEA 9am" */
function parseQuickAddNL(str) {
  const s = String(str || "").trim();
  if (!s) return null;
  let hour = "09:00";
  let category = "Personal";
  let text = s;
  const upper = s.toUpperCase();
  const catMatch = upper.match(/^(RHEA|EPC|PERSONAL)\s+/i);
  if (catMatch) {
    category = catMatch[1] === "PERSONAL" ? "Personal" : catMatch[1];
    text = s.slice(catMatch[0].length).trim();
  }
  const timeMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (timeMatch) {
    let h = parseInt(timeMatch[1], 10);
    const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    if (timeMatch[3].toLowerCase() === "pm" && h < 12) h += 12;
    if (timeMatch[3].toLowerCase() === "am" && h === 12) h = 0;
    hour = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    text = text.replace(timeMatch[0], "").replace(/\s+/g, " ").trim();
  }
  if (!text) text = s;
  return { hour, category, text };
}

function getDayLabel(dayKey, todayKey) {
  if (isSameDayKey(dayKey, todayKey)) {
    return null; // Will show as "Today"
  }
  
  const tomorrowKey = addDaysKey(todayKey, 1);
  if (isSameDayKey(dayKey, tomorrowKey)) {
    return "Tomorrow";
  }
  
  // Check if it's in the future (after tomorrow)
  const [y, m, d] = dayKey.split("-").map(Number);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const dayDate = new Date(y, m - 1, d);
  const todayDate = new Date(ty, tm - 1, td);
  const tomorrowDate = new Date(ty, tm - 1, td + 1);
  
  if (dayDate.getTime() > tomorrowDate.getTime()) {
    return "Future";
  }
  
  // Past date - return null to show formatted date
  return null;
}

function allTasksInDay(hours) {
  const hourEntries = Object.entries(hours || {});
  return hourEntries.flatMap(([hourKey, tasksByCat]) => {
    return CATEGORIES.flatMap((cat) => {
      return (tasksByCat[cat] || []).map(task => ({
        ...task,
        hour: hourKey,
        category: cat
      }));
    });
  });
}

function hourIsComplete(tasksByCat) {
  const tasks = CATEGORIES.flatMap((c) => tasksByCat?.[c] || []);
  if (tasks.length === 0) return false;
  return tasks.every((t) => t.done);
}

function dayProgress(hours) {
  const tasks = allTasksInDay(hours);
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

function dayIsStarred(hours) {
  const { total, done } = dayProgress(hours);
  return total > 0 && done === total;
}

function getProgressCopy(pct) {
  if (pct === 0) return "Pick one small win";
  if (pct >= 100) return "You showed up today";
  if (pct >= 1 && pct <= 40) return "Momentum started";
  if (pct >= 41 && pct <= 80) return "You're on a roll";
  if (pct >= 81 && pct <= 99) return "Close it out";
  return "Momentum started";
}

/** ====== Pattern Tracking ====== **/
function loadPatterns() {
  try {
    const raw = localStorage.getItem(PATTERNS_STORAGE_KEY);
    const out = raw ? JSON.parse(raw) : {
      completions: [], skippedDays: {}, completionTimes: [], weeklyTotals: {}, bedtimeCompletedDates: []
    };
    if (!Array.isArray(out.bedtimeCompletedDates)) out.bedtimeCompletedDates = [];
    return out;
  } catch {
    return { completions: [], skippedDays: {}, completionTimes: [], weeklyTotals: {}, bedtimeCompletedDates: [] };
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
  
  patterns.completions.push({
    dayKey,
    taskId: task.id,
    category,
    hour,
    completedAt: completedAt.toISOString(),
    feeling,
    dayOfWeek,
    hourNum
  });
  
  patterns.completionTimes.push({ hour: hourNum, dayOfWeek });
  
  // Keep last 100 completions
  if (patterns.completions.length > 100) {
    patterns.completions = patterns.completions.slice(-100);
  }
  if (patterns.completionTimes.length > 100) {
    patterns.completionTimes = patterns.completionTimes.slice(-100);
  }
  
  savePatterns(patterns);
}

/** Call when user completes full bedtime routine (all items done) for ADHD sleep correlation */
function trackBedtimeComplete(dayKey) {
  const patterns = loadPatterns();
  const list = patterns.bedtimeCompletedDates || [];
  if (list.includes(dayKey)) return;
  patterns.bedtimeCompletedDates = [...list, dayKey].slice(-60); // keep last 60 days
  savePatterns(patterns);
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

/** ====== UI Components ====== **/
function Pill({ label }) {
  const cls =
    label === "RHEA"
      ? "pill pill-rhea"
      : label === "EPC"
      ? "pill pill-epc"
      : "pill pill-personal";
  return <span className={cls}>{label}</span>;
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

// Ultra-minimal hour card with Do/Plan mode
function HourCard({ hourKey, tasksByCat, onToggleTask, onToggleEnergyLevel, onDeleteTask, onDeleteHour, onMoveToTomorrow, onShowDropdown, taskDropdown, expandedTaskKey, onExpandTask, mode = "do" }) {
  const complete = hourIsComplete(tasksByCat);
  const [open, setOpen] = useState(true);

  const allTasks = useMemo(() => {
    return CATEGORIES.flatMap((cat) => 
      (tasksByCat?.[cat] || []).map(t => ({ ...t, category: cat }))
    ).sort((a, b) => {
      // Sort by energy level: Heavy first, then Medium, then Light
      const order = { HEAVY: 0, MEDIUM: 1, LIGHT: 2 };
      const aEnergy = order[a.energyLevel] ?? 1;
      const bEnergy = order[b.energyLevel] ?? 1;
      return aEnergy - bEnergy;
    });
  }, [tasksByCat]);

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

        {mode === "plan" && (
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
                      {mode === "plan" ? <Pill label={t.category} /> : null}
                      {mode === "plan" && (
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
                  {mode === "plan" && (
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
                  
                  {!t.done && (
                    <>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Task options"
                        onClick={(e) => {
                          e.stopPropagation();
                          const dropdownKey = `${hourKey}-${t.category}-${t.id}`;
                          if (taskDropdown === dropdownKey) {
                            onShowDropdown(null);
                          } else {
                            onShowDropdown(dropdownKey);
                          }
                        }}
                      >
                        <MenuIcon />
                      </button>
                      
                      {taskDropdown === `${hourKey}-${t.category}-${t.id}` && (
                        <div className="task-dropdown" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="dropdown-item"
                            onClick={() => {
                              onMoveToTomorrow(hourKey, t.category, t.id);
                            }}
                          >
                            <CalendarIcon style={{ marginRight: '8px' }} />
                            Move to tomorrow
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            onClick={() => {
                              onDeleteTask(hourKey, t.category, t.id);
                              onShowDropdown(null);
                            }}
                          >
                            <FireIcon style={{ marginRight: '8px' }} />
                            Let it go
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            onClick={() => {
                              onShowDropdown(null);
                            }}
                          >
                            Keep as is
                          </button>
                        </div>
                      )}
                    </>
                  )}
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
                      <Pill label={t.category} />
                      <span className="item-detail-time">{to12Hour(hourKey)}</span>
                      {mode === "plan" && (
                        <span className="energy-badge" style={{ fontSize: '12px', color: ENERGY_LEVELS[t.energyLevel || "MEDIUM"].color }}>
                          {React.createElement(ENERGY_LEVELS[t.energyLevel || "MEDIUM"].icon, { style: { width: 12, height: 12 } })}
                          {ENERGY_LEVELS[t.energyLevel || "MEDIUM"].label}
                        </span>
                      )}
                    </div>
                    <div className="item-detail-actions">
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

function BedtimeRoutine({ routine, onToggle, allTasksDone }) {
  const allDone = (routine || []).every((r) => r.done);
  const timeOfDay = getTimeOfDay();
  
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

/** ====== Main App ====== **/
export default function App() {
  const [tab, setTab] = useState("today");
  const realTodayKey = todayKey();
  const [selectedDayKey, setSelectedDayKey] = useState(realTodayKey);
  const tKey = selectedDayKey;
  const [mode, setMode] = useState("do"); // "do" | "plan"

  const [state, setState] = useState(() => {
    const saved = loadState();
    if (saved) return saved;
    return {
      days: {},
      monthly: [],
      bedtimeRoutine: BEDTIME_ROUTINE.map((r) => ({ ...r, done: false })),
      notes: [],
    };
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

  // Notes state
  const [notes, setNotes] = useState(() => {
    try {
      const saved = localStorage.getItem(NOTES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Finance state
  const [finance, setFinance] = useState(() => {
    try {
      const saved = localStorage.getItem(FINANCE_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        return {
          incomeEntries: data.incomeEntries || [],
          expenseEntries: data.expenseEntries || [],
          totalSavings: typeof data.totalSavings === "number" ? data.totalSavings : 0,
          totalDebt: typeof data.totalDebt === "number" ? data.totalDebt : 0,
          wishList: data.wishList || [],
          subscriptions: data.subscriptions || [],
          bankStatementNotes: data.bankStatementNotes || "",
        };
      }
    } catch (_) {}
    return {
      incomeEntries: [],
      expenseEntries: [],
      totalSavings: 0,
      totalDebt: 0,
      wishList: [],
      subscriptions: [],
      bankStatementNotes: "",
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(finance));
    } catch (_) {}
  }, [finance]);

  const [noteSearch, setNoteSearch] = useState("");
  const [financeQuickInput, setFinanceQuickInput] = useState("");
  const [newWishLabel, setNewWishLabel] = useState("");
  const [newWishTarget, setNewWishTarget] = useState("");
  const [newSubName, setNewSubName] = useState("");
  const [newSubAmount, setNewSubAmount] = useState("");
  const [newSubCycle, setNewSubCycle] = useState("monthly");
  const [showSettings, setShowSettings] = useState(false);
  const [completionCelebration, setCompletionCelebration] = useState(null);
  const [toastNotification, setToastNotification] = useState(null);
  const [taskFeeling, setTaskFeeling] = useState(null);
  const [missedTasks, setMissedTasks] = useState([]);
  const [windDownMode, setWindDownMode] = useState(false);
  const [morningGreeting, setMorningGreeting] = useState(false);
  const [taskDropdown, setTaskDropdown] = useState(null); // { hourKey, category, taskId }
  const [expandedTaskKey, setExpandedTaskKey] = useState(null); // "hourKey-category-id" for expandable detail
  const [focusMode, setFocusMode] = useState(false);
  const [quickAddValue, setQuickAddValue] = useState("");
  const [taskBanner, setTaskBanner] = useState(null); // { type: 'start'|'wrapup', task, nextTask?, hourKey }
  
  // Define todayHours before useEffects that use it
  const todayHours = state.days?.[tKey]?.hours || {};

  // Coach meta for cooldown and auto-run
  const [coachMeta, setCoachMeta] = useState(() => {
    try {
      const raw = localStorage.getItem(COACH_STORAGE_KEY);
      return raw ? JSON.parse(raw) : { lastCoachAt: 0, lastProgressAt: Date.now(), lastAutoDayKey: "" };
    } catch {
      return { lastCoachAt: 0, lastProgressAt: Date.now(), lastAutoDayKey: "" };
    }
  });

  const [coachOpen, setCoachOpen] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState("");
  const [coachResult, setCoachResult] = useState(null);
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachConversation, setCoachConversation] = useState([]);
  const [coachMode, setCoachMode] = useState("plan"); // "plan" | "unstuck" | "review"
  const [coachStructuredResult, setCoachStructuredResult] = useState(null); // { summary, followUp, actions }
  const [sprintEndsAt, setSprintEndsAt] = useState(null); // timestamp; when set, 10-min sprint is active
  const [sprintTick, setSprintTick] = useState(0); // force re-render every second during sprint

  useEffect(() => {
    localStorage.setItem(COACH_STORAGE_KEY, JSON.stringify(coachMeta));
  }, [coachMeta]);

  // Only add a day when it's missing — never overwrite existing (keeps future-day tasks persisted)
  useEffect(() => {
    setState((prev) => {
      if (prev.days != null && prev.days[tKey] != null) return prev;
      return { ...prev, days: { ...prev.days, [tKey]: { hours: {} } } };
    });
  }, [tKey]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    document.documentElement.style.setProperty('--theme-primary', theme.primary);
    document.documentElement.style.setProperty('--theme-secondary', theme.secondary);
    document.documentElement.style.setProperty('--theme-accent', theme.accent);
    document.documentElement.style.setProperty('--theme-gradient', theme.gradient);
    document.documentElement.style.setProperty('--theme-header-gradient', theme.headerGradient);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  // Request notification permission on mount
  useEffect(() => {
    notificationService.checkPermission();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (taskDropdown && !e.target.closest('.task-dropdown') && !e.target.closest('.icon-btn')) {
        setTaskDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [taskDropdown]);

  // Morning greeting ritual
  useEffect(() => {
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
  }, [tKey, realTodayKey]);

  // Monitor tasks and schedule transition notifications
  useEffect(() => {
    if (!isSameDayKey(tKey, realTodayKey)) return;
    
    const allTasks = allTasksInDay(todayHours);
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
  }, [tKey, realTodayKey, todayHours, state]);

  const sortedHourKeys = useMemo(() => Object.keys(todayHours).sort(), [todayHours]);

  const dailyMood = state.days?.[tKey]?.dailyMood || null;
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

  // In-app banner: every 20s, current/next task → Start / Snooze / Skip or Wrap it up
  useEffect(() => {
    if (tab !== "today" || !isSameDayKey(tKey, realTodayKey)) return;
    const SNOOZE_KEY = "taskBannerSnoozeUntil";
    const run = () => {
      const snoozeUntil = parseInt(localStorage.getItem(SNOOZE_KEY) || "0", 10);
      if (Date.now() < snoozeUntil) return;
      const now = new Date();
      const nowM = now.getHours() * 60 + now.getMinutes();
      const tasks = allTasksInDay(todayHours);
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
  }, [tab, tKey, realTodayKey, todayHours]);

  const prog = useMemo(() => dayProgress(todayHours), [todayHours]);
  const starred = useMemo(() => dayIsStarred(todayHours), [todayHours]);
  const patternInsights = useMemo(() => analyzePatterns(), [prog.done, prog.total, state.bedtimeRoutine]);

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
    const routine = state.bedtimeRoutine || [];
    if (routine.length === 0) return;
    const allDone = routine.every((r) => r.done);
    if (allDone && starred) trackBedtimeComplete(realTodayKey);
  }, [state.bedtimeRoutine, starred, tKey, realTodayKey]);

  // Update lastProgressAt whenever tasks change
  useEffect(() => {
    setCoachMeta((prev) => ({ ...prev, lastProgressAt: Date.now() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function ensureHour(hourKey) {
    setState((prev) => {
      const day = prev.days[tKey] || { hours: {} };
      const hours = day.hours || {};
      if (hours[hourKey]) return prev;

      const empty = { RHEA: [], EPC: [], Personal: [] };
      return { ...prev, days: { ...prev.days, [tKey]: { ...(prev.days[tKey] || {}), hours: { ...hours, [hourKey]: empty } } } };
    });
  }

  function addTask(hourKey, category, text, repeatType = REPEAT_OPTIONS.NONE, sourceTaskId = null) {
    setState((prev) => {
      const day = prev.days[tKey] || { hours: {} };
      const hours = { ...(day.hours || {}) };
      const byCat = hours[hourKey] || { RHEA: [], EPC: [], Personal: [] };

      const nextTask = { 
        id: uid(), 
        text, 
        done: false, 
        energyLevel: "MEDIUM", 
        completedAt: null, 
        feeling: null,
        repeat: repeatType,
        repeatUntil: repeatType !== REPEAT_OPTIONS.NONE ? null : null,
        originalTaskId: sourceTaskId,
        createdAt: new Date().toISOString()
      };
      const nextByCat = { ...byCat, [category]: [...(byCat[category] || []), nextTask] };

      hours[hourKey] = nextByCat;
      
      // Save to repeated tasks if marked for repetition
      if (repeatType !== REPEAT_OPTIONS.NONE) {
        const repeatedTasks = JSON.parse(localStorage.getItem('repeatedTasks') || '[]');
        repeatedTasks.push({
          ...nextTask,
          category,
          hour: hourKey
        });
        localStorage.setItem('repeatedTasks', JSON.stringify(repeatedTasks));
      }
      
      // Schedule notification for task reminder
      if (isSameDayKey(tKey, realTodayKey)) {
        notificationService.scheduleTaskReminder(nextTask, hourKey, category);
      }
      
      return { ...prev, days: { ...prev.days, [tKey]: { ...(prev.days[tKey] || {}), hours } } };
    });
  }

  // Get past repeated tasks
  function getPastRepeatedTasks(category = null) {
    try {
      const repeatedTasks = JSON.parse(localStorage.getItem('repeatedTasks') || '[]');
      return repeatedTasks.filter(task => {
        if (category && task.category !== category) return false;
        // Filter by repeat type
        return task.repeat !== REPEAT_OPTIONS.NONE;
      });
    } catch {
      return [];
    }
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
    setState((prev) => {
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
            const currentlyDone = allTasksInDay(todayHours).filter(task => task.done && task.id !== taskId).length;
            const completedToday = currentlyDone + 1; // +1 for this task
            const energyLevel = t.energyLevel || "MEDIUM";
            const allTasksList = allTasksInDay(todayHours);
            const state = inferEmotionalState(allTasksList, getTimeOfDay());
            
            // Generate contextual completion message using Gentle Anchor
            const message = generateCompletionMessage(t, category, completedToday, energyLevel, state);
            
            // Show toast only (mood is collected end-of-day, not per task)
            setCompletionCelebration(null);
            
            // Show toast notification that auto-dismisses
            setToastNotification({
              message,
              taskText: t.text,
              type: 'completion'
            });
            
            // Auto-dismiss after 3 seconds
            setTimeout(() => {
              setToastNotification(null);
            }, 3000);
            
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

  function toggleEnergyLevel(hourKey, category, taskId) {
    setState((prev) => {
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

  function saveTaskFeeling(taskId, feeling) {
    setState((prev) => {
      const day = prev.days[tKey];
      if (!day) return prev;
      const hours = { ...(day.hours || {}) };
      
      Object.keys(hours).forEach(hourKey => {
        Object.keys(hours[hourKey]).forEach(cat => {
          const list = hours[hourKey][cat].map(t => {
            if (t.id === taskId) {
              // Update feeling and re-track with feeling
              if (t.completedAt && !t.feeling) {
                trackTaskCompletion(t, cat, hourKey, tKey, feeling);
              }
              return { ...t, feeling };
            }
            return t;
          });
          hours[hourKey][cat] = list;
        });
      });
      
      return { ...prev, days: { ...prev.days, [tKey]: { ...(prev.days[tKey] || {}), hours } } };
    });
    setTaskFeeling(null);
    setCompletionCelebration(null);
  }

  function setDailyMood(mood) {
    setState((prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [tKey]: { ...(prev.days[tKey] || {}), hours: prev.days[tKey]?.hours || {}, dailyMood: mood },
      },
    }));
  }
  function setDailyCapacity(cap) {
    setState((prev) => ({
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
  function addFinanceEntry(type, amount, label = null) {
    const entry = { id: uid(), amount, label, dateISO: new Date().toISOString() };
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
  function addSubscription(name, amount, cycle = "monthly") {
    setFinance((prev) => ({
      ...prev,
      subscriptions: [...(prev.subscriptions || []), { id: uid(), name, amount: parseFloat(amount) || 0, cycle }],
    }));
  }
  function removeSubscription(id) {
    setFinance((prev) => ({ ...prev, subscriptions: (prev.subscriptions || []).filter((s) => s.id !== id) }));
  }

  function deleteTask(hourKey, category, taskId) {
    setState((prev) => {
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
    // Find the task
    const day = state.days[tKey];
    if (!day) return;
    const hours = day.hours || {};
    const byCat = hours[hourKey];
    if (!byCat) return;
    const task = (byCat[category] || []).find((t) => t.id === taskId);
    if (!task) return;

    // Delete from current day
    deleteTask(hourKey, category, taskId);

    // Add to tomorrow at 9:00 AM
    const tomorrowKey = addDaysKey(realTodayKey, 1);
    const tomorrowHour = "09:00";
    
    setState((prev) => {
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
          [tomorrowKey]: { hours: tomorrowHours }
        }
      };
    });

    setTaskDropdown(null);
  }

  function deleteHour(hourKey) {
    setState((prev) => {
      const day = prev.days[tKey];
      if (!day) return prev;
      const hours = { ...(day.hours || {}) };
      delete hours[hourKey];
      return { ...prev, days: { ...prev.days, [tKey]: { hours } } };
    });
  }

  const [newHour, setNewHour] = useState("09:00");
  const [quickCat, setQuickCat] = useState("Personal");
  const [quickText, setQuickText] = useState("");
  const [quickRepeat, setQuickRepeat] = useState(REPEAT_OPTIONS.NONE);
  const [showPastRepeats, setShowPastRepeats] = useState(false);

  function quickAdd(e) {
    e.preventDefault();
    const clean = normalizeText(quickText);
    if (!clean) return;
    ensureHour(newHour);
    addTask(newHour, quickCat, clean, quickRepeat);
  }

  function quickAddFromNL(e) {
    e.preventDefault();
    const parsed = parseQuickAddNL(quickAddValue);
    if (!parsed || !parsed.text) return;
    ensureHour(parsed.hour);
    addTask(parsed.hour, parsed.category, parsed.text);
    setQuickAddValue("");
    
    // Show success toast
    setToastNotification({
      message: "Task added",
      taskText: clean,
      type: 'added'
    });
    
    setTimeout(() => {
      setToastNotification(null);
    }, 2500);
    
    setQuickText("");
    setQuickRepeat(REPEAT_OPTIONS.NONE);
  }

  const [monthlyText, setMonthlyText] = useState("");
  function addMonthly(e) {
    e.preventDefault();
    const clean = normalizeText(monthlyText);
    if (!clean) return;
    setState((prev) => ({ ...prev, monthly: [...prev.monthly, { id: uid(), text: clean, done: false }] }));
    setMonthlyText("");
  }
  function toggleMonthly(id) {
    setState((prev) => ({ ...prev, monthly: prev.monthly.map((m) => (m.id === id ? { ...m, done: !m.done } : m)) }));
  }
  function deleteMonthly(id) {
    setState((prev) => ({ ...prev, monthly: prev.monthly.filter((m) => m.id !== id) }));
  }

  function toggleBedtime(id) {
    setState((prev) => ({
      ...prev,
      bedtimeRoutine: prev.bedtimeRoutine.map((r) => (r.id === id ? { ...r, done: !r.done } : r)),
    }));
  }

  // Notes functions
  const [newNote, setNewNote] = useState("");
  function addNote(e) {
    e.preventDefault();
    const clean = normalizeText(newNote);
    if (!clean) return;
    const note = { id: uid(), text: clean, createdAt: new Date().toISOString() };
    setNotes((prev) => [...prev, note]);
    setNewNote("");
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

  async function askCoach(userQuestion = null) {
    if (coachLocked && !userQuestion) return;
    
    setCoachError("");
    setCoachLoading(true);

    try {
      const allTasks = allTasksInDay(todayHours);
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
      
      const payload = {
        systemPrompt: GENTLE_ANCHOR_PROMPT,
        dayKey: tKey,
        prettyDate: new Date(tKey + "T00:00:00").toLocaleDateString(),
        progress: prog,
        today: todayHours,
        monthly: state.monthly || [],
        notes: notes || [],
        categories: CATEGORIES,
        timeOfDay,
        emotionalState,
        completedToday,
        totalTasks,
        energyBalance: checkEnergyBalance(todayHours),
        userQuestion: userQuestion || null,
        conversation: userQuestion ? coachConversation : [],
        patterns: {
          bestTime: patterns.bestTime,
          leastCompletedCategory: patterns.leastCompletedCategory,
          leastCompletedRate: patterns.leastCompletedRate,
          todayCompletions: patterns.todayCompletions,
          totalCompletions: patterns.totalCompletions
        },
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
          return {
            incomeThisMonth,
            spentThisMonth,
            totalSavings: finance.totalSavings || 0,
            totalDebt: finance.totalDebt || 0,
            subscriptions: finance.subscriptions || [],
            wishList: finance.wishList || [],
            bankStatementNotes: (finance.bankStatementNotes || "").slice(0, 2000),
          };
        })(),
      };

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Fallback to local gentle responses if API fails
        const localResponse = generateLocalGentleResponse(emotionalState, prog, completedToday, totalTasks);
        setCoachResult(localResponse);
        setCoachMeta((prev) => ({ ...prev, lastCoachAt: Date.now() }));
        setCoachLoading(false);
        return;
      }

      const shaped = {
        message: data?.message || "",
        highlights: data?.highlights || [],
        suggestions: (data?.suggestions || []).map((x) => ({
          id: x.id || uid(),
          hour: x.hour || "09:00",
          category: x.category || "Personal",
          text: x.text || "",
        })),
        ignoredMonthlies: (data?.ignoredMonthlies || []).map((x) => ({
          id: x.id || uid(),
          text: x.text || String(x),
        })),
        percentSummary: data?.percentSummary || "",
      };

      // Add AI response to conversation if it was a question
      if (userQuestion) {
        setCoachConversation(prev => [...prev, { role: 'assistant', content: shaped.message }]);
        // Don't show structured result for questions - just conversation
        setCoachResult(null);
      } else {
        setCoachResult(shaped);
      }
      
      setCoachMeta((prev) => ({ ...prev, lastCoachAt: Date.now() }));
    } catch (err) {
      // Fallback to local responses
      const allTasks = allTasksInDay(todayHours);
      const emotionalState = inferEmotionalState(allTasks, getTimeOfDay());
      const completedToday = allTasks.filter(t => t.done).length;
      const localResponse = generateLocalGentleResponse(emotionalState, prog, completedToday, allTasks.length);
      setCoachResult(localResponse);
    } finally {
      setCoachLoading(false);
    }
  }

  function handleCoachQuestion(e) {
    e.preventDefault();
    const question = normalizeText(coachQuestion);
    if (!question) return;
    
    askCoach(question);
    setCoachQuestion("");
  }

  function generateLocalGentleResponse(state, progress, completed, total) {
    let message = "";
    const highlights = [];
    
    if (state === "overloaded") {
      message = "You have a lot planned today. We can adjust if needed.";
      highlights.push("Consider moving some tasks to tomorrow");
      highlights.push("Heavy tasks need space between them");
    } else if (state === "drained") {
      message = "You've been working. It's okay to slow down.";
      highlights.push("Rest is part of the process");
    } else if (state === "focused") {
      message = "You're in a good flow. Keep going when it feels right.";
      highlights.push("You're making steady progress");
    } else if (completed >= 3) {
      message = "You did enough for today. The rest can wait.";
    } else if (total === 0) {
      message = "No tasks planned yet. When you're ready, we can add some.";
    } else {
      message = "Here's where things stand. What feels doable?";
    }
    
    return {
      message,
      highlights,
      suggestions: [],
      ignoredMonthlies: [],
      percentSummary: total > 0 ? `${completed}/${total} completed` : ""
    };
  }

  function acceptCoachSuggestion(s) {
    const hour = s?.hour || "09:00";
    const cat = CATEGORIES.includes(s?.category) ? s.category : "Personal";
    const text = normalizeText(s?.text);
    if (!text) return;
    ensureHour(hour);
    addTask(hour, cat, text);
    setCoachOpen(false);
  }

  async function callCoach(adhdMode) {
    setCoachError("");
    setCoachLoading(true);
    setCoachStructuredResult(null);
    try {
      const allTasks = allTasksInDay(todayHours);
      const tasksForApi = allTasks.map((t) => ({ id: t.id, text: t.text, hour: t.hour, category: t.category, done: t.done }));
      const payload = {
        dayKey: tKey,
        today: todayHours,
        tasks: tasksForApi,
        schedule: todayHours,
        progress: prog,
        mood: state.days?.[tKey]?.dailyMood || null,
        patterns: analyzePatterns(),
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
          totalDebt: finance.totalDebt || 0,
          subscriptions: finance.subscriptions || [],
          wishList: finance.wishList || [],
        },
      };
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, mode: adhdMode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCoachError(data?.error || "Something went wrong");
        return;
      }
      setCoachStructuredResult({
        summary: data.summary || "",
        followUp: data.followUp || null,
        actions: Array.isArray(data.actions) ? data.actions : [],
      });
    } catch (err) {
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
    const dayTasks = allTasksInDay(todayHours);
    actions.forEach((action) => {
      if (action.type === "TIMEBOX" && action.taskId && action.start != null) {
        const task = dayTasks.find((t) => t.id === action.taskId);
        if (task) {
          const hourKey = String(action.start).length === 5 ? action.start : `${String(action.start).padStart(2, "0")}:00`;
          ensureHour(hourKey);
          setState((prev) => {
            const day = prev.days[tKey];
            if (!day) return prev;
            const hours = {};
            Object.entries(day.hours || {}).forEach(([hk, byCat]) => {
              hours[hk] = {};
              CATEGORIES.forEach((cat) => {
                hours[hk][cat] = (byCat[cat] || []).filter((t) => t.id !== action.taskId);
              });
            });
            if (!hours[hourKey]) hours[hourKey] = { RHEA: [], EPC: [], Personal: [] };
            hours[hourKey][task.category] = [...(hours[hourKey][task.category] || []), { ...task, hour: hourKey }];
            return { ...prev, days: { ...prev.days, [tKey]: { ...day, hours } } };
          });
        }
      }
      if (action.type === "REORDER" && Array.isArray(action.taskIds) && action.taskIds.length > 0) {
        const tasks = action.taskIds.map((id) => dayTasks.find((t) => t.id === id)).filter(Boolean);
        if (tasks.length > 0) {
          setState((prev) => {
            const day = prev.days[tKey];
            if (!day) return prev;
            const hours = {};
            const ids = new Set(action.taskIds);
            Object.entries(day.hours || {}).forEach(([hk, byCat]) => {
              hours[hk] = {};
              CATEGORIES.forEach((cat) => {
                hours[hk][cat] = (byCat[cat] || []).filter((t) => !ids.has(t.id));
              });
            });
            tasks.forEach((t) => {
              const h = t.hour;
              if (!hours[h]) hours[h] = { RHEA: [], EPC: [], Personal: [] };
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
    return allTasksInDay(todayHours).filter(t => !t.done).sort((a, b) => {
      // Sort by energy level: Heavy first
      const order = { HEAVY: 0, MEDIUM: 1, LIGHT: 2 };
      const aEnergy = order[a.energyLevel] ?? 1;
      const bEnergy = order[b.energyLevel] ?? 1;
      if (aEnergy !== bEnergy) return aEnergy - bEnergy;
      return a.hour.localeCompare(b.hour);
    });
  }, [todayHours]);

  return (
    <div className="app">
      <div
        className="shell"
        data-mood={tab === "today" && isSameDayKey(tKey, realTodayKey) ? (state.days?.[tKey]?.dailyMood || "") : ""}
      >
        <header className="top surface-glass">
          <div className="top-inner">
            <div className="top-left">
              <h1 className="h1" style={{ fontSize: "var(--text-display)", fontWeight: 700 }}>
                {(() => {
                  if (tab === "today") {
                    if (isSameDayKey(tKey, realTodayKey)) return "Today";
                    const label = getDayLabel(tKey, realTodayKey);
                    if (label === "Tomorrow") return "Tomorrow";
                    if (label === "Future") return "Future";
                    return "Past";
                  }
                  return tab === "monthly" ? "Calendar" 
                    : tab === "list" ? "List" 
                    : tab === "notes" ? "Notes" 
                    : tab === "finance" ? "Finance" 
                    : "Pattern insights";
                })()}
              </h1>
              <span className="sub">
                {tab === "today" || tab === "list"
                  ? (() => {
                      const label = getDayLabel(tKey, realTodayKey);
                      if (label === "Tomorrow" || label === "Future") return "";
                      return new Date(tKey + "T00:00:00").toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      });
                    })()
                  : tab === "monthly" ? "Objectives" 
                  : tab === "finance" ? "Income, spending & savings" 
                  : "Insights"}
              </span>
            </div>

            <div className="tabs" aria-hidden="true">
              <TabButton active={tab === "today"} onClick={() => setTab("today")}>Today</TabButton>
              <TabButton active={tab === "list"} onClick={() => setTab("list")}>List</TabButton>
              <TabButton active={tab === "monthly"} onClick={() => setTab("monthly")}>Monthly</TabButton>
              <TabButton active={tab === "coach"} onClick={() => setTab("coach")}>Pattern insights</TabButton>
              <TabButton active={tab === "notes"} onClick={() => setTab("notes")}>Notes</TabButton>
              <TabButton active={tab === "finance"} onClick={() => setTab("finance")}>Finance</TabButton>
            </div>

            <div className="top-actions">
              {tab === "today" && (
                <button
                  type="button"
                  className="btn btn-pill"
                  onClick={() => setFocusMode((f) => !f)}
                  title="Focus mode"
                  aria-pressed={focusMode}
                >
                  <SparkleIcon style={{ width: 14, height: 14, flexShrink: 0 }} aria-hidden />
                  {focusMode ? "Focus on" : "Reset available"}
                </button>
              )}
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowSettings(true)}
                title="Settings"
                aria-label="Settings"
              >
                <SettingsIcon style={{ width: 22, height: 22 }} />
              </button>
            </div>
          </div>
        </header>

        {/* Bottom navigation — frosted dock, active-tab pill */}
        <nav className="bottom-nav surface-dock" aria-label="Main">
          <button type="button" className={`bottom-nav-item ${tab === "today" ? "active" : ""}`} onClick={() => setTab("today")} aria-current={tab === "today" ? "page" : undefined}>
            <CalendarIcon style={{ width: 22, height: 22 }} />
            Today
          </button>
          <button type="button" className={`bottom-nav-item ${tab === "list" ? "active" : ""}`} onClick={() => setTab("list")} aria-current={tab === "list" ? "page" : undefined}>
            <MenuIcon style={{ width: 22, height: 22 }} />
            List
          </button>
          <button type="button" className={`bottom-nav-item ${tab === "monthly" ? "active" : ""}`} onClick={() => setTab("monthly")} aria-current={tab === "monthly" ? "page" : undefined}>
            <CalendarIcon style={{ width: 22, height: 22 }} />
            Calendar
          </button>
          <button type="button" className={`bottom-nav-item ${tab === "coach" ? "active" : ""}`} onClick={() => setTab("coach")} aria-current={tab === "coach" ? "page" : undefined}>
            <SparkleIcon style={{ width: 22, height: 22 }} />
            Coach
          </button>
          <button type="button" className={`bottom-nav-item ${tab === "notes" ? "active" : ""}`} onClick={() => setTab("notes")} aria-current={tab === "notes" ? "page" : undefined}>
            <MoonIcon style={{ width: 22, height: 22 }} />
            Notes
          </button>
          <button type="button" className={`bottom-nav-item ${tab === "finance" ? "active" : ""}`} onClick={() => setTab("finance")} aria-current={tab === "finance" ? "page" : undefined}>
            <FinanceIcon style={{ width: 22, height: 22 }} />
            Finance
          </button>
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

        {(tab === "today" || tab === "list") && (
          <div className="date-controls date-control-group">
            <div className="date-controls-top">
              <button className="btn-icon" type="button" onClick={() => setSelectedDayKey((k) => addDaysKey(k, -1))} aria-label="Previous day">
                <ChevronLeftIcon style={{ width: 20, height: 20 }} />
              </button>

              <input
                className="input date-input date-pill"
                type="date"
                value={formatDateInput(selectedDayKey)}
                onChange={(e) => {
                  const v = (e.target.value || "").trim();
                  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) setSelectedDayKey(v);
                }}
                aria-label="Selected date"
              />

              <button className="btn-icon" type="button" onClick={() => setSelectedDayKey((k) => addDaysKey(k, 1))} aria-label="Next day">
                <ChevronRightIcon style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <div className="date-controls-bottom">
              <button
                className="btn"
                type="button"
                onClick={() => setSelectedDayKey(realTodayKey)}
                disabled={isSameDayKey(selectedDayKey, realTodayKey)}
              >
                Today
              </button>

              {tab === "today" && (
                <div className="segmented-control" role="tablist" aria-label="View mode">
                  <button
                    role="tab"
                    aria-selected={mode === "do"}
                    type="button"
                    onClick={() => setMode("do")}
                    title="Do mode — clean checkboxes"
                  >
                    Do
                  </button>
                  <button
                    role="tab"
                    aria-selected={mode === "plan"}
                    type="button"
                    onClick={() => setMode("plan")}
                    title="Plan mode — edit and organize"
                  >
                    Plan
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "today" ? (
          <>
            {/* Quick Add — input group with focus ring, CTA disabled until input */}
            <form className="input-group quick-add-bar" onSubmit={quickAddFromNL}>
              <input
                className="input quick-add-input"
                type="text"
                value={quickAddValue}
                onChange={(e) => setQuickAddValue(e.target.value)}
                placeholder="Add a task… e.g. Call Martin 11am, EPC 3pm"
                aria-label="Quick add task"
              />
              <button type="submit" className="btn-primary" disabled={!quickAddValue.trim()} aria-label="Add task">
                Add
              </button>
            </form>

            {/* Next Up — featured card: icon badge, title, time + tags, gradient Prep CTA */}
            {(() => {
              const nextTasks = incompleteTasks.slice(0, 1);
              const next = nextTasks[0];
              return (
                <div className="next-up-card surface-featured">
                  <div className="next-up-card-inner">
                    <div className="next-up-icon-badge">
                      <CalendarIcon style={{ width: 18, height: 18 }} aria-hidden />
                    </div>
                    <div className="next-up-label">Next up</div>
                    {next ? (
                      <>
                        <div className="next-up-task">{next.text}</div>
                        <div className="next-up-meta">{to12Hour(next.hour)} · {next.category}</div>
                      </>
                    ) : (
                      <div className="next-up-task next-up-task-muted">Pick one small win</div>
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

            <section className="panel panel-hero daily-progress-card surface-glass">
              <div className="panel-top">
                <div className="panel-title">
                  <div className="panel-title-row">
                    <span className="title">Daily Progress</span>
                    <span className={starred ? (starPulse ? "star star-pulse" : "star") : "star star-dim"}>
                      {starred ? <StarIcon filled style={{ display: 'inline-block' }} /> : <StarEmptyIcon style={{ display: 'inline-block' }} />}
                    </span>
                  </div>
                  <div className="meta daily-progress-copy">
                    {getProgressCopy(prog.pct)}
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
                  <p className="state-empty">No tasks yet. Add one to get started.</p>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary daily-progress-chip"
                    onClick={() => document.querySelector(".quick-add-input")?.focus()}
                  >
                    Pick one small win
                  </button>
                </div>
              )}

              {mode === "plan" && (
                <form className="quick" onSubmit={quickAdd}>
                  <div className="quick-row">
                    <label className="label">Hour</label>
                    <input className="input" type="time" value={newHour} onChange={(e) => setNewHour(e.target.value)} />
                  </div>

                  <div className="quick-row">
                    <label className="label">Category</label>
                    <select className="input" value={quickCat} onChange={(e) => setQuickCat(e.target.value)}>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="quick-row quick-grow">
                    <label className="label">Task</label>
                    <input className="input" value={quickText} onChange={(e) => setQuickText(e.target.value)} placeholder="Add a task…" />
                  </div>

                  <div className="quick-row">
                    <label className="label">Repeat</label>
                    <select className="input" value={quickRepeat} onChange={(e) => setQuickRepeat(e.target.value)}>
                      <option value={REPEAT_OPTIONS.NONE}>None</option>
                      <option value={REPEAT_OPTIONS.DAILY}>Daily</option>
                      <option value={REPEAT_OPTIONS.WEEKLY}>Weekly</option>
                      <option value={REPEAT_OPTIONS.OPTIONAL}>Option to repeat</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>
                      Add
                    </button>
                    <button 
                      className="btn" 
                      type="button"
                      onClick={() => setShowPastRepeats(!showPastRepeats)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RepeatIcon />
                      Past tasks
                    </button>
                  </div>

                  {showPastRepeats && (
                    <div className="past-repeats-list" style={{ marginTop: '16px', padding: '16px', background: 'var(--surface-card)', borderRadius: '16px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px', color: 'var(--soft-charcoal)' }}>
                        Tasks you marked "Option to repeat"
                      </div>
                      {getRepeatableTasks().length === 0 ? (
                        <div style={{ fontSize: '13px', color: '#999', fontStyle: 'italic' }}>
                          No repeatable tasks yet. Mark a task as "Option to repeat" to see it here.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {getRepeatableTasks().map((task, idx) => (
                            <div 
                              key={idx}
                              style={{ 
                                padding: '12px', 
                                background: 'white', 
                                borderRadius: '12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onClick={() => {
                                addTask(newHour, task.category, task.text, REPEAT_OPTIONS.OPTIONAL, task.id);
                                setShowPastRepeats(false);
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: '500' }}>{task.text}</div>
                                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {task.category}
                                  <BulletIcon style={{ width: 4, height: 4 }} />
                                  {task.hour}
                                </div>
                              </div>
                              <button
                                className="btn"
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addTask(newHour, task.category, task.text, REPEAT_OPTIONS.OPTIONAL, task.id);
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
              )}
            </section>

            <section className="timeline-wrap">
              {sortedHourKeys.length === 0 ? (
                <div className="empty-big">
                  <div className="empty-title">No hours yet.</div>
                  <div className="empty-sub">Add a task above and your first hour card will appear.</div>
                </div>
              ) : (
                <>
                  {(focusMode || isOverwhelmedMode) && sortedHourKeys.length > 2 && (
                    <p className="focus-mode-notice">
                      {isOverwhelmedMode ? "Drained mode: showing current + next block only." : "Focus mode: showing current + next block only."}
                    </p>
                  )}
                  <div className="timeline-track" aria-hidden="true" />
                  {visibleHourKeys.map((hourKey) => (
                    <div key={hourKey} className="timeline-row">
                      <div className="timeline-time-cell">
                        <span className="timeline-time">{to12Hour(hourKey)}</span>
                      </div>
                      <span className="timeline-dot" aria-hidden="true" />
                      <div className="timeline-blocks">
                        <HourCard
                          hourKey={hourKey}
                          tasksByCat={todayHours[hourKey]}
                          onToggleTask={toggleTask}
                          onToggleEnergyLevel={toggleEnergyLevel}
                          onDeleteTask={deleteTask}
                          onDeleteHour={deleteHour}
                          onMoveToTomorrow={moveTaskToTomorrow}
                          onShowDropdown={setTaskDropdown}
                          taskDropdown={taskDropdown}
                          expandedTaskKey={expandedTaskKey}
                          onExpandTask={setExpandedTaskKey}
                          mode={mode}
                        />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </section>

            {/* Today's Capacity — Energy + Mood pills (reference) */}
            {tab === "today" && isSameDayKey(tKey, realTodayKey) && (
              <section className="capacity-card">
                <div className="panel-title">
                  <span className="title">Today&apos;s Capacity</span>
                </div>
                <div className="capacity-pills">
                  {["LOW", "MEDIUM", "HIGH"].map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      className={`capacity-pill ${(state.days?.[tKey]?.dailyCapacity || "MEDIUM") === cap ? "active" : ""}`}
                      onClick={() => setDailyCapacity(cap)}
                    >
                      {cap.charAt(0) + cap.slice(1).toLowerCase()}
                      {(cap === "MEDIUM" || cap === "HIGH") && <SparkleIcon style={{ width: 12, height: 12, marginLeft: 4, verticalAlign: "middle" }} />}
                    </button>
                  ))}
                </div>
                <div className="capacity-pills">
                  <button
                    type="button"
                    className={`capacity-pill ${(state.days?.[tKey]?.dailyMood) === "calm" ? "active" : ""}`}
                    onClick={() => setDailyMood("calm")}
                  >
                    <GoodFeelingIcon style={{ width: 16, height: 16, marginRight: 4, verticalAlign: "middle" }} />
                    Calm
                  </button>
                  <button
                    type="button"
                    className={`capacity-pill ${(state.days?.[tKey]?.dailyMood) === "neutral" ? "active" : ""}`}
                    onClick={() => setDailyMood("neutral")}
                  >
                    <NeutralFeelingIcon style={{ width: 16, height: 16, marginRight: 4, verticalAlign: "middle" }} />
                    Neutral
                  </button>
                  <button
                    type="button"
                    className={`capacity-pill ${(state.days?.[tKey]?.dailyMood) === "drained" ? "active" : ""}`}
                    onClick={() => setDailyMood("drained")}
                  >
                    <HardFeelingIcon style={{ width: 16, height: 16, marginRight: 4, verticalAlign: "middle" }} />
                    Drained
                  </button>
                </div>
              </section>
            )}

            {starred && (
              <section className="panel" style={{ marginTop: 14 }}>
                <BedtimeRoutine 
                  routine={state.bedtimeRoutine} 
                  onToggle={toggleBedtime}
                  allTasksDone={starred}
                />
              </section>
            )}
          </>
        ) : tab === "list" ? (
          <section className="panel">
            <div className="panel-top">
              <div className="panel-title">
                <div className="panel-title-row">
                  <span className="title">List</span>
                </div>
                <div className="meta">
                  {incompleteTasks.length === 0 ? (
                    <>All done for today! <CelebrateIcon style={{ display: 'inline-block', marginLeft: '4px', verticalAlign: 'middle' }} /></>
                  ) : (
                    `${incompleteTasks.length} task${incompleteTasks.length === 1 ? '' : 's'} remaining`
                  )}
                </div>
              </div>
            </div>

            {incompleteTasks.length === 0 ? (
              <div className="empty">All tasks complete!</div>
            ) : (
              <ul className="list">
                {incompleteTasks.map((t) => (
                  <li
                    key={`${t.hour}-${t.category}-${t.id}`}
                    className={["item", t.energyLevel === "HEAVY" ? "item-heavy" : ""].filter(Boolean).join(" ")}
                  >
                    <label className="check">
                      <input type="checkbox" checked={!!t.done} onChange={() => toggleTask(t.hour, t.category, t.id)} />
                      <span className="checkmark" />
                      <span className={`item-text ${t.done ? 'item-text-done' : ''}`}>
                        <span className="task-time">{to12Hour(t.hour)}</span> <Pill label={t.category} /> 
                        <span className="energy-badge" style={{ 
                          marginLeft: '8px',
                          fontSize: '12px',
                          color: ENERGY_LEVELS[t.energyLevel || "MEDIUM"].color,
                          display: 'inline-flex',
                          alignItems: 'center'
                        }}>
                          {React.createElement(ENERGY_LEVELS[t.energyLevel || "MEDIUM"].icon, { style: { width: '12px', height: '12px' } })}
                        </span>
                        {t.text}
                      </span>
                    </label>

                    <div className="item-actions" style={{ position: 'relative' }}>
                      <button
                        type="button"
                        className="energy-btn"
                        title={`Energy: ${ENERGY_LEVELS[t.energyLevel || "MEDIUM"].label}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleEnergyLevel(t.hour, t.category, t.id);
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
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTask(t.hour, t.category, t.id);
                        }}
                      >
                        <TrashIcon />
                      </button>
                      
                      <button
                        type="button"
                        className="icon-btn"
                        title="Task options"
                        onClick={(e) => {
                          e.stopPropagation();
                          const dropdownKey = `${t.hour}-${t.category}-${t.id}`;
                          if (taskDropdown === dropdownKey) {
                            setTaskDropdown(null);
                          } else {
                            setTaskDropdown(dropdownKey);
                          }
                        }}
                      >
                        <MenuIcon />
                      </button>
                      
                      {taskDropdown === `${t.hour}-${t.category}-${t.id}` && (
                        <div className="task-dropdown" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="dropdown-item"
                            onClick={() => {
                              moveTaskToTomorrow(t.hour, t.category, t.id);
                            }}
                          >
                            <CalendarIcon style={{ marginRight: '8px' }} />
                            Move to tomorrow
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            onClick={() => {
                              deleteTask(t.hour, t.category, t.id);
                              setTaskDropdown(null);
                            }}
                          >
                            <FireIcon style={{ marginRight: '8px' }} />
                            Let it go
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            onClick={() => {
                              setTaskDropdown(null);
                            }}
                          >
                            Keep as is
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : tab === "monthly" ? (
          <section className="panel">
            <div className="panel-top">
              <div className="panel-title">
                <div className="panel-title-row">
                  <span className="title">Monthly Objectives</span>
                  <span className="sparkle"><SparkleIcon style={{ display: 'inline-block' }} /></span>
                </div>
                <div className="meta">Big picture goals that don't clutter Today.</div>
              </div>
            </div>

            <form className="monthly-add" onSubmit={addMonthly}>
              <input className="input" value={monthlyText} onChange={(e) => setMonthlyText(e.target.value)} placeholder="Add a monthly objective…" />
              <button className="btn btn-primary" type="submit">
                Add
              </button>
            </form>

            {state.monthly.length === 0 ? (
              <div className="empty">Add your first monthly objective.</div>
            ) : (
              <ul className="list">
                {state.monthly.map((m) => (
                  <li key={m.id} className={m.done ? "item item-done" : "item"}>
                    <label className="check">
                      <input type="checkbox" checked={m.done} onChange={() => toggleMonthly(m.id)} />
                      <span className="checkmark" />
                      <span className="item-text">{m.text}</span>
                    </label>

                    <button type="button" className="icon-btn" title="Delete objective" onClick={() => deleteMonthly(m.id)}>
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : tab === "coach" ? (
          <section className="panel">
            <div className="panel-top">
              <div className="panel-title">
                <div className="panel-title-row">
                  <span className="title">Pattern insights</span>
                </div>
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
                    {Math.round((1 - patternInsights.leastCompletedRate) * 100)}% completion — try one small win.
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
                  autoFocus
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

            {/* Conversation History */}
            {coachConversation.length > 0 && (
              <div className="coach-conversation" style={{ marginBottom: 'var(--spacing-md)' }}>
                {coachConversation.map((msg, idx) => (
                  <div key={idx} className={`coach-msg coach-msg-${msg.role}`}>
                    <div className="coach-msg-label">{msg.role === 'user' ? 'You' : 'Coach'}</div>
                    <div className="coach-msg-content">{msg.content}</div>
                  </div>
                ))}
              </div>
            )}

            {!coachResult && !coachError && !coachLoading && coachConversation.length === 0 && (
              <div className="empty">
                Type a question above, or click "General Check-in" for an overview.
                <br /><br />
                <small style={{ opacity: 0.7 }}>I'll check in on first open each day and when you've been stuck for a while.</small>
              </div>
            )}

            {/* Show conversation history for questions */}
            {coachConversation.length > 0 && (
              <div className="coach-body">
                {coachConversation.map((msg, idx) => (
                  <div key={idx} style={{ marginBottom: 'var(--spacing-md)' }}>
                    {msg.role === 'user' && (
                      <div className="coach-message" style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '12px 16px', borderRadius: '12px', marginBottom: '8px' }}>
                        <strong>You:</strong> {msg.content}
                      </div>
                    )}
                    {msg.role === 'assistant' && (
                      <div className="coach-message">{msg.content}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Show structured result for general check-ins */}
            {coachResult && coachConversation.length === 0 && (
              <div className="coach-body">
                {coachResult.message && (
                  <div className="coach-message">{coachResult.message}</div>
                )}

                {coachResult.highlights && coachResult.highlights.length > 0 && (
                  <div className="coach-block">
                    <div className="coach-block-title">Today's Focus</div>
                    <ul className="coach-list">
                      {coachResult.highlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {coachResult.suggestions && coachResult.suggestions.length > 0 && (
                  <div className="coach-block">
                    <div className="coach-block-title">Suggested Tasks</div>
                    <div className="coach-suggest-grid">
                      {coachResult.suggestions.map((s) => (
                        <div key={s.id} className="coach-suggest">
                          <div className="coach-suggest-top">
                            <Pill label={s.category} />
                            <span className="coach-time">{to12Hour(s.hour)}</span>
                          </div>
                          <div className="coach-suggest-text">{s.text}</div>
                          <button
                            className="btn btn-primary"
                            type="button"
                            style={{ width: '100%', marginTop: 8 }}
                            onClick={() => acceptCoachSuggestion(s)}
                          >
                            Add to Today
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {coachResult.ignoredMonthlies && coachResult.ignoredMonthlies.length > 0 && (
                  <div className="coach-block">
                    <div className="coach-block-title">Monthlies You Might Be Ignoring</div>
                    <ul className="coach-list">
                      {coachResult.ignoredMonthlies.map((m) => (
                        <li key={m.id || m.text}>{m.text}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {coachResult.percentSummary && (
                  <div className="coach-block">
                    <div className="coach-block-title">Completion Snapshot</div>
                    <div className="coach-mono">{coachResult.percentSummary}</div>
                  </div>
                )}
              </div>
            )}
          </section>
        ) : tab === "finance" ? (
          <section className="panel finance-panel surface-glass">
            <div className="panel-top">
              <div className="panel-title">
                <span className="title">Finance</span>
                <div className="meta">Income, spending, savings & debt — Coach can help with habits</div>
              </div>
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
              <div className="finance-total-row savings">
                <span className="finance-total-label">Total savings</span>
                <input
                  className="input finance-savings-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={finance.totalSavings === 0 ? "" : finance.totalSavings}
                  onChange={(e) => setFinance((prev) => ({ ...prev, totalSavings: parseFloat(e.target.value) || 0 }))}
                  onBlur={(e) => setFinance((prev) => ({ ...prev, totalSavings: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                />
              </div>
              <div className="finance-total-row debt">
                <span className="finance-total-label">Total debt</span>
                <input
                  className="input finance-debt-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={finance.totalDebt === 0 ? "" : finance.totalDebt}
                  onChange={(e) => setFinance((prev) => ({ ...prev, totalDebt: parseFloat(e.target.value) || 0 }))}
                  onBlur={(e) => setFinance((prev) => ({ ...prev, totalDebt: parseFloat(e.target.value) || 0 }))}
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
              <h3 className="finance-section-title">Recent income</h3>
              <ul className="finance-list">
                {(finance.incomeEntries || []).slice(0, 15).map((e) => (
                  <li key={e.id} className="finance-list-item income">
                    <span className="finance-amount">+${Number(e.amount).toFixed(2)}</span>
                    {e.label && <span className="finance-label">{e.label}</span>}
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
                    <span className="finance-amount">-${Number(e.amount).toFixed(2)}</span>
                    {e.label && <span className="finance-label">{e.label}</span>}
                    <button type="button" className="icon-btn" onClick={() => removeFinanceEntry("expense", e.id)} aria-label="Remove"><TrashIcon /></button>
                  </li>
                ))}
                {(finance.expenseEntries || []).length === 0 && <li className="finance-list-empty">No spending logged yet. Try -200 or &quot;50 coffee&quot;</li>}
              </ul>
            </div>

            <div className="finance-section">
              <h3 className="finance-section-title">Subscriptions</h3>
              <form className="finance-inline-form" onSubmit={(e) => {
                e.preventDefault();
                if (newSubName.trim()) {
                  addSubscription(newSubName.trim(), newSubAmount || 0, newSubCycle);
                  setNewSubName("");
                  setNewSubAmount("");
                }
              }}>
                <input className="input" value={newSubName} onChange={(e) => setNewSubName(e.target.value)} placeholder="Netflix, gym…" />
                <input className="input" type="number" min="0" step="0.01" value={newSubAmount} onChange={(e) => setNewSubAmount(e.target.value)} placeholder="Amount" style={{ width: 90 }} />
                <select className="input" value={newSubCycle} onChange={(e) => setNewSubCycle(e.target.value)} style={{ width: 100 }}>
                  <option value="monthly">/mo</option>
                  <option value="yearly">/yr</option>
                </select>
                <button type="submit" className="btn btn-primary">Add</button>
              </form>
              <ul className="finance-list">
                {(finance.subscriptions || []).map((s) => (
                  <li key={s.id} className="finance-list-item">
                    <span className="finance-label">{s.name}</span>
                    <span className="finance-amount">${Number(s.amount).toFixed(2)}/{s.cycle === "yearly" ? "yr" : "mo"}</span>
                    <button type="button" className="icon-btn" onClick={() => removeSubscription(s.id)} aria-label="Remove"><TrashIcon /></button>
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

            <div className="finance-coach-cta">
              <button type="button" className="btn btn-primary" onClick={() => setTab("coach")}>
                <SparkleIcon style={{ width: 18, height: 18, marginRight: 8 }} />
                Ask Coach about my money
              </button>
            </div>
          </section>
        ) : tab === "notes" ? (
          <section className="panel">
            <div className="panel-top">
              <div className="panel-title">
                <div className="panel-title-row">
                  <span className="title">Notes & Ideas</span>
                  <span className="sparkle"><SparkleIcon style={{ display: 'inline-block' }} /></span>
                </div>
                <div className="meta">Jot down thoughts, ideas, and reminders</div>
              </div>
            </div>

            <div className="notes-search">
              <input
                className="input"
                type="text"
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                placeholder="Search notes..."
              />
            </div>

            <form className="monthly-add" onSubmit={addNote}>
              <input 
                className="input" 
                value={newNote} 
                onChange={(e) => setNewNote(e.target.value)} 
                placeholder="Add a note or idea…" 
              />
              <button className="btn btn-primary" type="submit">
                Add
              </button>
            </form>

            {filteredNotes.length === 0 ? (
              <div className="empty">
                {noteSearch ? "No notes match your search." : "Add your first note or idea."}
              </div>
            ) : (
              <ul className="list">
                {filteredNotes.map((note) => (
                  <li key={note.id} className="item">
                    <div className="note-content">
                      <span className="item-text">{note.text}</span>
                      <span className="note-date">
                        {new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <button 
                      type="button" 
                      className="icon-btn" 
                      title="Delete note" 
                      onClick={() => deleteNote(note.id)}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        </main>
        <aside className="shell-rail" aria-hidden="true" />

        {/* Floating action — Add task (Today only): gradient, glow, pressed, subtle entrance */}
        {tab === "today" && (
          <button
            type="button"
            className="fab fab-premium"
            onClick={() => document.querySelector(".quick-add-input")?.focus()}
            aria-label="Add task"
            title="Add task"
          >
            +
          </button>
        )}

        {showSettings && (
          <div className="modal-overlay" onClick={() => setShowSettings(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Settings</h3>
              
              <div className="settings-section">
                <label className="label">Theme Color</label>
                <div className="theme-picker">
                  {Object.entries(THEMES).map(([key, themeData]) => (
                    <button
                      key={key}
                      className={`theme-option ${theme.name === themeData.name ? 'selected' : ''}`}
                      onClick={() => setTheme(themeData)}
                      style={{
                        background: themeData.gradient,
                        border: theme.name === themeData.name ? '3px solid #333' : '2px solid transparent'
                      }}
                      title={themeData.name}
                    >
                      {theme.name === themeData.name && <CheckIcon style={{ color: '#333', width: 18, height: 18 }} />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-section">
                <label className="label">Notifications</label>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    const granted = await notificationService.requestPermission();
                    if (granted) {
                      alert('Notifications enabled! You\'ll get reminders for tasks and completion alerts.');
                    } else {
                      alert('Please enable notifications in your browser settings to receive task reminders.');
                    }
                  }}
                >
                  {notificationService.permission === 'granted' ? <><CheckIcon style={{ width: 16, height: 16, marginRight: 6, verticalAlign: 'middle' }} />Enabled</> : 'Enable Notifications'}
                </button>
              </div>
              <div className="settings-section">
                <label className="label">Push (PWA)</label>
                <p className="settings-hint">Add to Home Screen, then enable for reminders when the app is closed.</p>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    const ok = await notificationService.enablePush();
                    if (ok) alert('Push enabled. You\'ll get PROYOU reminders.');
                    else alert('Push failed. Add to Home Screen first (iOS), or check VAPID keys (Vercel).');
                  }}
                >
                  Enable Push Notifications
                </button>
              </div>

              <div className="modal-actions">
                <button className="btn btn-primary" onClick={() => setShowSettings(false)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* In-app task banner — Start / Snooze / Skip or Wrap it up */}
        {taskBanner && (
          <div className="inapp-banner">
            <div className="inapp-banner-content">
              {taskBanner.type === "start" ? (
                <>
                  <span className="inapp-banner-title">Next up</span>
                  <span className="inapp-banner-task">{taskBanner.task.text}</span>
                  <div className="inapp-banner-actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setTaskBanner(null)}>Start</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { localStorage.setItem("taskBannerSnoozeUntil", String(Date.now() + 5 * 60 * 1000)); setTaskBanner(null); }}>Snooze</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTaskBanner(null)}>Skip</button>
                  </div>
                </>
              ) : (
                <>
                  <span className="inapp-banner-title">Wrap it up</span>
                  <span className="inapp-banner-task"><ArrowRightIcon style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 6 }} />{taskBanner.nextTask ? taskBanner.nextTask.text : "Next"}</span>
                  <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => setTaskBanner(null)}>OK</button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toastNotification && (
          <div className="toast-notification">
            <div className="toast-content">
              <SparkleIcon style={{ width: '20px', height: '20px', flexShrink: 0 }} />
              <div className="toast-text">
                <div className="toast-message">{toastNotification.message}</div>
                {toastNotification.taskText && (
                  <div className="toast-task">{toastNotification.taskText}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Morning Greeting */}
        {morningGreeting && (
          <div className="modal-overlay celebration-overlay" onClick={() => setMorningGreeting(false)}>
            <div className="modal celebration-modal" onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: '24px', marginBottom: '16px' }}>Good morning, Sarah</h3>
              <p className="celebration-task" style={{ fontSize: '16px', lineHeight: '1.6' }}>
                {(() => {
                  const patterns = analyzePatterns();
                  if (patterns.totalCompletions > 10) {
                    return `You usually do better when you start with one small task. Want to pick one together?`;
                  }
                  return `How would you like to show up today?`;
                })()}
              </p>
              <button 
                className="btn btn-primary" 
                onClick={() => setMorningGreeting(false)}
                style={{ marginTop: '24px' }}
              >
                Let's begin
              </button>
            </div>
          </div>
        )}

        {/* Gentle Rescheduling Modal */}

        <footer className="foot">
          <span>Saved automatically on this device.</span>
          <BulletIcon style={{ marginLeft: 6, marginRight: 6, verticalAlign: 'middle' }} />
          <span>Next upgrade: cloud sync + phone install.</span>
        </footer>
      </div>
    </div>
  );
}
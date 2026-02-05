import React, { useEffect, useMemo, useState } from "react";
import { 
  StarIcon, StarEmptyIcon, TrashIcon, SparkleIcon, MoonIcon, CelebrateIcon, WindDownIcon,
  SettingsIcon, CloseIcon, ChevronLeftIcon, ChevronRightIcon, RepeatIcon, CalendarIcon,
  LightEnergyIcon, MediumEnergyIcon, HeavyEnergyIcon, GoodFeelingIcon, NeutralFeelingIcon, HardFeelingIcon, FireIcon, MenuIcon
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

/** ====== Pattern Tracking ====== **/
function loadPatterns() {
  try {
    const raw = localStorage.getItem(PATTERNS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {
      completions: [], // { dayKey, taskId, category, hour, completedAt, feeling }
      skippedDays: {}, // { dayKey: { categories: [] } }
      completionTimes: [], // { hour: number, dayOfWeek: number }
      weeklyTotals: {} // { weekKey: total }
    };
  } catch {
    return { completions: [], skippedDays: {}, completionTimes: [], weeklyTotals: {} };
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
  
  return {
    bestTime,
    leastCompletedCategory: leastCompleted,
    leastCompletedRate: lowestRate,
    todayCompletions,
    totalCompletions: patterns.completions.length
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
      <div className="progress" style={{ width: `${pct}%` }} />
    </div>
  );
}

// Ultra-minimal hour card with Do/Plan mode
function HourCard({ hourKey, tasksByCat, onToggleTask, onToggleEnergyLevel, onDeleteTask, onDeleteHour, onMoveToTomorrow, onShowDropdown, taskDropdown, mode = "do" }) {
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
    <div className={complete ? "card card-complete" : "card"}>
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
            {allTasks.map((t) => (
              <li
                key={t.id}
                className={["item", t.done ? "item-done" : ""]
                  .filter(Boolean)
                  .join(" ")}
                onClick={(e) => {
                  // Make completed tasks clickable to uncomplete
                  if (t.done && !e.target.closest('.item-actions') && !e.target.closest('input')) {
                    onToggleTask(hourKey, t.category, t.id);
                  }
                }}
                style={{ cursor: t.done ? 'pointer' : 'default' }}
              >
                <label className="check">
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
                </div>
              </li>
            ))}
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

  const [noteSearch, setNoteSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [completionCelebration, setCompletionCelebration] = useState(null);
  const [toastNotification, setToastNotification] = useState(null);
  const [taskFeeling, setTaskFeeling] = useState(null);
  const [missedTasks, setMissedTasks] = useState([]);
  const [windDownMode, setWindDownMode] = useState(false);
  const [morningGreeting, setMorningGreeting] = useState(false);
  const [taskDropdown, setTaskDropdown] = useState(null); // { hourKey, category, taskId }
  
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

  const prog = useMemo(() => dayProgress(todayHours), [todayHours]);
  const starred = useMemo(() => dayIsStarred(todayHours), [todayHours]);

  const [starPulse, setStarPulse] = useState(false);
  useEffect(() => {
    if (starred) {
      setStarPulse(true);
      const t = setTimeout(() => setStarPulse(false), 900);
      return () => clearTimeout(t);
    }
  }, [starred]);

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
        }
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
      <div className="shell">
        <header className="top">
          <div>
            <div className="kicker">proyou</div>
            <h1 className="h1">
              {(() => {
                if (tab === "today") {
                  if (isSameDayKey(tKey, realTodayKey)) return "Today";
                  const label = getDayLabel(tKey, realTodayKey);
                  if (label === "Tomorrow") return "Tomorrow";
                  if (label === "Future") return "Future";
                  return "Past";
                }
                return tab === "monthly" ? "Monthly" 
                  : tab === "list" ? "List" 
                  : tab === "notes" ? "Notes" 
                  : "Coach";
              })()}{" "}
              <span className="sub">
                {tab === "today" || tab === "list"
                  ? (() => {
                      const label = getDayLabel(tKey, realTodayKey);
                      if (label === "Tomorrow" || label === "Future") {
                        return ""; // Don't show subtitle if main title already says Tomorrow/Future
                      }
                      return new Date(tKey + "T00:00:00").toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      });
                    })()
                  : tab === "monthly"
                  ? "Objectives"
                  : "Assistant"}
              </span>
            </h1>
          </div>

          <div className="tabs">
            <TabButton active={tab === "today"} onClick={() => setTab("today")}>
              Today
            </TabButton>
            <TabButton active={tab === "list"} onClick={() => setTab("list")}>
              List
            </TabButton>
            <TabButton active={tab === "monthly"} onClick={() => setTab("monthly")}>
              Monthly
            </TabButton>
            <TabButton active={tab === "coach"} onClick={() => setTab("coach")}>
              Coach
            </TabButton>
            <TabButton active={tab === "notes"} onClick={() => setTab("notes")}>
              Notes
            </TabButton>
            <button 
              className="settings-btn"
              onClick={() => setShowSettings(true)}
              title="Settings"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '4px 8px', color: 'white', fontWeight: '400' }}
            >
              Settings
            </button>
          </div>
        </header>

        {(tab === "today" || tab === "list") && (
          <div className="date-controls">
            <div className="date-controls-top">
              <button className="btn" type="button" onClick={() => setSelectedDayKey((k) => addDaysKey(k, -1))}>
                <ChevronLeftIcon />
              </button>

              <input
                className="input date-input"
                type="date"
                value={formatDateInput(selectedDayKey)}
                onChange={(e) => {
                  const v = (e.target.value || "").trim();
                  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) setSelectedDayKey(v);
                }}
              />

              <button className="btn" type="button" onClick={() => setSelectedDayKey((k) => addDaysKey(k, 1))}>
                <ChevronRightIcon />
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
                <button
                  className={mode === "do" ? "btn btn-primary" : "btn"}
                  type="button"
                  onClick={() => setMode((m) => (m === "do" ? "plan" : "do"))}
                  title="Do mode = clean checkboxes. Plan mode = edit + organize."
                >
                  {mode === "do" ? "Do" : "Plan"}
                </button>
              )}
            </div>
          </div>
        )}

        {tab === "today" ? (
          <>
            <section className="panel">
              <div className="panel-top">
                <div className="panel-title">
                  <div className="panel-title-row">
                    <span className="title">Daily Progress</span>
                    <span className={starred ? (starPulse ? "star star-pulse" : "star") : "star star-dim"}>
                      {starred ? <StarIcon filled style={{ display: 'inline-block' }} /> : <StarEmptyIcon style={{ display: 'inline-block' }} />}
                    </span>
                  </div>
                  <div className="meta">
                    {prog.total === 0 ? (
                      <>Add your first task and we'll start counting <SparkleIcon style={{ display: 'inline-block', verticalAlign: 'middle' }} /></>
                    ) : (
                      `${prog.done}/${prog.total} tasks done`
                    )}
                  </div>
                </div>

                <div className="panel-right">
                  <div className="pct">{prog.pct}%</div>
                </div>
              </div>

              <ProgressBar pct={prog.pct} />

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
                                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                                  {task.category} • {task.hour}
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

            <section className="stack">
              {sortedHourKeys.length === 0 ? (
                <div className="empty-big">
                  <div className="empty-title">No hours yet.</div>
                  <div className="empty-sub">Add a task above and your first hour card will appear.</div>
                </div>
              ) : (
                sortedHourKeys.map((hourKey) => (
                  <HourCard
                    key={hourKey}
                    hourKey={hourKey}
                    tasksByCat={todayHours[hourKey]}
                    onToggleTask={toggleTask}
                    onToggleEnergyLevel={toggleEnergyLevel}
                    onDeleteTask={deleteTask}
                    onDeleteHour={deleteHour}
                    onMoveToTomorrow={moveTaskToTomorrow}
                    onShowDropdown={setTaskDropdown}
                    taskDropdown={taskDropdown}
                    mode={mode}
                  />
                ))
              )}
            </section>

            {/* End of day mood — only when viewing today */}
            {tab === "today" && isSameDayKey(tKey, realTodayKey) && (
              <section className="panel end-of-day-mood" style={{ marginTop: 14 }}>
                <div className="panel-top">
                  <div className="panel-title">
                    <span className="title">How was your day?</span>
                  </div>
                </div>
                <div className="feeling-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className={`feeling-btn ${(state.days?.[tKey]?.dailyMood) === 'calm' ? 'active' : ''}`}
                    onClick={() => setDailyMood('calm')}
                  >
                    <GoodFeelingIcon style={{ width: 18, height: 18, marginRight: 6, verticalAlign: 'middle' }} />
                    Calm
                  </button>
                  <button
                    type="button"
                    className={`feeling-btn ${(state.days?.[tKey]?.dailyMood) === 'neutral' ? 'active' : ''}`}
                    onClick={() => setDailyMood('neutral')}
                  >
                    <NeutralFeelingIcon style={{ width: 18, height: 18, marginRight: 6, verticalAlign: 'middle' }} />
                    Neutral
                  </button>
                  <button
                    type="button"
                    className={`feeling-btn ${(state.days?.[tKey]?.dailyMood) === 'drained' ? 'active' : ''}`}
                    onClick={() => setDailyMood('drained')}
                  >
                    <HardFeelingIcon style={{ width: 18, height: 18, marginRight: 6, verticalAlign: 'middle' }} />
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
                      <input type="checkbox" checked={false} onChange={() => toggleTask(t.hour, t.category, t.id)} />
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
                  <span className="title">AI Coach</span>
                  <span className="sparkle"><SparkleIcon style={{ display: 'inline-block' }} /></span>
                </div>
                <div className="meta">{prog.done}/{prog.total} tasks done · {state.monthly?.length || 0} monthly objectives</div>
              </div>
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
                      {theme.name === themeData.name && '✓'}
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
                  {notificationService.permission === 'granted' ? '✓ Enabled' : 'Enable Notifications'}
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
          <span className="dot">•</span>
          <span>Next upgrade: cloud sync + phone install.</span>
        </footer>
      </div>
    </div>
  );
}
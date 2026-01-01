import React, { useEffect, useMemo, useState } from "react";

/** ====== Config ====== **/
const CATEGORIES = ["RHEA", "EPC", "Personal"];
const STORAGE_KEY = "cute_schedule_v3";

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

// Ultra-minimal hour card - just shows tasks, no category dropdowns at all
function HourCard({ hourKey, tasksByCat, onToggleTask, onTogglePriority, onDeleteTask, onDeleteHour }) {
  const complete = hourIsComplete(tasksByCat);
  const [open, setOpen] = useState(true);

  const allTasks = useMemo(() => {
    return CATEGORIES.flatMap((cat) => 
      (tasksByCat?.[cat] || []).map(t => ({ ...t, category: cat }))
    ).sort((a, b) => {
      if (a.priority && !b.priority) return -1;
      if (!a.priority && b.priority) return 1;
      return 0;
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
          <span className="chev">{open ? "▾" : "▸"}</span>
        </button>

        <button type="button" className="icon-btn danger" title="Remove this hour" onClick={() => onDeleteHour(hourKey)}>
          ✕
        </button>
      </div>

      {open && (
        <div className="card-body-simple">
          <ul className="list">
            {allTasks.map((t) => (
              <li
                key={t.id}
                className={["item", t.done ? "item-done" : "", t.priority ? "item-priority" : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                <label className="check">
                  <input type="checkbox" checked={!!t.done} onChange={() => onToggleTask(hourKey, t.category, t.id)} />
                  <span className="checkmark" />
                  <span className="item-text">
                    <Pill label={t.category} /> {t.text}
                  </span>
                </label>

                <div className="item-actions">
                  <button
                    type="button"
                    className={t.priority ? "priority-btn priority-active" : "priority-btn"}
                    title={t.priority ? "Remove priority" : "Mark as priority"}
                    onClick={() => onTogglePriority(hourKey, t.category, t.id)}
                  >
                    {t.priority ? "★" : "☆"}
                  </button>

                  <button type="button" className="icon-btn" title="Delete task" onClick={() => onDeleteTask(hourKey, t.category, t.id)}>
                    🗑
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BedtimeRoutine({ routine, onToggle }) {
  const allDone = (routine || []).every((r) => r.done);

  return (
    <div className="bedtime">
      <div className="bedtime-header">
        <h3 className="bedtime-title">✨ Wind Down Time</h3>
        <p className="bedtime-subtitle">10:00 PM - 11:00 PM bedtime routine</p>
      </div>

      <ul className="bedtime-list">
        {(routine || []).map((item) => (
          <li key={item.id} className={item.done ? "bedtime-item bedtime-done" : "bedtime-item"}>
            <label className="check">
              <input type="checkbox" checked={!!item.done} onChange={() => onToggle(item.id)} />
              <span className="checkmark" />
              <span className="item-text">{item.text}</span>
            </label>
          </li>
        ))}
      </ul>

      {allDone && (
        <div className="bedtime-message">
          <p className="bedtime-congrats">🌙 Beautiful work today, Sarah</p>
          <p className="bedtime-note">You showed up for yourself and your dreams. Rest well — tomorrow is another chance to shine.</p>
        </div>
      )}
    </div>
  );
}

/** ====== Main App ====== **/
export default function App() {
  const [tab, setTab] = useState("today");
  const tKey = todayKey();

  const [state, setState] = useState(() => {
    const saved = loadState();
    if (saved) return saved;
    return {
      days: {},
      monthly: [],
      bedtimeRoutine: BEDTIME_ROUTINE.map((r) => ({ ...r, done: false })),
    };
  });

  useEffect(() => {
    setState((prev) => {
      const has = prev.days?.[tKey];
      if (has) return prev;
      return { ...prev, days: { ...prev.days, [tKey]: { hours: {} } } };
    });
  }, [tKey]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const todayHours = state.days?.[tKey]?.hours || {};
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

  function ensureHour(hourKey) {
    setState((prev) => {
      const day = prev.days[tKey] || { hours: {} };
      const hours = day.hours || {};
      if (hours[hourKey]) return prev;

      const empty = { RHEA: [], EPC: [], Personal: [] };
      return { ...prev, days: { ...prev.days, [tKey]: { hours: { ...hours, [hourKey]: empty } } } };
    });
  }

  function addTask(hourKey, category, text) {
    setState((prev) => {
      const day = prev.days[tKey] || { hours: {} };
      const hours = { ...(day.hours || {}) };
      const byCat = hours[hourKey] || { RHEA: [], EPC: [], Personal: [] };

      const nextTask = { id: uid(), text, done: false, priority: false };
      const nextByCat = { ...byCat, [category]: [...(byCat[category] || []), nextTask] };

      hours[hourKey] = nextByCat;
      return { ...prev, days: { ...prev.days, [tKey]: { hours } } };
    });
  }

  function toggleTask(hourKey, category, taskId) {
    setState((prev) => {
      const day = prev.days[tKey];
      if (!day) return prev;
      const hours = { ...(day.hours || {}) };
      const byCat = hours[hourKey];
      if (!byCat) return prev;

      const list = (byCat[category] || []).map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
      hours[hourKey] = { ...byCat, [category]: list };
      return { ...prev, days: { ...prev.days, [tKey]: { hours } } };
    });
  }

  function togglePriority(hourKey, category, taskId) {
    setState((prev) => {
      const day = prev.days[tKey];
      if (!day) return prev;
      const hours = { ...(day.hours || {}) };
      const byCat = hours[hourKey];
      if (!byCat) return prev;

      const list = (byCat[category] || []).map((t) => (t.id === taskId ? { ...t, priority: !t.priority } : t));
      hours[hourKey] = { ...byCat, [category]: list };
      return { ...prev, days: { ...prev.days, [tKey]: { hours } } };
    });
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

      return { ...prev, days: { ...prev.days, [tKey]: { hours } } };
    });
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

  function quickAdd(e) {
    e.preventDefault();
    const clean = normalizeText(quickText);
    if (!clean) return;
    ensureHour(newHour);
    addTask(newHour, quickCat, clean);
    setQuickText("");
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

  // List view - all incomplete tasks for today
  const incompleteTasks = useMemo(() => {
    return allTasksInDay(todayHours).filter(t => !t.done).sort((a, b) => {
      if (a.priority && !b.priority) return -1;
      if (!a.priority && b.priority) return 1;
      return a.hour.localeCompare(b.hour);
    });
  }, [todayHours]);

  return (
    <div className="app">
      <div className="shell">
        <header className="top">
          <div>
            <div className="kicker">cute schedule</div>
            <h1 className="h1">
              {tab === "today" ? "Today" : tab === "monthly" ? "Monthly" : "Categories"}{" "}
              <span className="sub">{tab === "today" ? prettyToday() : tab === "monthly" ? "Objectives" : "Manage"}</span>
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
            <TabButton active={tab === "categories"} onClick={() => setTab("categories")}>
              Categories
            </TabButton>
          </div>
        </header>

        {tab === "today" ? (
          <>
            <section className="panel">
              <div className="panel-top">
                <div className="panel-title">
                  <div className="panel-title-row">
                    <span className="title">Daily Progress</span>
                    <span className={starred ? (starPulse ? "star star-pulse" : "star") : "star star-dim"}>
                      {starred ? "⭐" : "☆"}
                    </span>
                  </div>
                  <div className="meta">
                    {prog.total === 0 ? "Add your first task and we'll start counting ✨" : `${prog.done}/${prog.total} tasks done`}
                  </div>
                </div>

                <div className="panel-right">
                  <div className="pct">{prog.pct}%</div>
                </div>
              </div>

              <ProgressBar pct={prog.pct} />

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

                <button className="btn btn-primary" type="submit">
                  Add
                </button>
              </form>
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
                    onTogglePriority={togglePriority}
                    onDeleteTask={deleteTask}
                    onDeleteHour={deleteHour}
                  />
                ))
              )}
            </section>

            {starred && (
              <section className="panel" style={{ marginTop: 14 }}>
                <BedtimeRoutine routine={state.bedtimeRoutine} onToggle={toggleBedtime} />
              </section>
            )}
          </>
        ) : tab === "list" ? (
          <section className="panel">
            <div className="panel-top">
              <div className="panel-title">
                <div className="panel-title-row">
                  <span className="title">To-Do List</span>
                </div>
                <div className="meta">
                  {incompleteTasks.length === 0 ? "All done for today! 🎉" : `${incompleteTasks.length} task${incompleteTasks.length === 1 ? '' : 's'} remaining`}
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
                    className={["item", t.priority ? "item-priority" : ""].filter(Boolean).join(" ")}
                  >
                    <label className="check">
                      <input type="checkbox" checked={false} onChange={() => toggleTask(t.hour, t.category, t.id)} />
                      <span className="checkmark" />
                      <span className="item-text">
                        <span className="task-time">{to12Hour(t.hour)}</span> <Pill label={t.category} /> {t.text}
                      </span>
                    </label>

                    <div className="item-actions">
                      <button
                        type="button"
                        className={t.priority ? "priority-btn priority-active" : "priority-btn"}
                        onClick={() => togglePriority(t.hour, t.category, t.id)}
                      >
                        {t.priority ? "★" : "☆"}
                      </button>

                      <button type="button" className="icon-btn" onClick={() => deleteTask(t.hour, t.category, t.id)}>
                        🗑
                      </button>
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
                  <span className="sparkle">✨</span>
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
                      🗑
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <section className="panel">
            <div className="panel-top">
              <div className="panel-title">
                <div className="panel-title-row">
                  <span className="title">Manage Categories</span>
                </div>
                <div className="meta">View and organize tasks by category</div>
              </div>
            </div>

            <div className="empty">Category management coming soon!</div>
          </section>
        )}

        <footer className="foot">
          <span>Saved automatically on this device.</span>
          <span className="dot">•</span>
          <span>Next upgrade: cloud sync + phone install.</span>
        </footer>
      </div>
    </div>
  );
}
import React, { useEffect, useMemo, useState } from "react";

/** ====== Config ====== **/
const CATEGORIES = ["RHEA", "EPC", "Personal"];
const STORAGE_KEY = "cute_schedule_v2";

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
function allTasks(tasksByCat) {
  return CATEGORIES.flatMap((c) => tasksByCat?.[c] || []);
}
function hourIsComplete(tasksByCat) {
  const tasks = allTasks(tasksByCat);
  if (tasks.length === 0) return false;
  return tasks.every((t) => t.done);
}
function dayProgress(hours) {
  const hourEntries = Object.entries(hours || {});
  const tasks = hourEntries.flatMap(([, byCat]) => allTasks(byCat));
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}
function dayIsStarred(hours) {
  const { total, done } = dayProgress(hours);
  return total > 0 && done === total;
}
function normalizeText(s) {
  return String(s || "").trim();
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

function CoachPanel({ open, onClose, onAskCoach, loading, error, result, contextSummary }) {
  if (!open) return null;

  return (
    <div className="coach-overlay" role="dialog" aria-modal="true">
      <div className="coach-modal">
        <div className="coach-top">
          <div className="coach-title">
            <div className="coach-kicker">front end coach</div>
            <div className="coach-h2">Daily nudge + smart suggestions</div>
            <div className="coach-meta">{contextSummary}</div>
          </div>
          <button type="button" className="icon-btn danger" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="coach-actions">
          <button type="button" className="btn btn-primary" onClick={onAskCoach} disabled={loading}>
            {loading ? "Thinking…" : "Ask Coach"}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>

      {error ? (
  <div className="coach-error">
    <div className="coach-error-title">Coach error</div>
    <div className="coach-error-text">{error}</div>
  </div>
) : null}

        {!result ? (
          <div className="coach-empty">
            Tap <b>Ask Coach</b> to get a little plan, spot ignored monthlies, and pull 2–4 tasks into Today.
          </div>
        ) : (
          <div className="coach-body">
            {result.message ? <div className="coach-message">{result.message}</div> : null}

            {Array.isArray(result.highlights) && result.highlights.length > 0 ? (
              <div className="coach-block">
                <div className="coach-block-title">Today’s focus</div>
                <ul className="coach-list">
                  {result.highlights.map((h, i) => (
                    <li key={`${i}-${h}`}>{h}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {Array.isArray(result.suggestions) && result.suggestions.length > 0 ? (
              <div className="coach-block">
                <div className="coach-block-title">Suggested tasks</div>
                <div className="coach-suggest-grid">
                  {result.suggestions.map((s, idx) => (
                    <div key={s.id || idx} className="coach-suggest">
                      <div className="coach-suggest-top">
                        <span className="coach-chip">{s.category || "Personal"}</span>
                        <span className="coach-chip coach-chip-soft">{s.hour || "09:00"}</span>
                      </div>
                      <div className="coach-suggest-text">{s.text}</div>
                      <div className="coach-suggest-actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => result.onAcceptSuggestion?.(s)}
                        >
                          Add to Today
                        </button>
                        <button type="button" className="btn" onClick={() => result.onDismissSuggestion?.(s)}>
                          Skip
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {Array.isArray(result.ignoredMonthlies) && result.ignoredMonthlies.length > 0 ? (
              <div className="coach-block">
                <div className="coach-block-title">Monthlies you might be ignoring</div>
                <ul className="coach-list">
                  {result.ignoredMonthlies.map((m) => (
                    <li key={m.id || m.text}>{m.text}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.percentSummary ? (
              <div className="coach-block">
                <div className="coach-block-title">Completion snapshot</div>
                <div className="coach-mono">{result.percentSummary}</div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function HourCard({ hourKey, tasksByCat, onAddTask, onToggleTask, onTogglePriority, onDeleteTask, onDeleteHour }) {
  const complete = hourIsComplete(tasksByCat);
  const [open, setOpen] = useState(true);

  const totals = useMemo(() => {
    const tasks = allTasks(tasksByCat);
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    return { total, done };
  }, [tasksByCat]);

  return (
    <div className={complete ? "card card-complete" : "card"}>
      <div className="card-top">
        <button type="button" className="hour-title" onClick={() => setOpen((v) => !v)}>
          <div className="hour-left">
            <span className="hour-time">{hourKey}</span>
            <span className="hour-meta">
              {totals.done}/{totals.total} done
            </span>
          </div>
          <span className="chev">{open ? "▾" : "▸"}</span>
        </button>

        <button type="button" className="icon-btn danger" title="Remove this hour" onClick={() => onDeleteHour(hourKey)}>
          ✕
        </button>
      </div>

      {open && (
        <div className="card-body">
          {CATEGORIES.map((cat) => (
            <CategoryBlock
              key={cat}
              category={cat}
              tasks={tasksByCat?.[cat] || []}
              onAdd={(text) => onAddTask(hourKey, cat, text)}
              onToggle={(taskId) => onToggleTask(hourKey, cat, taskId)}
              onTogglePriority={(taskId) => onTogglePriority(hourKey, cat, taskId)}
              onDelete={(taskId) => onDeleteTask(hourKey, cat, taskId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryBlock({ category, tasks, onAdd, onToggle, onTogglePriority, onDelete }) {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState("");

  const sortedTasks = useMemo(() => {
    return [...(tasks || [])].sort((a, b) => {
      if (a.priority && !b.priority) return -1;
      if (!a.priority && b.priority) return 1;
      return 0;
    });
  }, [tasks]);

  return (
    <div className="cat">
      <button type="button" className="cat-head" onClick={() => setOpen((v) => !v)}>
        <div className="cat-left">
          <Pill label={category} />
          <span className="cat-count">
            {(tasks || []).filter((t) => t.done).length}/{(tasks || []).length}
          </span>
        </div>
        <span className="chev">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="cat-body">
          <form
            className="add-row"
            onSubmit={(e) => {
              e.preventDefault();
              const clean = normalizeText(text);
              if (!clean) return;
              onAdd(clean);
              setText("");
            }}
          >
            <input
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Add a ${category} task…`}
            />
            <button className="btn" type="submit">
              Add
            </button>
          </form>

          {(tasks || []).length === 0 ? (
            <div className="empty">No tasks here yet.</div>
          ) : (
            <ul className="list">
              {sortedTasks.map((t) => (
                <li
                  key={t.id}
                  className={["item", t.done ? "item-done" : "", t.priority ? "item-priority" : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <label className="check">
                    <input type="checkbox" checked={!!t.done} onChange={() => onToggle(t.id)} />
                    <span className="checkmark" />
                    <span className="item-text">{t.text}</span>
                  </label>

                  <div className="item-actions">
                    <button
                      type="button"
                      className={t.priority ? "priority-btn priority-active" : "priority-btn"}
                      title={t.priority ? "Remove priority" : "Mark as priority"}
                      onClick={() => onTogglePriority(t.id)}
                    >
                      {t.priority ? "★" : "☆"}
                    </button>

                    <button type="button" className="icon-btn" title="Delete task" onClick={() => onDelete(t.id)}>
                      🗑
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
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

  // Coach
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState("");
  const [coachResult, setCoachResult] = useState(null);

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

      const totalAfter = allTasks(nextByCat).length;
      if (totalAfter === 0) delete hours[hourKey];

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

  const monthliesDone = useMemo(() => (state.monthly || []).filter((m) => m.done).length, [state.monthly]);

  const contextSummary = useMemo(() => {
    const t = prog.total;
    const d = prog.done;
    const m = state.monthly?.length || 0;
    return `${d}/${t} done today · ${monthliesDone}/${m} monthlies completed`;
  }, [prog.total, prog.done, state.monthly, monthliesDone]);

  function acceptCoachSuggestion(s) {
    const hour = s?.hour || "09:00";
    const cat = CATEGORIES.includes(s?.category) ? s.category : "Personal";
    const text = normalizeText(s?.text);
    if (!text) return;
    ensureHour(hour);
    addTask(hour, cat, text);
  }

  async function askCoach() {
    setCoachError("");
    setCoachLoading(true);

    try {
      const payload = {
        dayKey: tKey,
        prettyDate: prettyToday(),
        progress: prog,
        today: todayHours,
        monthly: state.monthly || [],
        categories: CATEGORIES,
      };

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.error || data?.message || `Coach error (${res.status})`;
        throw new Error(msg);
      }

      const shaped = {
        message: data?.message || data?.summary || "",
        highlights: data?.highlights || data?.focus || [],
        suggestions: (data?.suggestions || []).map((x) => ({
          id: x.id || uid(),
          hour: x.hour || x.time || "09:00",
          category: x.category || x.cat || "Personal",
          text: x.text || x.task || "",
        })),
        ignoredMonthlies: (data?.ignoredMonthlies || data?.ignoredMonthly || []).map((x) => ({
          id: x.id || uid(),
          text: x.text || x.task || String(x),
        })),
        percentSummary: data?.percentSummary || data?.completion || "",
      };

      shaped.onAcceptSuggestion = (s) => acceptCoachSuggestion(s);
      shaped.onDismissSuggestion = () => {};

      setCoachResult(shaped);
    } catch (err) {
      setCoachError(err?.message || "Coach failed. Check your /api/coach function logs.");
    } finally {
      setCoachLoading(false);
    }
  }

  return (
    <div className="app">
      <div className="shell">
        <header className="top">
          <div>
            <div className="kicker">cute schedule</div>
            <h1 className="h1">
              {tab === "today" ? "Today" : "Monthly"}{" "}
              <span className="sub">{tab === "today" ? prettyToday() : "Objectives"}</span>
            </h1>
          </div>

          <div className="tabs">
            <TabButton active={tab === "today"} onClick={() => setTab("today")}>
              Today
            </TabButton>
            <TabButton active={tab === "monthly"} onClick={() => setTab("monthly")}>
              Monthly
            </TabButton>
            <button type="button" className="tab" onClick={() => (setCoachOpen(true), setCoachError(""))} title="Front end coach">
              Coach
            </button>
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
                    {prog.total === 0 ? "Add your first task and we’ll start counting ✨" : `${prog.done}/${prog.total} tasks done`}
                  </div>
                </div>

                <div className="panel-right" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div className="pct">{prog.pct}%</div>
                  <button type="button" className="btn" onClick={() => setCoachOpen(true)} title="Open coach">
                    Coach
                  </button>
                </div>
              </div>

              <ProgressBar pct={prog.pct} />

              <form className="quick" onSubmit={quickAdd}>
                <div className="quick-row">
                  <label className="label">Hour</label>
                  <input className="input" type="time" value={newHour} onChange={(e) => setNewHour(e.target.value)} />
                </div>

                <div className="quick-row">
                  <label className="label">Objective</label>
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
                  <input className="input" value={quickText} onChange={(e) => setQuickText(e.target.value)} placeholder="Add a task for that hour…" />
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
                    onAddTask={addTask}
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
        ) : (
          <section className="panel">
            <div className="panel-top">
              <div className="panel-title">
                <div className="panel-title-row">
                  <span className="title">Monthly Objectives</span>
                  <span className="sparkle">✨</span>
                </div>
                <div className="meta">Big picture goals that don’t clutter Today.</div>
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
        )}

        <footer className="foot">
          <span>Saved automatically on this device.</span>
          <span className="dot">•</span>
          <span>Next upgrade: cloud sync + phone install.</span>
        </footer>
      </div>

      <CoachPanel
        open={coachOpen}
        onClose={() => setCoachOpen(false)}
        onAskCoach={askCoach}
        loading={coachLoading}
        error={coachError}
        result={coachResult}
        contextSummary={contextSummary}
      />
    </div>
  );
}

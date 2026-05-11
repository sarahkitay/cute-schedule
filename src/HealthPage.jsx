import React, { useMemo, useState } from "react";
import { CalendarIcon, CloseIcon, DumbbellIcon, RepeatIcon } from "./Icons";
import {
  WORKOUT_SAMPLES,
  addDaysToDayKey,
  computeMacroTargetsFromProfile,
  computeWorkoutConsistency,
  dayKeysForWeek,
  dayPlanToExerciseLines,
  emptyWeekPlan,
  getEffectiveWeekPlan,
  getWeekPlan,
  getWorkoutLineProgress,
  healthProfileComplete,
  mondayKeyForDayKey,
  normalizeHealth,
  workoutProgressKey,
} from "./health/healthModel";

const DAY_ORDER = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function newId(prefix) {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  } catch {}
  return `${prefix}-${Date.now()}`;
}

export function HealthPage({
  health,
  setHealth,
  profile,
  setProfile: _setProfile,
  realTodayKey,
  appState,
  onOpenHealthCalendar,
  onScheduleWorkoutTask,
}) {
  const h = useMemo(() => normalizeHealth(health), [health]);
  const [weekMonday, setWeekMonday] = useState(() => mondayKeyForDayKey(realTodayKey));
  const [saveRoutineName, setSaveRoutineName] = useState("");
  const [macroDate, setMacroDate] = useState(() => realTodayKey);
  const [weightInput, setWeightInput] = useState("");
  const [healthTab, setHealthTab] = useState("workouts");
  const [workoutRun, setWorkoutRun] = useState(null);
  const [expandedExercise, setExpandedExercise] = useState(null);

  const consistency = useMemo(
    () => computeWorkoutConsistency(appState, realTodayKey, h),
    [appState, realTodayKey, h]
  );

  const weekPlan = getEffectiveWeekPlan(h, weekMonday);
  const calMap = dayKeysForWeek(weekMonday);

  function patchWeekPlan(updater) {
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      if (base.weekRepeatEnabled) {
        const cur = { ...emptyWeekPlan(), ...(base.weekRepeatTemplate || {}) };
        const next = typeof updater === "function" ? updater(cur) : updater;
        return { ...base, weekRepeatTemplate: next };
      }
      const cur = getWeekPlan(base, weekMonday);
      const next = typeof updater === "function" ? updater({ ...cur }) : updater;
      return { ...base, weekPlans: { ...base.weekPlans, [weekMonday]: next } };
    });
  }

  function patchProfile(partial) {
    setHealth((prev) => ({
      ...normalizeHealth(prev),
      profile: { ...normalizeHealth(prev).profile, ...partial },
    }));
  }

  function applyCalculator() {
    const p = normalizeHealth(h).profile;
    const t = computeMacroTargetsFromProfile(p);
    if (!t) return;
    setHealth((prev) => ({ ...normalizeHealth(prev), macroTargets: t }));
  }

  function repeatLastWeek() {
    const prevMon = addDaysToDayKey(weekMonday, -7);
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      const src = getEffectiveWeekPlan(base, prevMon);
      const has = DAY_ORDER.some((d) => String(src[d.key] || "").trim());
      if (!has) return base;
      if (base.weekRepeatEnabled) {
        return { ...base, weekRepeatTemplate: { ...src } };
      }
      return { ...base, weekPlans: { ...base.weekPlans, [weekMonday]: { ...src } } };
    });
  }

  function setWeekRepeat(on) {
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      if (on) {
        const cur = getEffectiveWeekPlan(base, weekMonday);
        return { ...base, weekRepeatEnabled: true, weekRepeatTemplate: { ...emptyWeekPlan(), ...cur } };
      }
      const tpl = base.weekRepeatTemplate && typeof base.weekRepeatTemplate === "object" ? base.weekRepeatTemplate : null;
      const nextPlans = { ...base.weekPlans };
      if (tpl) {
        nextPlans[weekMonday] = { ...emptyWeekPlan(), ...tpl };
      }
      return { ...base, weekRepeatEnabled: false, weekRepeatTemplate: null, weekPlans: nextPlans };
    });
  }

  function loadSample(sample) {
    patchWeekPlan(() => {
      const next = { ...emptyWeekPlan() };
      for (const d of DAY_ORDER) {
        const a = String(sample.days[d.key] || "").trim();
        const b = String(weekPlan[d.key] || "").trim();
        next[d.key] = a ? (b ? `${b}\n\n${a}` : a) : b;
      }
      return next;
    });
  }

  function saveRoutine() {
    const name = saveRoutineName.trim();
    if (!name) return;
    const id = newId("rt");
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      return {
        ...base,
        savedRoutines: [...(base.savedRoutines || []), { id, name, days: { ...weekPlan } }],
      };
    });
    setSaveRoutineName("");
  }

  function loadSavedRoutine(id) {
    const r = (h.savedRoutines || []).find((x) => x.id === id);
    if (!r) return;
    patchWeekPlan(() => ({ ...emptyWeekPlan(), ...r.days }));
  }

  const macroEntry = h.macroLog[macroDate] || { calories: "", protein: "", carbs: "", fat: "" };
  const targets = h.macroTargets;

  function setMacroField(field, val) {
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      const cur = { ...(base.macroLog[macroDate] || {}) };
      cur[field] = val;
      return {
        ...base,
        macroLog: { ...base.macroLog, [macroDate]: cur },
      };
    });
  }

  function addWeight() {
    const kg = parseFloat(String(weightInput).replace(",", "."));
    if (!Number.isFinite(kg) || kg < 20 || kg > 400) return;
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      return {
        ...base,
        weightLog: [...(base.weightLog || []), { at: new Date().toISOString(), kg }].slice(-365),
        profile: { ...base.profile, weightKg: kg },
      };
    });
    setWeightInput("");
  }

  function patchLineProgress(dayKey, lineIdx, partial) {
    const key = workoutProgressKey(weekMonday, dayKey, lineIdx);
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      const prevRow = getWorkoutLineProgress(base, key);
      return {
        ...base,
        workoutProgress: {
          ...(base.workoutProgress && typeof base.workoutProgress === "object" ? base.workoutProgress : {}),
          [key]: { ...prevRow, ...partial },
        },
      };
    });
  }

  function markAllExercisesDone(dayKey, count) {
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      const wp = { ...(base.workoutProgress && typeof base.workoutProgress === "object" ? base.workoutProgress : {}) };
      for (let i = 0; i < count; i++) {
        const key = workoutProgressKey(weekMonday, dayKey, i);
        const prevRow = getWorkoutLineProgress(base, key);
        wp[key] = { ...prevRow, done: true };
      }
      return { ...base, workoutProgress: wp };
    });
  }

  const lastWeight = (h.weightLog || []).length ? h.weightLog[h.weightLog.length - 1].kg : h.profile.weightKg;
  const goalW = h.profile.goalWeightKg;
  let weightBarPct = 0;
  if (lastWeight != null && goalW != null && h.profile.weightKg != null) {
    const start = h.profile.weightKg;
    if (h.profile.goal === "loss" && start > goalW) {
      weightBarPct = Math.round(100 * Math.min(1, Math.max(0, (start - lastWeight) / (start - goalW))));
    } else if (h.profile.goal === "gain" && start < goalW) {
      weightBarPct = Math.round(100 * Math.min(1, Math.max(0, (lastWeight - start) / (goalW - start))));
    } else if (h.profile.goal === "maintain") {
      const span = Math.max(1, Math.abs(start * 0.02));
      weightBarPct = Math.round(100 * Math.max(0, 1 - Math.abs(lastWeight - goalW) / span));
    }
  }

  const profileOk = healthProfileComplete(h);
  const runLines = workoutRun ? dayPlanToExerciseLines(weekPlan[workoutRun.dayKey] || "") : [];

  return (
    <section className="panel health-panel surface-glass scroll-reveal section-health">
      <div className="panel-top health-page-head">
        <div className="panel-title">
          <DumbbellIcon style={{ width: 22, height: 22, marginRight: 8 }} />
          <div>
            <div className="title">Health &amp; training</div>
            <div className="meta">Weekly plan, macros, weight. Your coach can see a short summary of this.</div>
          </div>
        </div>
      </div>

      <div className="health-segment-toggle" role="tablist" aria-label="Health section">
        <button
          type="button"
          role="tab"
          aria-selected={healthTab === "workouts"}
          className={`health-segment-btn ${healthTab === "workouts" ? "health-segment-btn--on" : ""}`}
          onClick={() => setHealthTab("workouts")}
        >
          Workouts
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={healthTab === "macros"}
          className={`health-segment-btn ${healthTab === "macros" ? "health-segment-btn--on" : ""}`}
          onClick={() => setHealthTab("macros")}
        >
          Macros
        </button>
      </div>

      {healthTab === "workouts" ? (
        <>
          <div className="panel-title health-week-program-title">
            <span className="title">This week&apos;s program</span>
          </div>
          <p className="settings-hint health-week-program-hint">
            Calendar day for each card:{" "}
            {DAY_ORDER.map((d) => (
              <span key={d.key} style={{ marginRight: 8 }}>
                <strong>{d.label}</strong> {calMap[d.key]}
              </span>
            ))}
          </p>
          <div className="health-day-grid">
            {DAY_ORDER.map((d) => {
              const dayText = weekPlan[d.key] || "";
              const lines = dayPlanToExerciseLines(dayText);
              return (
                <div key={d.key} className="health-day-card surface-glass health-day-card--tasky">
                  <div className="health-day-card-title">{d.label} · {calMap[d.key]}</div>
                  <textarea
                    className="input health-day-textarea"
                    rows={4}
                    value={dayText}
                    onChange={(e) =>
                      patchWeekPlan((prev) => ({
                        ...prev,
                        [d.key]: e.target.value,
                      }))
                    }
                    placeholder="One exercise per line…"
                    aria-label={`Workout plan ${d.label}`}
                  />
                  <div className="health-day-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={!String(dayText).trim()}
                      onClick={() => {
                        setExpandedExercise(null);
                        setWorkoutRun({ dayKey: d.key, label: d.label });
                      }}
                    >
                      Start workout
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={!String(dayText).trim() || !onScheduleWorkoutTask}
                      onClick={() => {
                        const title = `Workout · ${d.label}`;
                        onScheduleWorkoutTask(title, dayText.trim());
                      }}
                    >
                      Add to Today as task
                    </button>
                  </div>
                  {lines.length > 0 ? (
                    <ul className="health-day-preview-list">
                      {lines.slice(0, 4).map((ln) => (
                        <li key={ln.id} className="health-day-preview-item">
                          {ln.text.length > 56 ? `${ln.text.slice(0, 56)}…` : ln.text}
                        </li>
                      ))}
                      {lines.length > 4 ? <li className="settings-hint">+{lines.length - 4} more</li> : null}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="health-consistency surface-glass health-consistency--after-program">
            <div className="health-consistency-head">
              <span className="title">Workout rhythm this week</span>
              <span className="health-consistency-meta">
                {consistency.scheduleDays}/7 days scheduled · {consistency.completed}/{consistency.target} completed
              </span>
            </div>
            <div className="health-progress-track" role="progressbar" aria-valuenow={consistency.blendPct} aria-valuemin={0} aria-valuemax={100}>
              <div className="health-progress-fill" style={{ width: `${consistency.blendPct}%` }} />
            </div>
            <p className="settings-hint" style={{ marginTop: 8, marginBottom: 0 }}>
              Half from days with a <strong>workout</strong> task on the schedule, half from completed workout tasks vs your weekly target.
            </p>
          </div>

          <div className="health-week-toolbar health-week-toolbar--chips">
            {onOpenHealthCalendar ? (
              <button
                type="button"
                className="btn btn-icon health-calendar-icon-btn"
                title="Full calendar"
                aria-label="Open full calendar"
                onClick={() => onOpenHealthCalendar(weekMonday)}
              >
                <CalendarIcon style={{ width: 22, height: 22 }} />
              </button>
            ) : null}
            <button type="button" className="btn btn-sm" onClick={() => setWeekMonday(mondayKeyForDayKey(realTodayKey))}>
              This week
            </button>
            <button type="button" className="btn btn-sm" onClick={repeatLastWeek}>
              Repeat last week
            </button>
            <span className="health-week-label">{h.weekRepeatEnabled ? "Repeating plan" : `Week of ${weekMonday}`}</span>
            <button
              type="button"
              className={`btn btn-sm health-repeat-lock ${h.weekRepeatEnabled ? "health-repeat-lock--on" : ""}`}
              aria-pressed={h.weekRepeatEnabled}
              title={h.weekRepeatEnabled ? "Stop repeating this plan every week" : "Repeat this plan every week until turned off"}
              onClick={() => setWeekRepeat(!h.weekRepeatEnabled)}
            >
              <RepeatIcon />
              <span>{h.weekRepeatEnabled ? "Repeating on" : "Repeat plan"}</span>
            </button>
          </div>

          <div className="health-samples">
            <div className="panel-title" style={{ marginBottom: 8 }}>
              <span className="title">Sample programs</span>
            </div>
            <p className="settings-hint" style={{ marginBottom: 10 }}>
              Tap to merge sample text into your week (won&apos;t erase existing notes on a day).
            </p>
            <div className="health-sample-buttons">
              {WORKOUT_SAMPLES.map((s) => (
                <button key={s.id} type="button" className="btn" onClick={() => loadSample(s)} title={s.blurb}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="health-saved-routines">
            <div className="panel-title" style={{ marginBottom: 8 }}>
              <span className="title">Saved routines</span>
            </div>
            {(h.savedRoutines || []).length === 0 ? (
              <p className="settings-hint">None yet. Plan your week above, then save with a name.</p>
            ) : (
              <ul className="health-saved-list">
                {(h.savedRoutines || []).map((r) => (
                  <li key={r.id}>
                    <button type="button" className="btn btn-sm" onClick={() => loadSavedRoutine(r.id)}>
                      Load
                    </button>
                    <span>{r.name}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="health-save-routine-row">
              <input
                className="input"
                placeholder="Name this week&apos;s plan…"
                value={saveRoutineName}
                onChange={(e) => setSaveRoutineName(e.target.value)}
                aria-label="Routine name"
              />
              <button type="button" className="btn-primary" onClick={saveRoutine} disabled={!saveRoutineName.trim()}>
                Save to library
              </button>
            </div>
          </div>

          {!profileOk ? (
            <p className="settings-hint" style={{ marginTop: 16 }}>
              Add age, height, and weight in <strong>Macros</strong> to unlock the <strong>Workout</strong> task type in Today&apos;s quick add (Details).
            </p>
          ) : (
            <p className="settings-hint" style={{ marginTop: 16 }}>
              Workout task type is available in Today → Details when adding a task.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="health-macro-block surface-glass">
            <div className="panel-title" style={{ marginBottom: 8 }}>
              <span className="title">Macro &amp; calorie calculator</span>
            </div>
            <p className="settings-hint">Uses Mifflin–St Jeor × activity, then adjusts for your goal. Saves targets below.</p>
            <div className="health-calc-grid">
              <label className="quick-row">
                <span className="label">Age</span>
                <input
                  className="input"
                  type="number"
                  min={14}
                  max={100}
                  value={h.profile.age ?? ""}
                  onChange={(e) => patchProfile({ age: e.target.value === "" ? null : Math.round(Number(e.target.value)) })}
                />
              </label>
              <label className="quick-row">
                <span className="label">Sex (for BMR)</span>
                <select className="input" value={h.profile.sex} onChange={(e) => patchProfile({ sex: e.target.value })}>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other / prefer blend</option>
                </select>
              </label>
              <label className="quick-row">
                <span className="label">Height (cm)</span>
                <input
                  className="input"
                  type="number"
                  value={h.profile.heightCm ?? ""}
                  onChange={(e) =>
                    patchProfile({ heightCm: e.target.value === "" ? null : Math.round(Number(e.target.value)) })
                  }
                />
              </label>
              <label className="quick-row">
                <span className="label">Weight (kg)</span>
                <input
                  className="input"
                  type="number"
                  value={h.profile.weightKg ?? ""}
                  onChange={(e) =>
                    patchProfile({ weightKg: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </label>
              <label className="quick-row">
                <span className="label">Goal</span>
                <select className="input" value={h.profile.goal} onChange={(e) => patchProfile({ goal: e.target.value })}>
                  <option value="loss">Fat loss (~−500 kcal)</option>
                  <option value="maintain">Maintenance</option>
                  <option value="gain">Muscle gain (~+300 kcal)</option>
                </select>
              </label>
              <label className="quick-row">
                <span className="label">Activity</span>
                <select
                  className="input"
                  value={String(h.profile.activity)}
                  onChange={(e) => patchProfile({ activity: Number(e.target.value) })}
                >
                  <option value="1.2">Mostly seated</option>
                  <option value="1.375">Light / walks</option>
                  <option value="1.55">Moderate training</option>
                  <option value="1.725">Hard daily + training</option>
                </select>
              </label>
            </div>
            <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={applyCalculator}>
              Apply targets to tracker
            </button>
            {targets?.calories ? (
              <p className="health-macro-targets" style={{ marginTop: 12 }}>
                Targets: <strong>{targets.calories}</strong> kcal · P <strong>{targets.proteinG}</strong>g · C{" "}
                <strong>{targets.carbsG}</strong>g · F <strong>{targets.fatG}</strong>g
              </p>
            ) : (
              <p className="settings-hint" style={{ marginTop: 12 }}>
                Fill age, height, weight, then apply.
              </p>
            )}
          </div>

          <div className="health-macro-block surface-glass">
            <div className="panel-title" style={{ marginBottom: 8 }}>
              <span className="title">Macro tracker</span>
            </div>
            <p className="settings-hint">Log meals or macros by day. Targets show as bars when set.</p>
            <label className="quick-row">
              <span className="label">Date</span>
              <input className="input" type="date" value={macroDate} onChange={(e) => setMacroDate(e.target.value)} />
            </label>
            <div className="health-calc-grid" style={{ marginTop: 10 }}>
              {["protein", "carbs", "fat", "calories"].map((field) => (
                <label key={field} className="quick-row">
                  <span className="label">{field === "calories" ? "Calories" : `${field} (g)`}</span>
                  <input
                    className="input"
                    type="number"
                    value={macroEntry[field] ?? ""}
                    onChange={(e) => setMacroField(field, e.target.value === "" ? "" : e.target.value)}
                  />
                </label>
              ))}
            </div>
            {targets?.calories ? (
              <div className="health-macro-bars" style={{ marginTop: 14 }}>
                {["calories", "protein", "carbs", "fat"].map((k) => {
                  const tgt =
                    k === "calories"
                      ? targets.calories
                      : targets[`${k === "protein" ? "protein" : k === "carbs" ? "carbs" : "fat"}G`];
                  const raw = macroEntry[k];
                  const cur = raw === "" || raw == null ? 0 : Number(raw);
                  const pct = tgt > 0 ? Math.min(150, Math.round((cur / tgt) * 100)) : 0;
                  return (
                    <div key={k} className="health-mini-bar">
                      <span>{k}</span>
                      <div className="health-progress-track">
                        <div className="health-progress-fill health-progress-fill-soft" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="health-mini-bar-val">
                        {cur || 0}/{tgt}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="health-macro-block surface-glass">
            <div className="panel-title" style={{ marginBottom: 8 }}>
              <span className="title">Weight &amp; goal</span>
            </div>
            <label className="quick-row">
              <span className="label">Goal weight (kg)</span>
              <input
                className="input"
                type="number"
                value={h.profile.goalWeightKg ?? ""}
                onChange={(e) =>
                  patchProfile({ goalWeightKg: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </label>
            <label className="quick-row">
              <span className="label">Weekly workout target (for progress ring)</span>
              <input
                className="input"
                type="number"
                min={1}
                max={14}
                value={h.profile.weeklyWorkoutTarget}
                onChange={(e) =>
                  patchProfile({
                    weeklyWorkoutTarget: Math.max(1, Math.min(14, Math.round(Number(e.target.value) || 3))),
                  })
                }
              />
            </label>
            <div className="health-weight-add">
              <input
                className="input"
                type="number"
                placeholder="Log weight kg"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                aria-label="Weight in kg"
              />
              <button type="button" className="btn-primary" onClick={addWeight}>
                Log weight
              </button>
            </div>
            {goalW != null && lastWeight != null ? (
              <div style={{ marginTop: 12 }}>
                <div className="health-progress-track" role="progressbar" aria-valuenow={weightBarPct}>
                  <div className="health-progress-fill health-progress-fill-goal" style={{ width: `${weightBarPct}%` }} />
                </div>
                <p className="settings-hint" style={{ marginTop: 6 }}>
                  Progress toward goal weight {goalW}kg (latest log: {lastWeight}kg).
                </p>
              </div>
            ) : (
              <p className="settings-hint" style={{ marginTop: 8 }}>
                Set a goal weight and log entries to see a gentle progress bar.
              </p>
            )}
            {(h.weightLog || []).length > 0 && (
              <ul className="health-weight-log">
                {[...(h.weightLog || [])]
                  .reverse()
                  .slice(0, 8)
                  .map((e, i) => (
                    <li key={`${e.at}-${i}`}>
                      {e.at.slice(0, 10)} - {e.kg} kg
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </>
      )}

      {workoutRun ? (
        <div
          className="modal-overlay health-workout-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="health-workout-run-title"
          onClick={() => {
            setWorkoutRun(null);
            setExpandedExercise(null);
          }}
        >
          <div className="modal health-workout-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="health-workout-sheet-head">
              <h3 id="health-workout-run-title" className="health-workout-sheet-title">
                Workout · {workoutRun.label}
              </h3>
              <button
                type="button"
                className="btn-icon"
                aria-label="Close"
                onClick={() => {
                  setWorkoutRun(null);
                  setExpandedExercise(null);
                }}
              >
                <CloseIcon style={{ width: 22, height: 22 }} />
              </button>
            </div>
            <p className="settings-hint" style={{ marginBottom: 12 }}>
              Tap a row to log weight, time, rest, or notes. Check off as you go, or use <strong>Workout completed</strong> at the bottom.
            </p>
            <ul className="health-exercise-list">
              {runLines.map((ln, idx) => {
                const pk = workoutProgressKey(weekMonday, workoutRun.dayKey, idx);
                const prog = getWorkoutLineProgress(h, pk);
                const open = expandedExercise === idx;
                return (
                  <li key={ln.id} className={`health-exercise-row ${prog.done ? "health-exercise-row--done" : ""}`}>
                    <label className="health-exercise-check">
                      <input
                        type="checkbox"
                        checked={prog.done}
                        onChange={(e) => patchLineProgress(workoutRun.dayKey, idx, { done: e.target.checked })}
                      />
                      <span className="health-exercise-check-ui" />
                    </label>
                    <button type="button" className="health-exercise-main" onClick={() => setExpandedExercise(open ? null : idx)}>
                      <span className="health-exercise-text">{ln.text}</span>
                      <span className="health-exercise-chev">{open ? "▾" : "▸"}</span>
                    </button>
                    {open ? (
                      <div className="health-exercise-detail surface-glass">
                        <label className="quick-row">
                          <span className="label">Weight / load</span>
                          <input
                            className="input"
                            value={prog.weight}
                            placeholder="e.g. 135 lb"
                            onChange={(e) => patchLineProgress(workoutRun.dayKey, idx, { weight: e.target.value })}
                          />
                        </label>
                        <label className="quick-row">
                          <span className="label">Time / duration</span>
                          <input
                            className="input"
                            value={prog.duration}
                            placeholder="e.g. 12 min"
                            onChange={(e) => patchLineProgress(workoutRun.dayKey, idx, { duration: e.target.value })}
                          />
                        </label>
                        <label className="quick-row">
                          <span className="label">Rest (min)</span>
                          <input
                            className="input"
                            value={prog.breakMin}
                            placeholder="e.g. 2"
                            onChange={(e) => patchLineProgress(workoutRun.dayKey, idx, { breakMin: e.target.value })}
                          />
                        </label>
                        <label className="quick-row">
                          <span className="label">Notes</span>
                          <textarea
                            className="input health-exercise-notes"
                            rows={2}
                            value={prog.notes}
                            onChange={(e) => patchLineProgress(workoutRun.dayKey, idx, { notes: e.target.value })}
                          />
                        </label>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {runLines.length === 0 ? <p className="settings-hint">Add exercises as lines in the day card first.</p> : null}
            <div className="health-workout-footer">
              <button
                type="button"
                className="btn btn-primary"
                disabled={runLines.length === 0}
                onClick={() => markAllExercisesDone(workoutRun.dayKey, runLines.length)}
              >
                Workout completed
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setWorkoutRun(null);
                  setExpandedExercise(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

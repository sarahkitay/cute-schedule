import React, { useEffect, useMemo, useRef, useState } from "react";
import { CloseIcon, DumbbellIcon, MacroCalculatorIcon } from "./Icons";
import {
  PROGRAM_LIBRARY,
  addDaysToDayKey,
  cmToFeetInches,
  computeMacroTargetsFromProfile,
  computeWorkoutConsistency,
  feetInchesToCm,
  formatExerciseBlockLine,
  formatWeightLbFromKg,
  getWorkoutLineProgress,
  guidedSessionProgressKey,
  healthProfileComplete,
  lbToKg,
  listSelectablePrograms,
  mondayKeyForDayKey,
  normalizeExerciseBlock,
  normalizeHealth,
  normalizeProgramRecord,
  normalizeMacroDayEntry,
  sumMacroDayTotals,
} from "./health/healthModel";

function newId(prefix) {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  } catch {}
  return `${prefix}-${Date.now()}`;
}

function GuidedWorkoutOverlay({ session, health, setHealth, onClose, onMarkTaskDone }) {
  const h = useMemo(() => normalizeHealth(health), [health]);
  const rawEx = session.exercises || [];
  const blocks = useMemo(
    () => rawEx.map((ex) => normalizeExerciseBlock(ex)).filter(Boolean),
    [rawEx]
  );
  const total = blocks.length;
  const [step, setStep] = useState(0);
  const [viewMode, setViewMode] = useState("one");
  const [notesOpen, setNotesOpen] = useState(false);

  const safeStep = Math.min(step, Math.max(0, total - 1));

  useEffect(() => {
    setStep(0);
    setViewMode("one");
    setNotesOpen(false);
  }, [session.taskId, session.programId]);

  const pk = guidedSessionProgressKey(session.taskId, session.programId, safeStep);
  const prog = getWorkoutLineProgress(h, pk);
  const curBlock = blocks[safeStep];

  function patchRowAt(idx, partial) {
    const key = guidedSessionProgressKey(session.taskId, session.programId, idx);
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

  function patchRow(partial) {
    patchRowAt(safeStep, partial);
  }

  function markAllDone() {
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      const wp = { ...(base.workoutProgress && typeof base.workoutProgress === "object" ? base.workoutProgress : {}) };
      for (let i = 0; i < total; i++) {
        const key = guidedSessionProgressKey(session.taskId, session.programId, i);
        const prevRow = getWorkoutLineProgress(base, key);
        wp[key] = { ...prevRow, done: true };
      }
      return { ...base, workoutProgress: wp };
    });
  }

  function onToggleDone(checked) {
    patchRow({ done: checked });
    if (checked && viewMode === "one" && safeStep < total - 1) {
      setNotesOpen(false);
      setStep((s) => Math.min(total - 1, s + 1));
    }
  }

  if (!session || !total || !curBlock) return null;

  return (
    <div
      className="modal-overlay health-workout-overlay health-guided-overlay health-guided-overlay--fullscreen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guided-wk-title"
      onClick={onClose}
    >
      <div className="modal health-workout-sheet health-guided-sheet health-guided-sheet-full surface-glass" onClick={(e) => e.stopPropagation()}>
        <div className="health-workout-sheet-head health-guided-head">
          <h3 id="guided-wk-title" className="health-workout-sheet-title">
            {session.programName || "Workout"}
          </h3>
          <button type="button" className="btn-icon" aria-label="Close" onClick={onClose}>
            <CloseIcon style={{ width: 22, height: 22 }} />
          </button>
        </div>

        <div className="health-guided-mode-row" role="group" aria-label="Practice layout">
          <button type="button" className={`btn btn-sm ${viewMode === "one" ? "btn-primary" : ""}`} onClick={() => setViewMode("one")}>
            One at a time
          </button>
          <button type="button" className={`btn btn-sm ${viewMode === "list" ? "btn-primary" : ""}`} onClick={() => setViewMode("list")}>
            View all
          </button>
        </div>

        {viewMode === "list" ? (
          <ul className="health-exercise-list health-guided-list">
            {blocks.map((b, i) => {
              const key = guidedSessionProgressKey(session.taskId, session.programId, i);
              const row = getWorkoutLineProgress(h, key);
              return (
                <li key={key} className={`health-exercise-row surface-glass ${row.done ? "health-exercise-row--done" : ""}`}>
                  <label className="health-exercise-check">
                    <input type="checkbox" checked={row.done} onChange={(e) => patchRowAt(i, { done: e.target.checked })} />
                    <span className="health-exercise-check-ui" />
                  </label>
                  <div className="health-exercise-text-block">
                    <div className="health-exercise-text">{b.name || "Exercise"}</div>
                    {(b.setsReps || b.weightNote) && (
                      <div className="settings-hint" style={{ marginTop: 4 }}>
                        {[b.setsReps, b.weightNote].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="health-guided-one">
            <p className="health-guided-step-label">
              Exercise {safeStep + 1} of {total}
            </p>
            <div className="health-guided-exercise-title">{curBlock.name || "Exercise"}</div>
            {(curBlock.setsReps || curBlock.weightNote) && (
              <div className="health-guided-exercise-meta surface-glass">
                {curBlock.setsReps ? (
                  <div>
                    <span className="health-guided-meta-label">Sets / reps</span>
                    <div className="health-guided-meta-val">{curBlock.setsReps}</div>
                  </div>
                ) : null}
                {curBlock.weightNote ? (
                  <div>
                    <span className="health-guided-meta-label">Planned weight</span>
                    <div className="health-guided-meta-val">{curBlock.weightNote}</div>
                  </div>
                ) : null}
              </div>
            )}
            <label className="health-exercise-check health-guided-done-toggle">
              <input type="checkbox" checked={prog.done} onChange={(e) => onToggleDone(e.target.checked)} />
              <span className="health-exercise-check-ui" />
              <span>Done (goes to next)</span>
            </label>
            <button type="button" className="btn btn-sm health-guided-add-notes" onClick={() => setNotesOpen((v) => !v)}>
              {notesOpen ? "Hide notes" : "Add notes"}
            </button>
            {notesOpen ? (
              <div className="health-exercise-detail surface-glass health-guided-fields">
                <label className="quick-row">
                  <span className="label">Weight / load</span>
                  <input className="input" value={prog.weight} placeholder="e.g. 135 lb" onChange={(e) => patchRow({ weight: e.target.value })} />
                </label>
                <label className="quick-row">
                  <span className="label">Time / duration</span>
                  <input className="input" value={prog.duration} placeholder="e.g. 12 min" onChange={(e) => patchRow({ duration: e.target.value })} />
                </label>
                <label className="quick-row">
                  <span className="label">Rest (min)</span>
                  <input className="input" value={prog.breakMin} placeholder="e.g. 2" onChange={(e) => patchRow({ breakMin: e.target.value })} />
                </label>
                <label className="quick-row">
                  <span className="label">Notes</span>
                  <textarea className="input health-exercise-notes" rows={2} value={prog.notes} onChange={(e) => patchRow({ notes: e.target.value })} />
                </label>
              </div>
            ) : null}
            <div className="health-guided-nav">
              <button type="button" className="btn" disabled={safeStep <= 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                Previous
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={safeStep >= total - 1}
                onClick={() => {
                  setNotesOpen(false);
                  setStep((s) => Math.min(total - 1, s + 1));
                }}
              >
                Next exercise
              </button>
            </div>
          </div>
        )}

        <div className="health-workout-footer health-guided-footer">
          <button type="button" className="btn btn-primary" onClick={() => markAllDone()}>
            Mark all moves done
          </button>
          {onMarkTaskDone ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                markAllDone();
                onMarkTaskDone();
                onClose();
              }}
            >
              Finish &amp; check off task
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
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
  onPracticeProgram,
  guidedSession = null,
  onClearGuidedSession,
  onMarkGuidedTaskDone,
}) {
  const h = useMemo(() => normalizeHealth(health), [health]);
  const [macroDate, setMacroDate] = useState(() => realTodayKey);
  const [heightFtStr, setHeightFtStr] = useState("");
  const [heightInStr, setHeightInStr] = useState("");
  const [weightLbStr, setWeightLbStr] = useState("");
  const [goalLbStr, setGoalLbStr] = useState("");
  const [logWeightLbStr, setLogWeightLbStr] = useState("");
  const [healthTab, setHealthTab] = useState("workouts");

  const [draftName, setDraftName] = useState("");
  const [draftExercises, setDraftExercises] = useState([]);
  const [draftExName, setDraftExName] = useState("");
  const [draftExSets, setDraftExSets] = useState("");
  const [draftExWeight, setDraftExWeight] = useState("");
  const [editingProgramId, setEditingProgramId] = useState(null);
  const [pasteName, setPasteName] = useState("");
  const [pasteBody, setPasteBody] = useState("");
  const [routineAddId, setRoutineAddId] = useState("");
  const [mealLabel, setMealLabel] = useState("");
  const [mealFood, setMealFood] = useState("");
  const [mealPrepMode, setMealPrepMode] = useState(false);
  const [mealPrepDayKeys, setMealPrepDayKeys] = useState(() => []);
  const [mealProtein, setMealProtein] = useState("");
  const [mealCarbs, setMealCarbs] = useState("");
  const [mealFat, setMealFat] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const [macroOverviewOpen, setMacroOverviewOpen] = useState(false);
  const macroTargetsApplied = !!(h.macroTargets?.calories);
  const [macroCalcExpanded, setMacroCalcExpanded] = useState(() => !macroTargetsApplied);
  const prevMacroTargetsRef = useRef(macroTargetsApplied);

  useEffect(() => {
    if (prevMacroTargetsRef.current === false && macroTargetsApplied) {
      setMacroCalcExpanded(false);
    }
    prevMacroTargetsRef.current = macroTargetsApplied;
  }, [macroTargetsApplied]);

  const prevHealthTabRef = useRef(healthTab);
  useEffect(() => {
    if (prevHealthTabRef.current !== "macros" && healthTab === "macros" && !macroTargetsApplied) {
      setMacroCalcExpanded(true);
    }
    prevHealthTabRef.current = healthTab;
  }, [healthTab, macroTargetsApplied]);

  useEffect(() => {
    setMealLabel("");
    setMealFood("");
    setMealProtein("");
    setMealCarbs("");
    setMealFat("");
    setMealCalories("");
    setMealPrepDayKeys([macroDate]);
  }, [macroDate]);

  useEffect(() => {
    if (guidedSession?.exercises?.length) setHealthTab("workouts");
  }, [guidedSession?.taskId, guidedSession?.programId, guidedSession?.exercises?.length]);

  useEffect(() => {
    const { feet, inches } = cmToFeetInches(h.profile.heightCm);
    setHeightFtStr(feet === "" ? "" : String(feet));
    setHeightInStr(inches === "" ? "" : String(inches));
  }, [h.profile.heightCm]);

  useEffect(() => {
    setWeightLbStr(formatWeightLbFromKg(h.profile.weightKg));
  }, [h.profile.weightKg]);

  useEffect(() => {
    setGoalLbStr(formatWeightLbFromKg(h.profile.goalWeightKg));
  }, [h.profile.goalWeightKg]);

  const consistency = useMemo(
    () => computeWorkoutConsistency(appState, realTodayKey, h),
    [appState, realTodayKey, h]
  );

  const selectable = useMemo(() => listSelectablePrograms(h), [h]);

  const displayPrograms = useMemo(() => {
    const user = h.programs || [];
    const userIds = new Set(user.map((p) => p.id));
    const builtIns = PROGRAM_LIBRARY.filter((lib) => !userIds.has(lib.id));
    return [...user, ...builtIns];
  }, [h.programs]);

  const macroWeekDays = useMemo(() => {
    const mon = mondayKeyForDayKey(macroDate);
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return labels.map((label, i) => ({ label, dayKey: addDaysToDayKey(mon, i) }));
  }, [macroDate]);

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

  function commitHeightProfile() {
    const cm = feetInchesToCm(
      heightFtStr.trim() === "" ? "" : Number(heightFtStr),
      heightInStr.trim() === "" ? "" : Number(heightInStr)
    );
    if (cm == null) {
      patchProfile({ heightCm: null });
      return;
    }
    if (cm < 50 || cm > 280) return;
    patchProfile({ heightCm: cm });
  }

  function commitWeightLbProfile() {
    const raw = weightLbStr.trim();
    if (raw === "") {
      patchProfile({ weightKg: null });
      return;
    }
    const lb = parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(lb) || lb <= 0) return;
    const kg = lbToKg(lb);
    if (kg != null && kg >= 20 && kg <= 400) patchProfile({ weightKg: kg });
  }

  function commitGoalLbProfile() {
    const raw = goalLbStr.trim();
    if (raw === "") {
      patchProfile({ goalWeightKg: null });
      return;
    }
    const lb = parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(lb) || lb <= 0) return;
    const kg = lbToKg(lb);
    if (kg != null && kg >= 20 && kg <= 400) patchProfile({ goalWeightKg: kg });
  }

  function addDraftLine() {
    const block = normalizeExerciseBlock({
      name: draftExName,
      setsReps: draftExSets,
      weightNote: draftExWeight,
    });
    if (!block) return;
    setDraftExercises((prev) => [...prev, block]);
    setDraftExName("");
    setDraftExSets("");
    setDraftExWeight("");
  }

  function removeDraftLine(i) {
    setDraftExercises((prev) => prev.filter((_, j) => j !== i));
  }

  function moveDraftLine(i, dir) {
    setDraftExercises((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      const tmp = next[i];
      next[i] = next[j];
      next[j] = tmp;
      return next;
    });
  }

  function startEditProgram(id) {
    if (PROGRAM_LIBRARY.some((l) => l.id === id)) return;
    const p = (h.programs || []).find((x) => x.id === id);
    if (!p) return;
    setEditingProgramId(id);
    setDraftName(p.name);
    setDraftExercises([...(p.exercises || [])]);
  }

  function clearBuilder() {
    setEditingProgramId(null);
    setDraftName("");
    setDraftExercises([]);
    setDraftExName("");
    setDraftExSets("");
    setDraftExWeight("");
  }

  function saveDraftProgram() {
    const name = draftName.trim();
    if (!name || !draftExercises.length) return;
    if (editingProgramId) {
      setHealth((prev) => {
        const base = normalizeHealth(prev);
        const programs = (base.programs || []).map((p) =>
          p.id === editingProgramId ? normalizeProgramRecord({ ...p, name, exercises: draftExercises }) : p
        );
        return { ...base, programs };
      });
    } else {
      const id = newId("prog");
      const rec = normalizeProgramRecord({ id, name, exercises: draftExercises });
      if (!rec) return;
      setHealth((prev) => {
        const base = normalizeHealth(prev);
        return { ...base, programs: [...(base.programs || []), rec] };
      });
    }
    clearBuilder();
  }

  function deleteProgram(id) {
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      const programs = (base.programs || []).filter((p) => p.id !== id);
      const weekRoutineProgramIds = (base.weekRoutineProgramIds || []).filter((x) => x !== id);
      return { ...base, programs, weekRoutineProgramIds };
    });
    if (editingProgramId === id) clearBuilder();
  }

  function saveLibraryCopy(lib) {
    const src = normalizeProgramRecord(lib);
    if (!src) return;
    const id = newId("prog");
    const rec = normalizeProgramRecord({ id, name: `${src.name} (copy)`, exercises: [...src.exercises] });
    if (!rec) return;
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      return { ...base, programs: [...(base.programs || []), rec] };
    });
  }

  function addProgramToRoutine(id) {
    if (!id) return;
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      const cur = [...(base.weekRoutineProgramIds || [])];
      if (cur.includes(id)) return base;
      cur.push(id);
      return { ...base, weekRoutineProgramIds: cur.slice(0, 21) };
    });
    setRoutineAddId("");
  }

  function removeRoutineSlot(i) {
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      const cur = [...(base.weekRoutineProgramIds || [])];
      cur.splice(i, 1);
      return { ...base, weekRoutineProgramIds: cur };
    });
  }

  function moveRoutineSlot(i, dir) {
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      const cur = [...(base.weekRoutineProgramIds || [])];
      const j = i + dir;
      if (j < 0 || j >= cur.length) return base;
      const t = cur[i];
      cur[i] = cur[j];
      cur[j] = t;
      return { ...base, weekRoutineProgramIds: cur };
    });
  }

  function saveWeekBundle() {
    const name = draftName.trim();
    if (!name) return;
    const ids = [...(h.weekRoutineProgramIds || [])];
    if (!ids.length) return;
    const bundleExercises = [];
    for (const pid of ids) {
      const p = selectable.find((x) => x.id === pid);
      if (!p) continue;
      for (const ex of p.exercises || []) {
        const b = normalizeExerciseBlock(ex);
        if (b) bundleExercises.push(b);
      }
    }
    const id = newId("prog");
    const rec = normalizeProgramRecord({ id, name: `${name} (week bundle)`, exercises: bundleExercises });
    if (!rec) return;
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      return { ...base, programs: [...(base.programs || []), rec] };
    });
    clearBuilder();
  }

  function savePasteProgram() {
    const name = pasteName.trim();
    const lines = String(pasteBody || "")
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!name || !lines.length) return;
    const id = newId("prog");
    const rec = normalizeProgramRecord({ id, name, exercises: lines });
    if (!rec) return;
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      return { ...base, programs: [...(base.programs || []), rec] };
    });
    setPasteName("");
    setPasteBody("");
  }

  const targets = h.macroTargets;
  const macroDay = normalizeMacroDayEntry(h.macroLog[macroDate], macroDate);
  const macroTotals = sumMacroDayTotals(macroDay);

  function toggleMealPrepDay(dayKey) {
    setMealPrepDayKeys((prev) => {
      if (prev.includes(dayKey)) {
        if (prev.length <= 1) return prev;
        return prev.filter((k) => k !== dayKey);
      }
      return [...prev, dayKey];
    });
  }

  function saveMealEntry() {
    const protein = Math.round(Number(mealProtein) || 0);
    const carbs = Math.round(Number(mealCarbs) || 0);
    const fat = Math.round(Number(mealFat) || 0);
    const calories = Math.round(Number(mealCalories) || 0);
    if (protein + carbs + fat + calories <= 0) return;
    const food = mealFood.trim();
    const label = mealLabel.trim() || "Meal";
    let days =
      mealPrepMode && mealPrepDayKeys.length > 0
        ? [...new Set(mealPrepDayKeys)].filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
        : [macroDate];
    if (!days.length) days = [macroDate];
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      const ml = { ...base.macroLog };
      const savedAt = new Date().toISOString();
      for (const dk of days) {
        const cur = normalizeMacroDayEntry(ml[dk], dk);
        const id = newId("meal");
        const meals = [
          ...cur.meals,
          {
            id,
            label,
            food,
            protein,
            carbs,
            fat,
            calories,
            savedAt,
          },
        ];
        ml[dk] = { meals };
      }
      return { ...base, macroLog: ml };
    });
    setMealLabel("");
    setMealFood("");
    setMealProtein("");
    setMealCarbs("");
    setMealFat("");
    setMealCalories("");
  }

  function deleteMealEntry(mealId) {
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      const cur = normalizeMacroDayEntry(base.macroLog[macroDate], macroDate);
      const meals = cur.meals.filter((m) => m.id !== mealId);
      return { ...base, macroLog: { ...base.macroLog, [macroDate]: { meals } } };
    });
  }

  const macroOverviewRows = useMemo(() => {
    return Object.keys(h.macroLog || {})
      .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
      .map((k) => {
        const t = sumMacroDayTotals(h.macroLog[k]);
        const sum = t.protein + t.carbs + t.fat + t.calories;
        return { dayKey: k, ...t, sum };
      })
      .filter((r) => r.sum > 0)
      .sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))
      .slice(0, 45);
  }, [h.macroLog]);

  function addWeight() {
    const lb = parseFloat(String(logWeightLbStr).replace(",", "."));
    if (!Number.isFinite(lb) || lb <= 0) return;
    const kg = lbToKg(lb);
    if (kg == null || kg < 20 || kg > 400) return;
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      return {
        ...base,
        weightLog: [...(base.weightLog || []), { at: new Date().toISOString(), kg }].slice(-365),
        profile: { ...base.profile, weightKg: kg },
      };
    });
    setLogWeightLbStr("");
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

  return (
    <section className="panel health-panel surface-glass scroll-reveal section-health">
      <div className="panel-top health-page-head">
        <div className="panel-title">
          <DumbbellIcon style={{ width: 22, height: 22, marginRight: 8 }} />
          <div>
            <div className="title">Health &amp; training</div>
            <div className="meta">Programs for the gym tab, macros &amp; weight. Coach sees a short summary.</div>
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
              Counts days with a <strong>workout</strong> task plus completed workout tasks vs your weekly target.
            </p>
          </div>

          {onOpenHealthCalendar ? (
            <div className="health-calendar-open-block" style={{ marginTop: 10 }}>
              <button type="button" className="btn btn-sm" onClick={() => onOpenHealthCalendar(realTodayKey)}>
                Open full calendar
              </button>
              <p className="settings-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                Schedule one-off or repeating gym times from there.
              </p>
            </div>
          ) : null}

          <div className="panel-title health-week-program-title" style={{ marginTop: 18 }}>
            <span className="title">Weekly routine order</span>
          </div>
          <p className="settings-hint">
            Used when a task is set to <strong>next in weekly routine</strong>. Drag order with arrows; this does not schedule times. Use Today or the
            calendar for that.
          </p>
          <ul className="health-routine-chips">
            {(h.weekRoutineProgramIds || []).map((pid, i) => {
              const p = selectable.find((x) => x.id === pid);
              return (
                <li key={`${pid}-${i}`} className="health-routine-chip surface-glass">
                  <span className="health-routine-chip-label">{p?.name || pid}</span>
                  <span className="health-routine-chip-actions">
                    <button type="button" className="btn btn-sm" aria-label="Move up" disabled={i <= 0} onClick={() => moveRoutineSlot(i, -1)}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      aria-label="Move down"
                      disabled={i >= (h.weekRoutineProgramIds || []).length - 1}
                      onClick={() => moveRoutineSlot(i, 1)}
                    >
                      ↓
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeRoutineSlot(i)}>
                      Remove
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="health-routine-add-row">
            <select className="input" value={routineAddId} onChange={(e) => setRoutineAddId(e.target.value)} aria-label="Add program to routine">
              <option value="">Add program to rotation…</option>
              {selectable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" disabled={!routineAddId} onClick={() => addProgramToRoutine(routineAddId)}>
              Add
            </button>
          </div>
          <div className="health-save-bundle-row">
            <button type="button" className="btn btn-sm" disabled={!(h.weekRoutineProgramIds || []).length} onClick={saveWeekBundle}>
              Save routine order as one named program (bundle)
            </button>
            <span className="settings-hint">Uses the name in the builder below as the bundle title.</span>
          </div>

          <div className="panel-title health-week-program-title" style={{ marginTop: 22 }}>
            <span className="title">{editingProgramId ? "Edit program" : "Build a program"}</span>
          </div>
          <p className="settings-hint">
            Add <strong>one exercise at a time</strong> (name, sets or reps, weight or load). Save to your collection, then link tasks from Today.
          </p>
          <label className="quick-row">
            <span className="label">Program name</span>
            <input className="input" value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="e.g. Push day A" />
          </label>
          <div className="health-draft-exercise-inputs surface-glass">
            <label className="quick-row health-draft-ex-field">
              <span className="label">Exercise name</span>
              <input
                className="input"
                value={draftExName}
                onChange={(e) => setDraftExName(e.target.value)}
                placeholder="e.g. Bench press"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDraftLine();
                  }
                }}
              />
            </label>
            <label className="quick-row health-draft-ex-field">
              <span className="label">Sets / reps</span>
              <input
                className="input"
                value={draftExSets}
                onChange={(e) => setDraftExSets(e.target.value)}
                placeholder="e.g. 4×6-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDraftLine();
                  }
                }}
              />
            </label>
            <label className="quick-row health-draft-ex-field">
              <span className="label">Weight / load</span>
              <input
                className="input"
                value={draftExWeight}
                onChange={(e) => setDraftExWeight(e.target.value)}
                placeholder="e.g. 135 lb"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDraftLine();
                  }
                }}
              />
            </label>
            <div className="health-draft-ex-add-wrap">
              <button type="button" className="btn btn-primary" onClick={addDraftLine}>
                Add exercise
              </button>
            </div>
          </div>
          <ol className="health-draft-exercises">
            {draftExercises.map((ex, i) => (
              <li key={`${i}-${formatExerciseBlockLine(ex)}`} className="health-draft-exercise surface-glass">
                <div className="health-draft-exercise-text">
                  <div className="health-draft-ex-line">
                    <strong>{ex.name || "Exercise"}</strong>
                  </div>
                  {(ex.setsReps || ex.weightNote) && (
                    <div className="settings-hint" style={{ marginTop: 4 }}>
                      {[ex.setsReps, ex.weightNote].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <span className="health-draft-exercise-actions">
                  <button type="button" className="btn btn-sm" disabled={i <= 0} onClick={() => moveDraftLine(i, -1)}>
                    ↑
                  </button>
                  <button type="button" className="btn btn-sm" disabled={i >= draftExercises.length - 1} onClick={() => moveDraftLine(i, 1)}>
                    ↓
                  </button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeDraftLine(i)}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <div className="health-draft-actions">
            <button type="button" className="btn btn-primary" disabled={!draftName.trim() || !draftExercises.length} onClick={saveDraftProgram}>
              {editingProgramId ? "Update program" : "Save to my programs"}
            </button>
            <button type="button" className="btn" onClick={clearBuilder}>
              Clear builder
            </button>
          </div>

          <div className="health-saved-routines" style={{ marginTop: 28 }}>
            <div className="panel-title" style={{ marginBottom: 8 }}>
              <span className="title">My programs</span>
            </div>
            <p className="settings-hint" style={{ marginTop: 0 }}>
              Sample programs are listed with yours. Save a copy to customize, or build your own below. You can also paste from Coach.
            </p>
            <ul className="health-program-cards">
              {displayPrograms.map((p) => {
                const builtIn = PROGRAM_LIBRARY.some((lib) => lib.id === p.id);
                const taskBody = (p.exercises || [])
                  .map((ex) => formatExerciseBlockLine(ex))
                  .filter(Boolean)
                  .join("\n");
                return (
                  <li key={p.id} className="health-program-card surface-glass">
                    <div className="health-program-card-head">
                      <strong>{p.name}</strong>
                      <span className="settings-hint">
                        {(p.exercises || []).length} moves{builtIn ? " · sample" : ""}
                      </span>
                    </div>
                    <ul className="health-program-card-preview">
                      {(p.exercises || []).slice(0, 5).map((ex, i) => (
                        <li key={i}>{formatExerciseBlockLine(ex)}</li>
                      ))}
                      {(p.exercises || []).length > 5 ? <li className="settings-hint">+{(p.exercises || []).length - 5} more</li> : null}
                    </ul>
                    <div className="health-program-card-actions">
                      {builtIn ? (
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => saveLibraryCopy(p)}>
                          Save copy to edit
                        </button>
                      ) : (
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => startEditProgram(p.id)}>
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={!onScheduleWorkoutTask}
                        onClick={() => onScheduleWorkoutTask(`Workout · ${p.name}`, taskBody)}
                      >
                        Add to Today as task
                      </button>
                      <button type="button" className="btn btn-sm" disabled={!onPracticeProgram} onClick={() => onPracticeProgram?.(normalizeProgramRecord(p) || p)}>
                        Practice here
                      </button>
                      {builtIn ? null : (
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => deleteProgram(p.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="health-coach-paste surface-glass" style={{ marginTop: 20 }}>
            <div className="panel-title" style={{ marginBottom: 8 }}>
              <span className="title">From Coach (paste)</span>
            </div>
            <p className="settings-hint">If Coach writes a program you like, paste one exercise per line and save it here.</p>
            <label className="quick-row">
              <span className="label">Name</span>
              <input className="input" value={pasteName} onChange={(e) => setPasteName(e.target.value)} placeholder="Coach program - Jan" />
            </label>
            <textarea className="input health-paste-area" rows={5} value={pasteBody} onChange={(e) => setPasteBody(e.target.value)} placeholder={"Ball slams 3×10\nLeg raises…"} />
            <button type="button" className="btn-primary" style={{ marginTop: 10 }} disabled={!pasteName.trim() || !pasteBody.trim()} onClick={savePasteProgram}>
              Save pasted program
            </button>
          </div>

          {!profileOk ? (
            <p className="settings-hint" style={{ marginTop: 16 }}>
              Add age, height, and weight in <strong>Macros</strong> to unlock the <strong>Workout</strong> task type in Today&apos;s quick add (Details).
            </p>
          ) : (
            <p className="settings-hint" style={{ marginTop: 16 }}>
              Add a task with <strong>gym</strong>, <strong>workout</strong>, or <strong>exercise</strong> in the text (or pick Workout in Details) to choose how programs attach.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="health-macro-block surface-glass">
            <div className="panel-title" style={{ marginBottom: 8 }}>
              <span className="title">Macro tracker</span>
            </div>
            <p className="settings-hint">
              Pick a day; totals reset each calendar day. Log one meal at a time; everything adds up for the progress bars.
            </p>
            <label className="quick-row">
              <span className="label">Day</span>
              <input className="input" type="date" value={macroDate} onChange={(e) => setMacroDate(e.target.value)} />
            </label>
            {targets?.calories ? (
              <div className="health-macro-bars" style={{ marginTop: 14 }}>
                {["calories", "protein", "carbs", "fat"].map((k) => {
                  const tgt =
                    k === "calories" ? targets.calories : targets[`${k === "protein" ? "protein" : k === "carbs" ? "carbs" : "fat"}G`];
                  const cur = macroTotals[k];
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
            ) : (
              <p className="settings-hint" style={{ marginTop: 10 }}>
                Set targets with the calculator below, then your bars will show progress for this day.
              </p>
            )}
            <div className="health-meal-log-section">
              <p className="settings-hint" style={{ marginTop: 12, marginBottom: 8 }}>
                <strong>Add a meal</strong> (protein, carbs, fat, calories; use any fields you have)
              </p>
              <label className="quick-row">
                <span className="label">Meal name (optional)</span>
                <input
                  className="input"
                  value={mealLabel}
                  onChange={(e) => setMealLabel(e.target.value)}
                  placeholder="Breakfast, snack…"
                />
              </label>
              <label className="quick-row">
                <span className="label">What you ate (optional)</span>
                <input
                  className="input"
                  value={mealFood}
                  onChange={(e) => setMealFood(e.target.value)}
                  placeholder="e.g. protein bowl, scrambled eggs"
                />
              </label>
              <label className="health-meal-prep-toggle quick-row">
                <span className="label">Meal prep mode</span>
                <span className="health-meal-prep-toggle-inner">
                  <input type="checkbox" checked={mealPrepMode} onChange={(e) => setMealPrepMode(e.target.checked)} />
                  <span className="settings-hint">Log this meal on every day you select (same macros). Handy when you batch-cook; other days you only log snacks or missed meals.</span>
                </span>
              </label>
              {mealPrepMode ? (
                <div className="health-meal-prep-days" role="group" aria-label="Days to log this meal">
                  <span className="settings-hint" style={{ display: "block", marginBottom: 6 }}>
                    Week of selected day (tap days):
                  </span>
                  <div className="health-meal-prep-chips">
                    {macroWeekDays.map(({ label, dayKey }) => (
                      <button
                        key={dayKey}
                        type="button"
                        className={`btn btn-sm health-meal-prep-chip ${mealPrepDayKeys.includes(dayKey) ? "btn-primary" : ""}`}
                        onClick={() => toggleMealPrepDay(dayKey)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="health-calc-grid" style={{ marginTop: 8 }}>
                {["protein", "carbs", "fat", "calories"].map((field) => (
                  <label key={field} className="quick-row">
                    <span className="label">{field === "calories" ? "Calories" : `${field} (g)`}</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={field === "protein" ? mealProtein : field === "carbs" ? mealCarbs : field === "fat" ? mealFat : mealCalories}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (field === "protein") setMealProtein(v);
                        else if (field === "carbs") setMealCarbs(v);
                        else if (field === "fat") setMealFat(v);
                        else setMealCalories(v);
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="health-meal-save-row">
                <button type="button" className="btn btn-primary" onClick={saveMealEntry}>
                  Save meal
                </button>
                <span className="settings-hint">Clears the form so you can log the next meal right away.</span>
              </div>
            </div>
            {macroDay.meals?.length ? (
              <ul className="health-meal-list">
                {macroDay.meals.map((m) => (
                  <li key={m.id} className="health-meal-list-item surface-glass">
                    <div>
                      <strong>{m.label || "Meal"}</strong>
                      {m.food ? (
                        <div className="settings-hint" style={{ marginTop: 4 }}>
                          {m.food}
                        </div>
                      ) : null}
                      <div className="settings-hint" style={{ marginTop: 4 }}>
                        P {m.protein}g · C {m.carbs}g · F {m.fat}g · {m.calories} kcal
                      </div>
                    </div>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => deleteMealEntry(m.id)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="settings-hint" style={{ marginTop: 10 }}>
                No meals logged for this day yet.
              </p>
            )}
          </div>

          <div className={`health-macro-block surface-glass health-macro-calc-card ${macroCalcExpanded ? "health-macro-calc-card--open" : ""}`}>
            <div className="health-macro-calc-header">
              <button
                type="button"
                className={`health-macro-calc-toggle ${macroCalcExpanded ? "health-macro-calc-toggle--open" : ""}`}
                onClick={() => setMacroCalcExpanded((v) => !v)}
                aria-expanded={macroCalcExpanded}
                aria-controls="health-macro-calc-body"
              >
                <MacroCalculatorIcon style={{ width: 26, height: 26 }} />
                <span className="health-macro-calc-toggle-text">
                  {macroTargetsApplied ? "Macro & calorie calculator" : "Set up your macro calculator"}
                </span>
                <span className="health-macro-calc-chev" aria-hidden>
                  {macroCalcExpanded ? "▾" : "▸"}
                </span>
              </button>
              {macroTargetsApplied && !macroCalcExpanded ? (
                <p className="settings-hint health-macro-calc-compact-meta">
                  Targets: {targets.calories} kcal · P{targets.proteinG} C{targets.carbsG} F{targets.fatG}
                </p>
              ) : null}
            </div>
            <div id="health-macro-calc-body" className={macroCalcExpanded ? "health-macro-calc-body" : "health-macro-calc-body health-macro-calc-body--hidden"}>
              <p className="settings-hint" style={{ marginTop: 4 }}>
                Mifflin–St Jeor × activity, adjusted for your goal. Apply to set daily targets for the tracker above.
              </p>
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
                <div className="quick-row health-imperial-height-block">
                  <span className="label">Height</span>
                  <div className="health-imperial-row">
                    <label className="health-imperial-field">
                      <span className="settings-hint">Feet</span>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        max={8}
                        inputMode="numeric"
                        value={heightFtStr}
                        onChange={(e) => setHeightFtStr(e.target.value)}
                        onBlur={commitHeightProfile}
                        aria-label="Height feet"
                      />
                    </label>
                    <label className="health-imperial-field">
                      <span className="settings-hint">Inches</span>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        max={11}
                        inputMode="numeric"
                        value={heightInStr}
                        onChange={(e) => setHeightInStr(e.target.value)}
                        onBlur={commitHeightProfile}
                        aria-label="Height inches"
                      />
                    </label>
                  </div>
                  {h.profile.heightCm ? (
                    <span className="settings-hint" style={{ marginTop: 6, display: "block" }}>
                      Stored as ~{h.profile.heightCm} cm for calculations.
                    </span>
                  ) : null}
                </div>
                <label className="quick-row">
                  <span className="label">Weight (lb)</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    inputMode="decimal"
                    value={weightLbStr}
                    onChange={(e) => setWeightLbStr(e.target.value)}
                    onBlur={commitWeightLbProfile}
                    placeholder="e.g. 165"
                  />
                  {h.profile.weightKg ? (
                    <span className="settings-hint" style={{ marginTop: 6, display: "block" }}>
                      ~{Math.round(h.profile.weightKg * 10) / 10} kg internally.
                    </span>
                  ) : null}
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
                  <select className="input" value={String(h.profile.activity)} onChange={(e) => patchProfile({ activity: Number(e.target.value) })}>
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
                  Targets: <strong>{targets.calories}</strong> kcal · P <strong>{targets.proteinG}</strong>g · C <strong>{targets.carbsG}</strong>g · F{" "}
                  <strong>{targets.fatG}</strong>g
                </p>
              ) : (
                <p className="settings-hint" style={{ marginTop: 12 }}>
                  Fill age, height, weight, then apply.
                </p>
              )}
            </div>
          </div>

          <div className="health-macro-block surface-glass">
            <div className="panel-title" style={{ marginBottom: 8 }}>
              <span className="title">Weight &amp; goal</span>
            </div>
            <label className="quick-row">
              <span className="label">Goal weight (lb)</span>
              <input
                className="input"
                type="number"
                min={1}
                inputMode="decimal"
                value={goalLbStr}
                onChange={(e) => setGoalLbStr(e.target.value)}
                onBlur={commitGoalLbProfile}
                placeholder="e.g. 150"
              />
              {h.profile.goalWeightKg ? (
                <span className="settings-hint" style={{ marginTop: 6, display: "block" }}>
                  ~{Math.round(h.profile.goalWeightKg * 10) / 10} kg internally.
                </span>
              ) : null}
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
                placeholder="Log weight (lb)"
                value={logWeightLbStr}
                onChange={(e) => setLogWeightLbStr(e.target.value)}
                aria-label="Weight in pounds"
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
                  Progress toward goal {formatWeightLbFromKg(goalW)} lb (latest log: {formatWeightLbFromKg(lastWeight)} lb).
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
                      {e.at.slice(0, 10)} - {formatWeightLbFromKg(e.kg)} lb (~{Math.round(e.kg * 10) / 10} kg)
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="health-page-bottom-bar surface-glass">
        <button type="button" className="btn btn-primary health-overview-btn" onClick={() => setMacroOverviewOpen(true)}>
          Macro overview
        </button>
        <span className="settings-hint health-overview-hint">Daily meal totals across past weeks</span>
      </div>

      {macroOverviewOpen ? (
        <div
          className="modal-overlay health-workout-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="macro-ov-title"
          onClick={() => setMacroOverviewOpen(false)}
        >
          <div className="modal health-overview-modal surface-glass" onClick={(e) => e.stopPropagation()}>
            <div className="health-workout-sheet-head">
              <h3 id="macro-ov-title" className="health-workout-sheet-title">
                Macro overview
              </h3>
              <button type="button" className="btn-icon" aria-label="Close" onClick={() => setMacroOverviewOpen(false)}>
                <CloseIcon style={{ width: 22, height: 22 }} />
              </button>
            </div>
            <p className="settings-hint">Each row is the sum of all meals saved that day. Change day in Macros to log or edit a specific date.</p>
            {macroOverviewRows.length === 0 ? (
              <p className="settings-hint" style={{ marginTop: 12 }}>
                No logged days yet. Open <strong>Macros</strong> and use <strong>Save meal</strong> to start.
              </p>
            ) : (
              <div className="health-overview-table-wrap">
                <table className="health-overview-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Cal</th>
                      <th>P (g)</th>
                      <th>C (g)</th>
                      <th>F (g)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {macroOverviewRows.map((r) => (
                      <tr key={r.dayKey}>
                        <td>{r.dayKey}</td>
                        <td>{r.calories}</td>
                        <td>{r.protein}</td>
                        <td>{r.carbs}</td>
                        <td>{r.fat}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button type="button" className="btn" style={{ marginTop: 14 }} onClick={() => setMacroOverviewOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {guidedSession && guidedSession.exercises?.length ? (
        <GuidedWorkoutOverlay
          session={guidedSession}
          health={health}
          setHealth={setHealth}
          onClose={() => onClearGuidedSession?.()}
          onMarkTaskDone={onMarkGuidedTaskDone}
        />
      ) : null}
    </section>
  );
}

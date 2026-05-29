import React, { useEffect, useMemo, useRef, useState } from "react";
import { CloseIcon, MacroCalculatorIcon } from "./Icons";
import {
  PROGRAM_LIBRARY,
  addDaysToDayKey,
  cmToFeetInches,
  collectShoppingLinesFromMacroDay,
  collectShoppingLinesFromMealPlan,
  computeMacroTargetsFromProfile,
  computeWorkoutConsistency,
  computeWorkoutOverviewStats,
  feetInchesToCm,
  formatExerciseBlockLine,
  formatWeightLbFromKg,
  getWorkoutLineProgress,
  guidedSessionProgressKey,
  lbToKg,
  listSelectablePrograms,
  listDisplayPrograms,
  normalizeProgramDisplayOrder,
  mondayKeyForDayKey,
  normalizeExerciseBlock,
  normalizeHealth,
  normalizeProgramRecord,
  filterMacroGenericPresets,
  findMacroSuggestionForInput,
  normalizeMacroDayEntry,
  suggestMealPlansForTargets,
  sumMacroDayTotals,
  weeklyMenuDayLabels,
  dayOfWeekIndexForDayKey,
  getWeeklyMenuFollowStatus,
  appendWeeklyMenuMealToMacroLog,
  markWeeklyMenuMealSkipped,
  normalizeWeeklyMenu,
  appendMealPlanToWeeklyMenu,
} from "./health/healthModel";
import {
  buildGroceryListItems,
  DEFAULT_GROCERY_KEYWORDS,
  normalizeGroceryKeywordsFromProfile,
  normalizeSavedGroceryLists,
} from "./groceryTaskCoachHelpers";
import { dockNavAssetUrl, resolveDockNavImage } from "./dockNavAssets";
import { useIconStyle } from "./IconStyleContext";
import { NutritionLabelScanner } from "./components/NutritionLabelScanner";
import { AddWorkoutWeekModal } from "./components/AddWorkoutWeekModal.jsx";
import { launchNutritionLabelScan } from "./nutritionLabelScanner";

function newId(prefix) {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  } catch {}
  return `${prefix}-${Date.now()}`;
}

const MEAL_TYPE_OPTIONS = ["Breakfast", "Lunch", "Dinner", "Snack", "Other"];
const MEAL_SERVING_OPTIONS = [0.5, 1, 1.5, 2, 3];

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
                <li
                  key={key}
                  className={`health-exercise-row surface-glass ${row.done ? "health-exercise-row--done" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={row.done}
                  aria-label={`${b.name || "Exercise"}${row.done ? ", done" : ", not done"}`}
                  onClick={(e) => {
                    if (e.target.closest(".health-exercise-check")) return;
                    patchRowAt(i, { done: !row.done });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      patchRowAt(i, { done: !row.done });
                    }
                  }}
                >
                  <label className="health-exercise-check" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={row.done} onChange={(e) => patchRowAt(i, { done: e.target.checked })} />
                    <span className="health-exercise-check-ui" />
                  </label>
                  <div className="health-exercise-text-block">
                    <div className="health-exercise-text">{b.name || "Exercise"}</div>
                    {(b.setsReps || b.weightNote) && (
                      <div className="health-subline">
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
  setProfile,
  realTodayKey,
  appState,
  onOpenHealthCalendar,
  onScheduleWorkoutTask,
  onPracticeProgram,
  guidedSession = null,
  onClearGuidedSession,
  onMarkGuidedTaskDone,
  /** Increment from parent to scroll the program builder into view (e.g. after adding a gym task). */
  scrollToProgramBuilderSignal = 0,
  focusWeeklyMenuSignal = 0,
  onAskCoachMealPlan = null,
}) {
  const h = useMemo(() => normalizeHealth(health), [health]);
  const [macroDate, setMacroDate] = useState(() => realTodayKey);
  const [heightFtStr, setHeightFtStr] = useState("");
  const [heightInStr, setHeightInStr] = useState("");
  const [weightLbStr, setWeightLbStr] = useState("");
  const [goalLbStr, setGoalLbStr] = useState("");
  const [logWeightLbStr, setLogWeightLbStr] = useState("");
  const [healthTab, setHealthTab] = useState("workouts");
  const { iconStyle } = useIconStyle();
  const healthHeadIconSrc = useMemo(
    () => dockNavAssetUrl(resolveDockNavImage("health", { iconStyle })),
    [iconStyle]
  );

  const [draftName, setDraftName] = useState("");
  const [draftExercises, setDraftExercises] = useState([]);
  const [draftExName, setDraftExName] = useState("");
  const [draftExSets, setDraftExSets] = useState("");
  const [draftExWeight, setDraftExWeight] = useState("");
  const [editingProgramId, setEditingProgramId] = useState(null);
  const [routineAddId, setRoutineAddId] = useState("");
  const [bundleProgramName, setBundleProgramName] = useState("");
  const [addWeekProgram, setAddWeekProgram] = useState(null);
  const [buildProgramOpen, setBuildProgramOpen] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [programPickerOpen, setProgramPickerOpen] = useState(false);
  const [programsGalleryOpen, setProgramsGalleryOpen] = useState(false);
  const [programPickerSearch, setProgramPickerSearch] = useState("");
  const programPickerRef = useRef(null);
  const [mealType, setMealType] = useState("");
  const [mealFood, setMealFood] = useState("");
  const [mealFoodPickerOpen, setMealFoodPickerOpen] = useState(false);
  const [selectedFoodMatchId, setSelectedFoodMatchId] = useState(null);
  const [macroManualEntry, setMacroManualEntry] = useState(false);
  const mealFoodPickerRef = useRef(null);
  const mealLogSectionRef = useRef(null);
  const selectedFoodMatchIdRef = useRef(null);
  const [mealServings, setMealServings] = useState(1);
  const [mealMacroBase, setMealMacroBase] = useState(null);
  useEffect(() => {
    selectedFoodMatchIdRef.current = selectedFoodMatchId;
  }, [selectedFoodMatchId]);
  const [mealPrepMode, setMealPrepMode] = useState(false);
  const [mealPrepDayKeys, setMealPrepDayKeys] = useState(() => []);
  const [mealProtein, setMealProtein] = useState("");
  const [mealCarbs, setMealCarbs] = useState("");
  const [mealFat, setMealFat] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const [macroOverviewOpen, setMacroOverviewOpen] = useState(false);
  const [workoutOverviewOpen, setWorkoutOverviewOpen] = useState(false);
  const [labelScannerOpen, setLabelScannerOpen] = useState(false);
  const [labelScannerInitialOcr, setLabelScannerInitialOcr] = useState(null);
  const [labelScanBusy, setLabelScanBusy] = useState(false);
  const [groceryListTitle, setGroceryListTitle] = useState("");
  const [groceryDraftItems, setGroceryDraftItems] = useState([]);
  const [groceryItemInput, setGroceryItemInput] = useState("");
  const [groceryPlanPickId, setGroceryPlanPickId] = useState("");
  const [weeklyMenuEditDay, setWeeklyMenuEditDay] = useState(() => new Date().getDay());
  const [weeklyMenuSlot, setWeeklyMenuSlot] = useState("Breakfast");
  const [weeklyMenuFood, setWeeklyMenuFood] = useState("");
  const [weeklyMenuProtein, setWeeklyMenuProtein] = useState("");
  const [weeklyMenuCarbs, setWeeklyMenuCarbs] = useState("");
  const [weeklyMenuFat, setWeeklyMenuFat] = useState("");
  const [weeklyMenuCalories, setWeeklyMenuCalories] = useState("");
  const [weeklyMenuLogServings, setWeeklyMenuLogServings] = useState({});
  const [weeklyMenuPlanAddedKey, setWeeklyMenuPlanAddedKey] = useState(null);
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
    setMealType("");
    setMealFood("");
    setSelectedFoodMatchId(null);
    setMacroManualEntry(false);
    setMealFoodPickerOpen(false);
    setMealProtein("");
    setMealCarbs("");
    setMealFat("");
    setMealCalories("");
    setMealServings(1);
    setMealMacroBase(null);
    setMealPrepDayKeys([macroDate]);
  }, [macroDate]);

  useEffect(() => {
    if (guidedSession?.exercises?.length) setHealthTab("workouts");
  }, [guidedSession?.taskId, guidedSession?.programId, guidedSession?.exercises?.length]);

  const handledProgramBuilderScroll = useRef(0);
  useEffect(() => {
    if (!scrollToProgramBuilderSignal) return;
    setHealthTab("workouts");
    setBuildProgramOpen(true);
  }, [scrollToProgramBuilderSignal]);

  useEffect(() => {
    if (healthTab !== "workouts") return;
    const sig = scrollToProgramBuilderSignal;
    if (!sig || sig <= handledProgramBuilderScroll.current) return;
    handledProgramBuilderScroll.current = sig;
    const id = requestAnimationFrame(() => {
      document.getElementById("health-build-program")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [healthTab, scrollToProgramBuilderSignal]);

  const handledWeeklyMenuFocus = useRef(0);
  useEffect(() => {
    if (!focusWeeklyMenuSignal) return;
    if (focusWeeklyMenuSignal <= handledWeeklyMenuFocus.current) return;
    handledWeeklyMenuFocus.current = focusWeeklyMenuSignal;
    setHealthTab("macros");
    const id = requestAnimationFrame(() => {
      document.querySelector(".health-weekly-menu-block")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [focusWeeklyMenuSignal]);

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

  const workoutOverview = useMemo(
    () => computeWorkoutOverviewStats(appState, realTodayKey, h, 12),
    [appState, realTodayKey, h]
  );

  const selectable = useMemo(() => listSelectablePrograms(h), [h]);

  const displayPrograms = useMemo(() => listDisplayPrograms(h), [h]);

  const programPickerOptions = useMemo(() => {
    const q = programPickerSearch.trim().toLowerCase();
    if (!q) return displayPrograms;
    return displayPrograms.filter((p) => {
      if (String(p.name || "").toLowerCase().includes(q)) return true;
      return (p.exercises || []).some((ex) => String(ex.name || "").toLowerCase().includes(q));
    });
  }, [displayPrograms, programPickerSearch]);

  const selectedProgram = useMemo(
    () => displayPrograms.find((p) => p.id === selectedProgramId) || null,
    [displayPrograms, selectedProgramId]
  );

  useEffect(() => {
    if (!programPickerOpen) return;
    function onDocClick(e) {
      if (programPickerRef.current && !programPickerRef.current.contains(e.target)) {
        setProgramPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [programPickerOpen]);

  useEffect(() => {
    if (!displayPrograms.length) {
      setSelectedProgramId("");
      return;
    }
    if (!displayPrograms.some((p) => p.id === selectedProgramId)) {
      setSelectedProgramId(displayPrograms[0].id);
    }
  }, [displayPrograms, selectedProgramId]);

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
        const programs = [...(base.programs || []), rec];
        const order = normalizeProgramDisplayOrder(
          [...(base.programDisplayOrder || []), rec.id],
          listDisplayPrograms({ ...base, programs }).map((p) => p.id)
        );
        return { ...base, programs, programDisplayOrder: order };
      });
    }
    clearBuilder();
  }

  function deleteProgram(id) {
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      const programs = (base.programs || []).filter((p) => p.id !== id);
      const weekRoutineProgramIds = (base.weekRoutineProgramIds || []).filter((x) => x !== id);
      const programDisplayOrder = (base.programDisplayOrder || []).filter((x) => x !== id);
      return { ...base, programs, weekRoutineProgramIds, programDisplayOrder };
    });
    if (editingProgramId === id) clearBuilder();
  }

  function saveLibraryCopy(lib) {
    const src = normalizeProgramRecord(lib);
    if (!src) return;
    const id = newId("prog");
    const rec = normalizeProgramRecord({ id, name: src.name, exercises: [...src.exercises] });
    if (!rec) return;
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      const programs = [...(base.programs || []), rec];
      const order = normalizeProgramDisplayOrder(
        [...(base.programDisplayOrder || []), rec.id],
        listDisplayPrograms({ ...base, programs }).map((p) => p.id)
      );
      return { ...base, programs, programDisplayOrder: order };
    });
  }

  function selectProgram(p) {
    setSelectedProgramId(p.id);
    setProgramPickerSearch("");
    setProgramPickerOpen(false);
    setProgramsGalleryOpen(false);
  }

  function openProgramsGallery() {
    setProgramsGalleryOpen(true);
    setProgramPickerOpen(false);
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
    const name = bundleProgramName.trim();
    if (!name) return;
    const ids = [...(h.weekRoutineProgramIds || [])];
    if (!ids.length) return;
    setHealth((prev) => ({
      ...normalizeHealth(prev),
      weekRoutinePlanName: name,
      weekRoutineProgramIds: ids,
    }));
    setBundleProgramName("");
  }

  function scheduleFullWeekInOrder(hourKey = "18:00") {
    const ids = [...(h.weekRoutineProgramIds || [])];
    if (!ids.length || typeof onScheduleWorkoutTask !== "function") return;
    ids.forEach((pid, i) => {
      const p = selectable.find((x) => x.id === pid);
      if (!p) return;
      const taskBody = (p.exercises || [])
        .map((ex) => formatExerciseBlockLine(ex))
        .filter(Boolean)
        .join("\n");
      onScheduleWorkoutTask({
        title: `Workout · ${p.name}`,
        details: taskBody,
        dayKey: addDaysToDayKey(realTodayKey, i),
        hourKey,
        workoutProgramId: p.id,
        workoutProgramMode: "specific",
      });
    });
  }

  function confirmAddWeekProgram(payload) {
    const p = addWeekProgram;
    if (!p || typeof onScheduleWorkoutTask !== "function") return;
    const taskBody = (p.exercises || [])
      .map((ex) => formatExerciseBlockLine(ex))
      .filter(Boolean)
      .join("\n");
    onScheduleWorkoutTask({
      title: `Workout · ${p.name}`,
      details: taskBody,
      dayKey: payload.dayKey || realTodayKey,
      hourKey: payload.hourKey || "18:00",
      workoutProgramId: p.id,
      workoutProgramMode: "specific",
    });
    setAddWeekProgram(null);
  }

  const targets = h.macroTargets;
  const macroDay = normalizeMacroDayEntry(h.macroLog[macroDate], macroDate);
  const macroTotals = sumMacroDayTotals(macroDay);
  const macroMealPlanSuggestions = useMemo(() => {
    if (!targets?.calories) return [];
    const plans = suggestMealPlansForTargets(targets);
    if (h.profile.dietaryStyle === "vegan") return plans.filter((p) => p.id === "plant_forward");
    return plans;
  }, [targets, h.profile.dietaryStyle]);
  const groceryKeywordsLabel = useMemo(
    () => normalizeGroceryKeywordsFromProfile(profile).join(", "),
    [profile]
  );
  const grocerySavedLists = useMemo(
    () => normalizeSavedGroceryLists(profile?.grocerySavedLists),
    [profile?.grocerySavedLists]
  );
  const todayMealShoppingLines = useMemo(
    () => collectShoppingLinesFromMacroDay(macroDay),
    [macroDay]
  );
  const pickedMealPlan = useMemo(
    () => macroMealPlanSuggestions.find((p) => p.id === groceryPlanPickId) || null,
    [macroMealPlanSuggestions, groceryPlanPickId]
  );

  const foodAutocompleteItems = useMemo(() => {
    const q = mealFood.trim();
    if (q.length < 1) return [];
    const items = [];
    const suggest = findMacroSuggestionForInput(h.macroLog, q);
    if (suggest) {
      items.push({
        id: `suggest-${suggest.displayLabel}`,
        kind: "suggest",
        label: suggest.displayLabel,
        sublabel:
          suggest.source === "history"
            ? suggest.matchKind === "exact"
              ? "From your log"
              : "Similar to your log"
            : "Typical serving",
        macros: suggest,
      });
    }
    for (const p of filterMacroGenericPresets(q, 16)) {
      if (items.some((x) => x.label === p.label)) continue;
      items.push({
        id: `preset-${p.label}`,
        kind: "preset",
        label: p.label,
        sublabel: "Quick fill",
        macros: p,
      });
    }
    return items;
  }, [h.macroLog, mealFood]);

  const hasFoodAutocomplete = foodAutocompleteItems.length > 0;
  const showMacroFields =
    selectedFoodMatchId != null ||
    macroManualEntry ||
    (mealFood.trim().length >= 2 && !hasFoodAutocomplete);

  useEffect(() => {
    if (!mealFoodPickerOpen) return;
    function onDocClick(e) {
      if (mealLogSectionRef.current && !mealLogSectionRef.current.contains(e.target)) {
        setMealFoodPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [mealFoodPickerOpen]);

  function applyMacroFill(s, servings = mealServings) {
    const mult = Math.max(0.25, Math.min(4, Number(servings) || 1));
    setMealProtein(String(Math.round((Number(s.protein) || 0) * mult)));
    setMealCarbs(String(Math.round((Number(s.carbs) || 0) * mult)));
    setMealFat(String(Math.round((Number(s.fat) || 0) * mult)));
    setMealCalories(String(Math.round((Number(s.calories) || 0) * mult)));
  }

  function selectFoodAutocompleteItem(item) {
    if (!item?.macros) return;
    setMealMacroBase({ ...item.macros });
    applyMacroFill(item.macros, mealServings);
    setMealFood(item.label);
    setSelectedFoodMatchId(item.id);
    setMacroManualEntry(false);
    if (foodAutocompleteItems.length > 0) setMealFoodPickerOpen(true);
  }

  function onMealFoodChange(next) {
    setMealFood(next);
    setSelectedFoodMatchId(null);
    setMealMacroBase(null);
    setMacroManualEntry(false);
    setMealProtein("");
    setMealCarbs("");
    setMealFat("");
    setMealCalories("");
    if (next.trim().length > 0) setMealFoodPickerOpen(true);
    else setMealFoodPickerOpen(false);
  }

  function onMealFoodBlur() {
    window.setTimeout(() => {
      if (selectedFoodMatchIdRef.current) return;
      const q = mealFood.trim();
      if (q.length < 2) return;
      const suggest = findMacroSuggestionForInput(h.macroLog, q);
      const presets = filterMacroGenericPresets(q, 1);
      if (suggest || presets.length > 0) setMacroManualEntry(true);
    }, 180);
  }

  function onMealServingsChange(next) {
    const n = Number(next);
    if (!MEAL_SERVING_OPTIONS.includes(n)) return;
    setMealServings(n);
    if (mealMacroBase) applyMacroFill(mealMacroBase, n);
  }

  async function handleScanNutritionLabelClick() {
    setLabelScanBusy(true);
    try {
      const ocr = await launchNutritionLabelScan();
      setLabelScannerInitialOcr(ocr);
      setLabelScannerOpen(true);
    } catch (e) {
      if (e?.code === "CANCELLED") return;
      setLabelScannerInitialOcr({ error: e?.message || "Scan failed. Try again with even lighting." });
      setLabelScannerOpen(true);
    } finally {
      setLabelScanBusy(false);
    }
  }

  function closeLabelScanner() {
    setLabelScannerOpen(false);
    setLabelScannerInitialOcr(null);
  }

  function applyLabelScanToMeal({ food, protein, carbs, fat, calories }) {
    setMealFood(food || "Scanned label");
    setMealProtein(String(protein));
    setMealCarbs(String(carbs));
    setMealFat(String(fat));
    setMealCalories(String(calories));
    setMealMacroBase({
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      calories: Number(calories) || 0,
    });
    setMealServings(1);
    setSelectedFoodMatchId(null);
    setMacroManualEntry(true);
    setMealFoodPickerOpen(false);
  }

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
    const label = mealType || "Meal";
    const servings = Math.max(0.25, Math.min(4, Number(mealServings) || 1));
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
            servings: servings !== 1 ? servings : undefined,
            savedAt,
          },
        ];
        ml[dk] = { meals };
      }
      return { ...base, macroLog: ml };
    });
    setMealType("");
    setMealFood("");
    setSelectedFoodMatchId(null);
    setMealMacroBase(null);
    setMacroManualEntry(false);
    setMealFoodPickerOpen(false);
    setMealServings(1);
    setMealProtein("");
    setMealCarbs("");
    setMealFat("");
    setMealCalories("");
  }

  /** Add scaled plan meals to the macro day (does not clear existing meals). */
  function logSuggestedPlanToMacroDay(plan) {
    const savedAt = new Date().toISOString();
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      const cur = normalizeMacroDayEntry(base.macroLog[macroDate], macroDate);
      const additions = plan.meals.map((m) => ({
        id: newId("meal"),
        label: m.slot,
        food: m.lines.join(" · "),
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        calories: m.calories,
        savedAt,
      }));
      const meals = [...cur.meals, ...additions];
      return { ...base, macroLog: { ...base.macroLog, [macroDate]: { meals } } };
    });
  }

  function deleteMealEntry(mealId) {
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      const cur = normalizeMacroDayEntry(base.macroLog[macroDate], macroDate);
      const meals = cur.meals.filter((m) => m.id !== mealId);
      return { ...base, macroLog: { ...base.macroLog, [macroDate]: { meals } } };
    });
  }

  function saveGroceryListFromLines(titleRaw, lines, { clearDraft = false } = {}) {
    const title = String(titleRaw || "").trim() || "Shopping list";
    const items = buildGroceryListItems(lines, () => newId("gitem"));
    if (!items.length) return false;
    setProfile((p) => ({
      ...p,
      grocerySavedLists: normalizeSavedGroceryLists([
        {
          id: newId("glist"),
          title,
          savedAt: new Date().toISOString(),
          items,
        },
        ...(p.grocerySavedLists || []),
      ]),
    }));
    if (clearDraft) {
      setGroceryListTitle("");
      setGroceryDraftItems([]);
      setGroceryItemInput("");
    }
    return true;
  }

  function loadShoppingDraftFromLines(lines, titleHint = "") {
    const deduped = [...new Set(lines.map((l) => String(l).trim()).filter(Boolean))];
    if (!deduped.length) return;
    setGroceryDraftItems(deduped);
    if (titleHint && !groceryListTitle.trim()) setGroceryListTitle(titleHint);
  }

  function addGroceryDraftItem() {
    const t = groceryItemInput.trim();
    if (!t) return;
    setGroceryDraftItems((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]));
    setGroceryItemInput("");
  }

  function removeGroceryDraftItem(idx) {
    setGroceryDraftItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function addWeeklyMenuMeal() {
    const protein = Math.round(Number(weeklyMenuProtein) || 0);
    const carbs = Math.round(Number(weeklyMenuCarbs) || 0);
    const fat = Math.round(Number(weeklyMenuFat) || 0);
    const calories = Math.round(Number(weeklyMenuCalories) || 0);
    const food = weeklyMenuFood.trim();
    if (!food && protein + carbs + fat + calories <= 0) return;
    const meal = {
      id: newId("wmenu"),
      slot: weeklyMenuSlot || "Meal",
      food,
      protein,
      carbs,
      fat,
      calories,
    };
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      const wm = normalizeWeeklyMenu(base.weeklyMenu);
      const days = wm.days.map((d, i) => (i === weeklyMenuEditDay ? [...d, meal] : d));
      return { ...base, weeklyMenu: { ...wm, days, showOnHome: true } };
    });
    setWeeklyMenuFood("");
    setWeeklyMenuProtein("");
    setWeeklyMenuCarbs("");
    setWeeklyMenuFat("");
    setWeeklyMenuCalories("");
  }

  function removeWeeklyMenuMeal(dayIdx, mealId) {
    setHealth((prev) => {
      const base = normalizeHealth(prev);
      const wm = normalizeWeeklyMenu(base.weeklyMenu);
      const days = wm.days.map((d, i) => (i === dayIdx ? d.filter((m) => m.id !== mealId) : d));
      return { ...base, weeklyMenu: { ...wm, days } };
    });
  }

  function logWeeklyMenuMealFromTracker(meal, servings) {
    setHealth((prev) => appendWeeklyMenuMealToMacroLog(prev, macroDate, meal, servings));
  }

  function applyMealPlanToWeeklyMenu(plan) {
    if (!plan?.meals?.length) return;
    const dow = dayOfWeekIndexForDayKey(macroDate);
    setHealth((prev) => appendMealPlanToWeeklyMenu(prev, macroDate, plan));
    setWeeklyMenuEditDay(dow);
    const addedKey = `${plan.id}:${macroDate}`;
    setWeeklyMenuPlanAddedKey(addedKey);
    window.setTimeout(() => {
      setWeeklyMenuPlanAddedKey((cur) => (cur === addedKey ? null : cur));
    }, 4000);
  }

  function removeSavedGroceryList(id) {
    setProfile((p) => ({
      ...p,
      grocerySavedLists: (p.grocerySavedLists || []).filter((x) => x.id !== id),
    }));
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

  return (
    <section className="panel health-panel surface-glass scroll-reveal section-health">
      <div className="panel-top health-page-head">
        <div className="panel-title health-page-head-title">
          <img
            src={healthHeadIconSrc}
            alt=""
            className="health-page-head-icon"
            width={40}
            height={40}
          />
          <div>
            <div className="title">Health &amp; training</div>
          </div>
        </div>
      </div>

      <div className="health-segment-toggle health-tab-toggle" role="tablist" aria-label="Health section">
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
          <details
            id="health-build-program"
            className="health-build-program-details"
            open={buildProgramOpen}
            onToggle={(e) => setBuildProgramOpen(e.target.open)}
          >
            <summary className="health-build-program-summary">
              {editingProgramId ? "Edit program" : "Build a program"}
            </summary>
            <div className="health-build-program-panel">
              <label className="quick-row health-field-stack">
                <span className="label">Program name</span>
                <input
                  className="input health-input-constrained"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="e.g. Push day A"
                />
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
                        <div className="health-subline">
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
              {onOpenHealthCalendar ? (
                <div className="health-calendar-open-block" style={{ marginTop: 16 }}>
                  <button type="button" className="btn btn-sm" onClick={() => onOpenHealthCalendar(realTodayKey)}>
                    Open full calendar
                  </button>
                </div>
              ) : null}
            </div>
          </details>

          <div className="health-saved-routines health-program-picker-panel surface-glass" style={{ marginTop: 22 }}>
            <div className="panel-title health-program-picker-heading">
              <span className="title">My programs</span>
            </div>
            {displayPrograms.length === 0 ? (
              <p className="settings-hint">No programs yet. Build one above or save a sample.</p>
            ) : (
              <>
                <div className="health-program-picker" ref={programPickerRef}>
                  <button
                    type="button"
                    className={[
                      "health-program-picker-trigger",
                      programPickerOpen ? "health-program-picker-trigger--open" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-haspopup="listbox"
                    aria-expanded={programPickerOpen}
                    aria-controls="health-program-picker-menu"
                    onClick={() => setProgramPickerOpen((o) => !o)}
                  >
                    <span className="health-program-picker-trigger-label">
                      {selectedProgram ? selectedProgram.name : "Choose a program"}
                    </span>
                    <span className="health-program-picker-chevron" aria-hidden />
                  </button>
                  {programPickerOpen ? (
                    <div id="health-program-picker-menu" className="health-program-picker-menu" role="listbox" aria-label="My programs">
                      <input
                        className="input health-program-picker-search"
                        type="search"
                        value={programPickerSearch}
                        onChange={(e) => setProgramPickerSearch(e.target.value)}
                        placeholder="Search by name or exercise"
                        autoComplete="off"
                        aria-label="Search programs"
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                      {programPickerOptions.length > 0 ? (
                        <ul className="health-program-picker-options">
                          {programPickerOptions.map((p) => {
                            const moveCount = (p.exercises || []).length;
                            const builtIn = PROGRAM_LIBRARY.some((lib) => lib.id === p.id);
                            const active = p.id === selectedProgramId;
                            return (
                              <li key={p.id}>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={active}
                                  className={[
                                    "health-program-picker-option",
                                    active ? "health-program-picker-option--active" : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selectProgram(p)}
                                >
                                  <span className="health-program-picker-option-name">{p.name}</span>
                                  <span className="health-program-picker-option-meta">
                                    {moveCount} {moveCount === 1 ? "move" : "moves"}
                                    {builtIn ? " · Sample" : ""}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="health-program-picker-empty">No programs match that search.</p>
                      )}
                    </div>
                  ) : null}
                </div>

                {selectedProgram ? (() => {
                  const p = selectedProgram;
                  const builtIn = PROGRAM_LIBRARY.some((lib) => lib.id === p.id);
                  const inWeekRoutine = (h.weekRoutineProgramIds || []).includes(p.id);
                  const moves = (p.exercises || []).map((ex) => normalizeExerciseBlock(ex)).filter(Boolean);
                  const previewMoves = moves.slice(0, 5);
                  const taskBody = moves.map((ex) => formatExerciseBlockLine(ex)).filter(Boolean).join("\n");
                  return (
                    <article className="health-program-detail surface-glass">
                      <div className="health-program-card-head">
                        <div className="health-program-card-title-wrap">
                          <h4 className="health-program-card-title">{p.name}</h4>
                          <div className="health-program-card-badges">
                            <span className="health-program-badge">
                              {moves.length} {moves.length === 1 ? "move" : "moves"}
                            </span>
                            {builtIn ? <span className="health-program-badge health-program-badge--sample">Sample</span> : null}
                          </div>
                        </div>
                      </div>
                      {previewMoves.length > 0 ? (
                        <ol className="health-program-card-moves">
                          {previewMoves.map((ex, i) => (
                            <li key={`${i}-${ex.name}`} className="health-program-move-row">
                              <span className="health-program-move-num" aria-hidden>
                                {i + 1}
                              </span>
                              <div className="health-program-move-body">
                                <span className="health-program-move-name">{ex.name || "Exercise"}</span>
                                {(ex.setsReps || ex.weightNote) && (
                                  <span className="health-program-move-meta">
                                    {[ex.setsReps, ex.weightNote].filter(Boolean).join(" · ")}
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                          {moves.length > previewMoves.length ? (
                            <li className="health-program-move-more">+{moves.length - previewMoves.length} more in this program</li>
                          ) : null}
                        </ol>
                      ) : (
                        <p className="settings-hint health-program-card-empty">No exercises yet. Edit to add moves.</p>
                      )}
                      <div className="health-program-card-actions">
                        <div className="health-program-card-actions-primary">
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={!onPracticeProgram}
                            onClick={() => onPracticeProgram?.(normalizeProgramRecord(p) || p)}
                          >
                            Practice here
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={!onScheduleWorkoutTask}
                            onClick={() => {
                              if (inWeekRoutine) {
                                setAddWeekProgram(p);
                                return;
                              }
                              onScheduleWorkoutTask({
                                title: `Workout · ${p.name}`,
                                details: taskBody,
                                dayKey: realTodayKey,
                                hourKey: "18:00",
                                workoutProgramId: p.id,
                                workoutProgramMode: "specific",
                              });
                            }}
                          >
                            {inWeekRoutine ? "Add to this week" : "Add to Today"}
                          </button>
                        </div>
                        <div className="health-program-card-actions-secondary">
                          {displayPrograms.length > 1 ? (
                            <button type="button" className="btn btn-sm btn-ghost" onClick={openProgramsGallery}>
                              See all
                            </button>
                          ) : null}
                          {builtIn ? (
                            <button type="button" className="btn btn-sm" onClick={() => saveLibraryCopy(p)}>
                              Save
                            </button>
                          ) : (
                            <>
                              <button type="button" className="btn btn-sm" onClick={() => startEditProgram(p.id)}>
                                Edit
                              </button>
                              <button type="button" className="btn btn-sm btn-ghost" onClick={() => deleteProgram(p.id)}>
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })() : null}

                {programsGalleryOpen ? (
                  <div className="health-programs-gallery" role="region" aria-label="All programs">
                    <div className="health-programs-gallery-head">
                      <span className="health-programs-gallery-title">All programs</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => setProgramsGalleryOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                    <ul className="health-programs-gallery-grid">
                      {displayPrograms.map((prog) => {
                        const moveCount = (prog.exercises || []).length;
                        const builtInTile = PROGRAM_LIBRARY.some((lib) => lib.id === prog.id);
                        const active = prog.id === selectedProgramId;
                        return (
                          <li key={prog.id}>
                            <button
                              type="button"
                              className={[
                                "health-program-tile",
                                active ? "health-program-tile--active" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              onClick={() => selectProgram(prog)}
                            >
                              <span className="health-program-tile-name">{prog.name}</span>
                              <span className="health-program-tile-meta">
                                {moveCount} {moveCount === 1 ? "move" : "moves"}
                                {builtInTile ? " · Sample" : ""}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="panel-title health-week-program-title" style={{ marginTop: 22 }}>
            <span className="title">Weekly routine order</span>
          </div>
          <p className="settings-hint health-week-routine-hint" style={{ marginBottom: 10 }}>
            Stack programs below in the order you want. <strong>Next in weekly routine</strong> uses this order when you add a gym task.{" "}
            <strong>Auto-pick</strong> chooses a random program from My programs. <strong>Begin workout</strong> on a task opens the linked program.
          </p>
          {h.weekRoutinePlanName && (h.weekRoutineProgramIds || []).length > 0 ? (
            <div className="health-week-plan-saved surface-glass">
              <p className="health-week-plan-saved-title">{h.weekRoutinePlanName}</p>
              <ul className="health-week-plan-saved-programs">
                {(h.weekRoutineProgramIds || []).map((pid) => {
                  const prog = selectable.find((x) => x.id === pid);
                  return <li key={pid}>{prog?.name || pid}</li>;
                })}
              </ul>
            </div>
          ) : null}
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
            <button
              type="button"
              className="btn btn-sm"
              disabled={!(h.weekRoutineProgramIds || []).length || !onScheduleWorkoutTask}
              onClick={() => scheduleFullWeekInOrder()}
            >
              Add all to this week
            </button>
          </div>
          <div className="health-save-bundle-row surface-glass">
            <label className="quick-row health-field-stack health-save-bundle-name">
              <span className="label">Bundle name</span>
              <input
                className="input health-input-constrained"
                value={bundleProgramName}
                onChange={(e) => setBundleProgramName(e.target.value)}
                placeholder="e.g. Full week rotation"
                aria-label="Name for combined routine program"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveWeekBundle();
                  }
                }}
              />
            </label>
            <p className="settings-hint health-save-bundle-hint">
              Saves a name for this rotation. Programs stay separate in My programs (not merged into one long list).
            </p>
            <button
              type="button"
              className="btn btn-primary health-save-bundle-btn"
              disabled={
                !(h.weekRoutineProgramIds || []).length || !bundleProgramName.trim()
              }
              onClick={saveWeekBundle}
            >
              Save weekly plan name
            </button>
          </div>

          <AddWorkoutWeekModal
            open={!!addWeekProgram}
            program={addWeekProgram}
            weekProgramIds={h.weekRoutineProgramIds || []}
            weekCursor={h.weekRoutineCursor}
            startDayKey={realTodayKey}
            onCancel={() => setAddWeekProgram(null)}
            onConfirm={confirmAddWeekProgram}
          />

          <label className="quick-row health-field-stack health-weekly-target-row" style={{ marginTop: 20 }}>
            <span className="label">Workouts per week (goal)</span>
            <p className="health-subline health-field-descriptor">
              Used for your progress ring and exercise overview. Counts gym tasks and tasks linked to a program.
            </p>
            <input
              className="input health-input-constrained"
              type="number"
              min={1}
              max={14}
              value={h.profile.weeklyWorkoutTarget}
              onChange={(e) =>
                patchProfile({
                  weeklyWorkoutTarget: Math.max(1, Math.min(14, Math.round(Number(e.target.value) || 3))),
                })
              }
              aria-label="Weekly workout target"
            />
          </label>

          <div className="health-consistency surface-glass health-consistency--after-program" style={{ marginTop: 16 }}>
            <div className="health-consistency-head">
              <span className="title">Workout rhythm this week</span>
              <span className="health-consistency-meta">
                {consistency.scheduleDays}/7 days scheduled · {consistency.completed}/{consistency.target} completed
                {workoutOverview.thisWeekMetGoal ? " · Goal met" : ""}
              </span>
            </div>
            <div className="health-progress-track" role="progressbar" aria-valuenow={consistency.blendPct} aria-valuemin={0} aria-valuemax={100}>
              <div className="health-progress-fill" style={{ width: `${consistency.blendPct}%` }} />
            </div>
          </div>

        </>
      ) : (
        <>
          <div className="health-macro-block surface-glass">
            <div className="panel-title" style={{ marginBottom: 8 }}>
              <span className="title">Macro tracker</span>
            </div>
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
            ) : null}
            <div className="health-meal-log-section" ref={mealLogSectionRef}>
              <div className="health-meal-type-field">
                <span className="label" id="health-meal-type-label">
                  Meal
                </span>
                <div className="health-meal-type-picker" role="group" aria-labelledby="health-meal-type-label">
                  {MEAL_TYPE_OPTIONS.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`health-meal-type-btn ${mealType === type ? "is-selected" : ""}`}
                      aria-pressed={mealType === type}
                      onClick={() => setMealType(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="health-label-scan-row">
                <button
                  type="button"
                  className="btn btn-primary health-label-scan-btn"
                  disabled={labelScanBusy}
                  onClick={handleScanNutritionLabelClick}
                >
                  {labelScanBusy ? "Reading label…" : "Scan nutrition label"}
                </button>
                <span className="health-subline health-label-scan-hint">Opens camera · reads P / C / F / calories</span>
              </div>
              <label className="quick-row health-meal-food-field">
                <span className="label">What you ate</span>
                <div className="health-meal-food-input-wrap" ref={mealFoodPickerRef}>
                  <input
                    className="input"
                    value={mealFood}
                    onChange={(e) => onMealFoodChange(e.target.value)}
                    onFocus={() => {
                      if (mealFood.trim().length > 0) setMealFoodPickerOpen(true);
                    }}
                    onBlur={onMealFoodBlur}
                    placeholder="e.g. chicken, oatmeal, protein bar"
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-expanded={mealFoodPickerOpen && hasFoodAutocomplete}
                    aria-controls="health-meal-food-autocomplete"
                  />
                  {mealFoodPickerOpen && hasFoodAutocomplete ? (
                    <div id="health-meal-food-autocomplete" className="health-macro-preset-dropdown" role="listbox" aria-label="Matching foods">
                      {foodAutocompleteItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          role="option"
                          aria-selected={selectedFoodMatchId === item.id}
                          className={`health-macro-preset-dropdown-item ${selectedFoodMatchId === item.id ? "is-selected" : ""}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectFoodAutocompleteItem(item)}
                        >
                          <span className="health-macro-preset-dropdown-label">{item.label}</span>
                          <span className="health-macro-preset-dropdown-macros">
                            <span className="health-meal-food-match-tag">{item.sublabel}</span>
                            {" · "}
                            P {item.macros.protein}g · C {item.macros.carbs}g · F {item.macros.fat}g · {item.macros.calories} kcal
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </label>
              {hasFoodAutocomplete && !selectedFoodMatchId && !showMacroFields ? (
                <p className="settings-hint health-meal-food-hint">Pick a match above, or tap outside this section to enter macros manually.</p>
              ) : null}
              <label className="health-meal-prep-toggle quick-row">
                <span className="label">Meal prep mode</span>
                <span className="health-meal-prep-toggle-inner">
                  <input
                    type="checkbox"
                    checked={mealPrepMode}
                    onChange={(e) => setMealPrepMode(e.target.checked)}
                    title="Log this meal on every selected day (same macros)"
                  />
                </span>
              </label>
              {mealPrepMode ? (
                <div className="health-meal-prep-days" role="group" aria-label="Days to log this meal">
                  <span className="health-subline" style={{ display: "block", marginBottom: 6 }}>
                    Week of selected day
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
              <div className="health-meal-servings-field">
                <span className="label" id="health-meal-servings-label">
                  Servings
                </span>
                <div className="health-meal-servings-picker" role="group" aria-labelledby="health-meal-servings-label">
                  {MEAL_SERVING_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`health-meal-type-btn health-meal-serving-btn ${mealServings === n ? "is-selected" : ""}`}
                      aria-pressed={mealServings === n}
                      onClick={() => onMealServingsChange(n)}
                    >
                      {n === 0.5 ? "½" : n}
                    </button>
                  ))}
                </div>
              </div>
              {showMacroFields ? (
                <>
                  <div className="health-calc-grid health-meal-macro-grid" style={{ marginTop: 8 }}>
                    {["protein", "carbs", "fat", "calories"].map((field) => (
                      <label key={field} className="quick-row">
                        <span className="label">{field === "calories" ? "Calories" : `${field} (g)`}</span>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          value={
                            field === "protein" ? mealProtein : field === "carbs" ? mealCarbs : field === "fat" ? mealFat : mealCalories
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            setMacroManualEntry(true);
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
                  </div>
                </>
              ) : null}
            </div>
            {macroDay.meals?.length ? (
              <ul className="health-meal-list">
                {macroDay.meals.map((m) => (
                  <li key={m.id} className="health-meal-list-item surface-glass">
                    <div>
                      <strong>{m.label || "Meal"}</strong>
                      {m.food ? (
                        <div className="health-subline">
                          {m.food}
                        </div>
                      ) : null}
                      <div className="health-subline">
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
              <div className="empty" style={{ marginTop: 10 }}>
                No meals for this day.
              </div>
            )}
          </div>

          {macroMealPlanSuggestions.length ? (
            <div className="health-macro-block surface-glass health-macro-meal-plans">
              <div className="panel-title" style={{ marginBottom: 8 }}>
                <span className="title">Suggested day plans</span>
              </div>
              <p className="health-subline" style={{ marginBottom: 12 }}>
                Example full days scaled to your <strong>{targets.calories}</strong> kcal target. Macros are ballpark; adjust portions to line up with P/C/F if you like.
              </p>
              <div className="health-macro-meal-plan-list">
                {macroMealPlanSuggestions.map((plan) => (
                  <details key={plan.id} className="health-macro-meal-plan-card">
                    <summary className="health-macro-meal-plan-summary">
                      <span className="health-macro-meal-plan-summary-title">{plan.name}</span>
                      <span className="health-macro-meal-plan-summary-meta">
                        {plan.totals.calories} kcal · P{plan.totals.protein} C{plan.totals.carbs} F{plan.totals.fat}
                      </span>
                    </summary>
                    <div className="health-macro-meal-plan-body">
                      <p className="health-subline" style={{ marginTop: 0 }}>
                        {plan.blurb}
                      </p>
                      <ul className="health-macro-meal-plan-meals">
                        {plan.meals.map((m, idx) => (
                          <li key={`${plan.id}-${idx}`}>
                            <strong>{m.slot}</strong>
                            <span className="health-macro-meal-plan-meal-macros">
                              {" "}
                              P {m.protein}g · C {m.carbs}g · F {m.fat}g · {m.calories} kcal
                            </span>
                            <div className="health-subline health-macro-meal-plan-meal-lines">{m.lines.join(" · ")}</div>
                          </li>
                        ))}
                      </ul>
                      <p className="health-subline health-macro-meal-plan-vs">
                        vs your targets: cal {plan.vsTargetsPct.calories ?? "n/a"}%
                        {plan.vsTargetsPct.protein != null ? ` · P ${plan.vsTargetsPct.protein}%` : ""}
                        {plan.vsTargetsPct.carbs != null ? ` · C ${plan.vsTargetsPct.carbs}%` : ""}
                        {plan.vsTargetsPct.fat != null ? ` · F ${plan.vsTargetsPct.fat}%` : ""}
                      </p>
                      <div className="health-macro-meal-plan-actions">
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => logSuggestedPlanToMacroDay(plan)}>
                          Log this plan on {macroDate}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() =>
                            loadShoppingDraftFromLines(collectShoppingLinesFromMealPlan(plan), `${plan.name} groceries`)
                          }
                        >
                          Add groceries to list
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm health-weekly-menu-add-plan-btn${weeklyMenuPlanAddedKey === `${plan.id}:${macroDate}` ? " health-weekly-menu-add-plan-btn--added" : ""}`}
                          onClick={() => applyMealPlanToWeeklyMenu(plan)}
                          disabled={weeklyMenuPlanAddedKey === `${plan.id}:${macroDate}`}
                          aria-live="polite"
                        >
                          {weeklyMenuPlanAddedKey === `${plan.id}:${macroDate}`
                            ? "Added"
                            : `Add to weekly menu (${macroDate})`}
                        </button>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ) : null}

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
                <p className="health-subline health-macro-calc-compact-meta">
                  Targets: {targets.calories} kcal · P{targets.proteinG} C{targets.carbsG} F{targets.fatG}
                  {macroMealPlanSuggestions.length ? " · Suggested day plans below the tracker." : ""}
                </p>
              ) : null}
            </div>
            <div id="health-macro-calc-body" className={macroCalcExpanded ? "health-macro-calc-body" : "health-macro-calc-body health-macro-calc-body--hidden"}>
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
                      <span className="health-subline">Feet</span>
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
                      <span className="health-subline">Inches</span>
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
                    <span className="health-subline" style={{ marginTop: 6, display: "block" }}>
                      ~{h.profile.heightCm} cm stored
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
                    <span className="health-subline" style={{ marginTop: 6, display: "block" }}>
                      ~{Math.round(h.profile.weightKg * 10) / 10} kg stored
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
                <label className="quick-row health-macro-calc-full">
                  <span className="label">Dietary style (for Coach &amp; suggestions)</span>
                  <select
                    className="input"
                    value={h.profile.dietaryStyle || "none"}
                    onChange={(e) => patchProfile({ dietaryStyle: e.target.value })}
                  >
                    <option value="none">No preference set</option>
                    <option value="vegan">Vegan</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="pescatarian">Pescatarian</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="quick-row health-macro-calc-full">
                  <span className="label">Dietary notes</span>
                  <input
                    className="input"
                    value={h.profile.dietaryNotes || ""}
                    onChange={(e) => patchProfile({ dietaryNotes: e.target.value })}
                    placeholder="Allergies, foods to avoid, etc."
                  />
                </label>
              </div>
              {onAskCoachMealPlan && targets?.calories ? (
                <div className="health-coach-meal-plan-cta">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      const p = h.profile;
                      const bits = [];
                      if (p.dietaryStyle && p.dietaryStyle !== "none") bits.push(`diet: ${p.dietaryStyle}`);
                      if (p.dietaryNotes?.trim()) bits.push(p.dietaryNotes.trim());
                      if (targets.proteinG) bits.push(`about ${targets.proteinG}g protein per day`);
                      if (targets.calories) bits.push(`~${targets.calories} kcal per day`);
                      const prefs = bits.length ? ` (${bits.join("; ")})` : "";
                      onAskCoachMealPlan(
                        `Make me a full weekly meal plan for this week${prefs}. Include tofu or other plant proteins if vegan. Give breakfast, lunch, dinner, and snacks for all 7 days with protein, carbs, fat, and calories on each meal, plus a grocery shopping list. I want to add it to my weekly menu and see meals on the home screen.`
                      );
                    }}
                  >
                    Ask Coach for weekly meal plan
                  </button>
                  <p className="health-subline health-coach-meal-plan-cta-hint">
                    Coach drafts the week; you can add it as-is or edit under Weekly menu in Macros.
                  </p>
                </div>
              ) : null}
              <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={applyCalculator}>
                Apply targets to tracker
              </button>
              {targets?.calories ? (
                <p className="health-macro-targets" style={{ marginTop: 12 }}>
                  Targets: <strong>{targets.calories}</strong> kcal · P <strong>{targets.proteinG}</strong>g · C <strong>{targets.carbsG}</strong>g · F{" "}
                  <strong>{targets.fatG}</strong>g
                </p>
              ) : null}
            </div>
          </div>

          <div className="health-macro-block surface-glass health-weight-goal-block">
            <div className="panel-title" style={{ marginBottom: 8 }}>
              <span className="title">Weight &amp; goal</span>
            </div>
            <div className="health-weight-goal-stack">
              <label className="quick-row health-field-stack">
                <span className="label">Goal weight (lb)</span>
                <input
                  className="input health-input-constrained"
                  type="number"
                  min={1}
                  inputMode="decimal"
                  value={goalLbStr}
                  onChange={(e) => setGoalLbStr(e.target.value)}
                  onBlur={commitGoalLbProfile}
                  placeholder="e.g. 150"
                />
                {h.profile.goalWeightKg ? (
                  <span className="health-subline">~{Math.round(h.profile.goalWeightKg * 10) / 10} kg stored</span>
                ) : null}
              </label>
              <label className="quick-row health-field-stack">
                <span className="label">Log weight (lb)</span>
                <div className="health-weight-add">
                  <input
                    className="input health-input-constrained"
                    type="number"
                    min={1}
                    inputMode="decimal"
                    placeholder="e.g. 148"
                    value={logWeightLbStr}
                    onChange={(e) => setLogWeightLbStr(e.target.value)}
                    aria-label="Weight in pounds"
                  />
                  <button type="button" className="btn-primary" onClick={addWeight}>
                    Log weight
                  </button>
                </div>
              </label>
            </div>
            {goalW != null && lastWeight != null ? (
              <div style={{ marginTop: 12 }}>
                <div className="health-progress-track" role="progressbar" aria-valuenow={weightBarPct}>
                  <div className="health-progress-fill health-progress-fill-goal" style={{ width: `${weightBarPct}%` }} />
                </div>
                <p className="health-subline" style={{ marginTop: 6 }}>
                  Goal {formatWeightLbFromKg(goalW)} lb · latest {formatWeightLbFromKg(lastWeight)} lb
                </p>
              </div>
            ) : null}
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

          <div className="health-macro-block surface-glass health-macro-shopping-lists">
            <div className="panel-title" style={{ marginBottom: 8 }}>
              <span className="title">Shopping lists</span>
            </div>
            <p className="health-subline health-macro-shopping-intro">
              Build reusable lists here. When you add a task with keywords like{" "}
              <strong>{groceryKeywordsLabel || DEFAULT_GROCERY_KEYWORDS.join(", ")}</strong>, you can pick one of these lists on the prompt.
            </p>

            <div className="health-macro-shopping-autogen">
              <span className="label">Auto-fill from meals</span>
              <div className="health-macro-shopping-autogen-row">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!todayMealShoppingLines.length}
                  onClick={() => loadShoppingDraftFromLines(todayMealShoppingLines, `Groceries · ${macroDate}`)}
                >
                  From {macroDate} meals
                  {todayMealShoppingLines.length ? ` (${todayMealShoppingLines.length})` : ""}
                </button>
                {macroMealPlanSuggestions.length > 0 ? (
                  <>
                    <select
                      className="input health-macro-shopping-plan-pick"
                      value={groceryPlanPickId}
                      onChange={(e) => setGroceryPlanPickId(e.target.value)}
                      aria-label="Meal plan for shopping list"
                    >
                      <option value="">Meal plan…</option>
                      {macroMealPlanSuggestions.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={!pickedMealPlan}
                      onClick={() => {
                        if (!pickedMealPlan) return;
                        loadShoppingDraftFromLines(
                          collectShoppingLinesFromMealPlan(pickedMealPlan),
                          `${pickedMealPlan.name} groceries`
                        );
                      }}
                    >
                      From plan
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <label className="quick-row health-field-stack health-shopping-list-name" style={{ marginTop: 12 }}>
              <span className="label">List name</span>
              <input
                className="input health-input-constrained"
                value={groceryListTitle}
                onChange={(e) => setGroceryListTitle(e.target.value)}
                placeholder="e.g. Weekly groceries"
              />
            </label>
            <div className="health-grocery-add-block">
              <label className="quick-row health-field-stack">
                <span className="label">Add item</span>
                <div className="health-grocery-add-row">
                  <input
                    className="input health-input-constrained"
                    value={groceryItemInput}
                    onChange={(e) => setGroceryItemInput(e.target.value)}
                    placeholder="e.g. Broccoli"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addGroceryDraftItem();
                      }
                    }}
                  />
                  <button type="button" className="btn btn-primary btn-sm" onClick={addGroceryDraftItem}>
                    Add to list
                  </button>
                </div>
              </label>
              {groceryDraftItems.length > 0 ? (
                <ol className="health-draft-exercises health-grocery-draft-items">
                  {groceryDraftItems.map((text, i) => (
                    <li key={`${i}-${text}`} className="health-draft-exercise surface-glass">
                      <div className="health-draft-exercise-text">
                        <div className="health-draft-ex-line">{text}</div>
                      </div>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeGroceryDraftItem(i)}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="settings-hint health-grocery-empty-hint">Items appear here as you add them.</p>
              )}
            </div>
            <div className="health-macro-actions-center">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!groceryDraftItems.length}
                onClick={() => saveGroceryListFromLines(groceryListTitle, groceryDraftItems, { clearDraft: true })}
              >
                Save shopping list
              </button>
            </div>

            {grocerySavedLists.length > 0 ? (
              <ul className="health-macro-shopping-saved">
                {grocerySavedLists.map((list) => (
                  <li key={list.id} className="health-macro-shopping-saved-item">
                    <details>
                      <summary>
                        <span className="health-macro-shopping-saved-title">{list.title}</span>
                        <span className="health-subline">{(list.items || []).length} items</span>
                      </summary>
                      <ul className="health-macro-shopping-saved-lines">
                        {(list.items || []).map((it) => (
                          <li key={it.id}>{it.text}</li>
                        ))}
                      </ul>
                      <div className="health-macro-shopping-saved-actions">
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() =>
                            loadShoppingDraftFromLines(
                              (list.items || []).map((it) => it.text),
                              list.title
                            )
                          }
                        >
                          Edit in draft
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => removeSavedGroceryList(list.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty health-macro-shopping-empty">No saved lists yet.</p>
            )}
          </div>

          <div className="health-macro-block surface-glass health-weekly-menu-block">
            <div className="panel-title health-weekly-menu-head">
              <span className="title">Weekly menu</span>
              <label className="health-toggle-row health-weekly-menu-home-toggle">
                <span className="label">View on home page</span>
                <input
                  type="checkbox"
                  checked={normalizeWeeklyMenu(h.weeklyMenu).showOnHome}
                  onChange={(e) =>
                    setHealth((prev) => {
                      const base = normalizeHealth(prev);
                      const wm = normalizeWeeklyMenu(base.weeklyMenu);
                      return { ...base, weeklyMenu: { ...wm, showOnHome: e.target.checked } };
                    })
                  }
                />
              </label>
            </div>
            <p className="health-subline">
              Plan meals for each day of the week. On Today, tap meals to log them to your macro tracker (choose a serving size for partial portions).
            </p>
            <div className="health-weekly-menu-day-tabs" role="tablist" aria-label="Weekday">
              {weeklyMenuDayLabels().map((label, idx) => (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={weeklyMenuEditDay === idx}
                  className={`btn btn-sm health-meal-prep-chip ${weeklyMenuEditDay === idx ? "btn-primary" : ""}`}
                  onClick={() => setWeeklyMenuEditDay(idx)}
                >
                  {label.slice(0, 3)}
                </button>
              ))}
            </div>
            <div className="health-weekly-menu-editor">
              <label className="quick-row">
                <span className="label">Meal slot</span>
                <select className="input health-input-constrained" value={weeklyMenuSlot} onChange={(e) => setWeeklyMenuSlot(e.target.value)}>
                  {MEAL_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="quick-row health-field-stack">
                <span className="label">What you plan to eat</span>
                <input
                  className="input health-input-constrained"
                  value={weeklyMenuFood}
                  onChange={(e) => setWeeklyMenuFood(e.target.value)}
                  placeholder="e.g. Tofu bowl with rice"
                />
              </label>
              <div className="health-calc-grid health-meal-macro-grid health-weekly-menu-macro-grid">
                {[
                  ["protein", weeklyMenuProtein, setWeeklyMenuProtein],
                  ["carbs", weeklyMenuCarbs, setWeeklyMenuCarbs],
                  ["fat", weeklyMenuFat, setWeeklyMenuFat],
                  ["calories", weeklyMenuCalories, setWeeklyMenuCalories],
                ].map(([field, val, setVal]) => (
                  <label key={field} className="quick-row">
                    <span className="label">{field === "calories" ? "Calories" : `${field} (g)`}</span>
                    <input className="input" type="number" min={0} value={val} onChange={(e) => setVal(e.target.value)} />
                  </label>
                ))}
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={addWeeklyMenuMeal}>
                Add meal to {weeklyMenuDayLabels()[weeklyMenuEditDay]}
              </button>
            </div>
            {(normalizeWeeklyMenu(h.weeklyMenu).days[weeklyMenuEditDay] || []).length > 0 ? (
              <ul className="health-weekly-menu-planned">
                {(normalizeWeeklyMenu(h.weeklyMenu).days[weeklyMenuEditDay] || []).map((meal) => {
                  const follow =
                    macroDate === realTodayKey ? getWeeklyMenuFollowStatus(h, macroDate, meal.id) : null;
                  const logServ = weeklyMenuLogServings[meal.id] ?? 1;
                  return (
                    <li key={meal.id} className="health-draft-exercise surface-glass health-weekly-menu-meal">
                      <div className="health-draft-exercise-text">
                        <div className="health-draft-ex-line">
                          <strong>{meal.slot}</strong>
                          {follow === "logged" ? <span className="health-weekly-menu-badge">Logged</span> : null}
                          {follow === "skipped" ? <span className="health-weekly-menu-badge health-weekly-menu-badge--skip">Skipped</span> : null}
                        </div>
                        {meal.food ? <div className="health-subline">{meal.food}</div> : null}
                        <div className="health-subline">
                          P {meal.protein}g · C {meal.carbs}g · F {meal.fat}g · {meal.calories} kcal
                        </div>
                      </div>
                      <div className="health-weekly-menu-meal-actions">
                        {macroDate === realTodayKey ? (
                          <>
                            <select
                              className="input health-weekly-menu-serving-pick"
                              value={String(logServ)}
                              onChange={(e) =>
                                setWeeklyMenuLogServings((prev) => ({ ...prev, [meal.id]: Number(e.target.value) }))
                              }
                              aria-label="Servings"
                            >
                              {MEAL_SERVING_OPTIONS.map((n) => (
                                <option key={n} value={n}>
                                  {n === 0.5 ? "½ serving" : `${n} serving${n === 1 ? "" : "s"}`}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              disabled={follow === "logged"}
                              onClick={() => logWeeklyMenuMealFromTracker(meal, logServ)}
                            >
                              Log today
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => setHealth((prev) => markWeeklyMenuMealSkipped(prev, macroDate, meal.id))}
                            >
                              Skip
                            </button>
                          </>
                        ) : null}
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeWeeklyMenuMeal(weeklyMenuEditDay, meal.id)}>
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="settings-hint">No meals planned for {weeklyMenuDayLabels()[weeklyMenuEditDay]} yet.</p>
            )}
          </div>
        </>
      )}

      <div
        className={`health-page-bottom-bar surface-glass health-macro-bottom-bar${healthTab === "workouts" ? " health-macro-bottom-bar--workouts" : ""}`}
      >
        {healthTab === "workouts" ? (
          <>
            <p className="health-overview-hint settings-hint">
              Avg {workoutOverview.avgAddedPerWeek} added · {workoutOverview.avgCompletedPerWeek} completed per week · Goal hit{" "}
              {workoutOverview.goalHitPct}% of last {workoutOverview.weeksTracked} weeks
            </p>
            <button
              type="button"
              className="btn btn-primary health-overview-btn health-overview-btn--centered"
              onClick={() => setWorkoutOverviewOpen(true)}
            >
              Exercise overview
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary health-overview-btn health-overview-btn--centered"
            onClick={() => setMacroOverviewOpen(true)}
          >
            Macro overview
          </button>
        )}
      </div>

      {workoutOverviewOpen ? (
        <div
          className="modal-overlay health-workout-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workout-ov-title"
          onClick={() => setWorkoutOverviewOpen(false)}
        >
          <div className="modal health-overview-modal surface-glass" onClick={(e) => e.stopPropagation()}>
            <div className="health-workout-sheet-head">
              <h3 id="workout-ov-title" className="health-workout-sheet-title">
                Exercise overview
              </h3>
              <button type="button" className="btn-icon" aria-label="Close" onClick={() => setWorkoutOverviewOpen(false)}>
                <CloseIcon style={{ width: 22, height: 22 }} />
              </button>
            </div>
            <p className="settings-hint health-overview-intro">
              Tracks gym tasks and Today tasks linked to a workout program (added vs checked off). Your weekly goal is{" "}
              <strong>{workoutOverview.target}</strong> completed workouts.
            </p>
            <div className="health-overview-stat-grid">
              <div className="health-overview-stat">
                <span className="health-overview-stat-value">{workoutOverview.thisWeekCompleted}</span>
                <span className="health-overview-stat-label">Done this week</span>
              </div>
              <div className="health-overview-stat">
                <span className="health-overview-stat-value">{workoutOverview.avgAddedPerWeek}</span>
                <span className="health-overview-stat-label">Avg added / week</span>
              </div>
              <div className="health-overview-stat">
                <span className="health-overview-stat-value">{workoutOverview.avgCompletedPerWeek}</span>
                <span className="health-overview-stat-label">Avg completed / week</span>
              </div>
              <div className="health-overview-stat">
                <span className="health-overview-stat-value">{workoutOverview.goalHitPct}%</span>
                <span className="health-overview-stat-label">Weeks at goal ({workoutOverview.weeksMetGoal}/{workoutOverview.weeksTracked})</span>
              </div>
            </div>
            <div className="health-overview-table-wrap">
              <table className="health-overview-table">
                <thead>
                  <tr>
                    <th>Week starting</th>
                    <th>Added</th>
                    <th>Completed</th>
                    <th>Goal</th>
                  </tr>
                </thead>
                <tbody>
                  {workoutOverview.recentWeeks.map((w) => (
                    <tr key={w.weekMon}>
                      <td>{w.weekMon}</td>
                      <td>{w.added}</td>
                      <td>{w.completed}</td>
                      <td>{w.metGoal ? "Met" : w.added > 0 || w.completed > 0 ? "Missed" : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn" style={{ marginTop: 14 }} onClick={() => setWorkoutOverviewOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

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
            {macroOverviewRows.length === 0 ? (
              <p className="empty" style={{ marginTop: 12 }}>
                No logged days yet.
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

      <NutritionLabelScanner
        open={labelScannerOpen}
        initialOcr={labelScannerInitialOcr}
        onClose={closeLabelScanner}
        onApply={applyLabelScanToMeal}
      />

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

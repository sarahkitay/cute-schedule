import React, { startTransition, useEffect, useMemo, useState } from "react";
import { CheckIcon } from "./Icons";

function rid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function parseCategoriesInput(raw) {
  return String(raw || "")
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * First-launch wizard: one step per screen, Next or Skip on each.
 */
export function OnboardingFlow({
  step,
  setStep,
  onExitComplete,
  onExitSkipAll,
  firebaseOn,
  profile,
  setProfile,
  theme,
  setTheme,
  themesMap,
  habitTracker,
  setHabitTracker,
  routineTemplate,
  setRoutineTemplate,
  morningRoutineTemplate,
  setMorningRoutineTemplate,
  routineSchedule,
  setRoutineSchedule,
  customCategories,
  setCustomCategories,
  suggestedCategories,
  fallbackMorningTemplate,
  fallbackNightTemplate,
}) {
  const themeEntries = useMemo(() => Object.entries(themesMap), [themesMap]);
  const totalSteps = 9;
  const [habitLabel, setHabitLabel] = useState("");
  const [habitDir, setHabitDir] = useState("build");
  const [morningDraft, setMorningDraft] = useState("");
  const [nightDraft, setNightDraft] = useState("");
  const [catsDraft, setCatsDraft] = useState("");

  useEffect(() => {
    if (step === 5) {
      startTransition(() => {
        setMorningDraft(morningRoutineTemplate.map((r) => r.text).join("\n"));
        setNightDraft(routineTemplate.map((r) => r.text).join("\n"));
      });
    }
    if (step === 7) {
      startTransition(() => {
        setCatsDraft((customCategories && customCategories.length ? customCategories : suggestedCategories).join(", "));
      });
    }
  }, [step, morningRoutineTemplate, routineTemplate, customCategories, suggestedCategories]);

  function applyRoutineDrafts() {
    const mLines = morningDraft
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const nLines = nightDraft
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    setMorningRoutineTemplate(mLines.length ? mLines.map((text) => ({ id: rid(), text })) : fallbackMorningTemplate);
    setRoutineTemplate(nLines.length ? nLines.map((text) => ({ id: rid(), text })) : fallbackNightTemplate);
  }

  function applyCategories() {
    const parsed = parseCategoriesInput(catsDraft);
    if (parsed.length) setCustomCategories(parsed);
    else setCustomCategories(suggestedCategories);
  }

  function goNext() {
    if (step === 5) applyRoutineDrafts();
    if (step === 7) applyCategories();
    if (step >= totalSteps - 1) {
      onExitComplete();
      return;
    }
    setStep((s) => s + 1);
  }

  function goSkip() {
    if (step === 0) {
      onExitSkipAll();
      return;
    }
    if (step === 5) {
      /* keep templates as-is */
    } else if (step === 7) {
      setCustomCategories(suggestedCategories);
    }
    if (step >= totalSteps - 1) {
      onExitComplete();
      return;
    }
    setStep((s) => s + 1);
  }

  function addHabit() {
    const label = habitLabel.trim();
    if (!label) return;
    setHabitTracker((prev) => ({
      habits: [...(prev.habits || []), { id: rid(), label, direction: habitDir === "break" ? "break" : "build" }],
      log: prev.log || {},
    }));
    setHabitLabel("");
  }

  const progress = `${Math.min(step + 1, totalSteps)} / ${totalSteps}`;

  return (
    <div className="onboarding-root" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-card surface-glass">
        <p className="onboarding-progress">{progress}</p>
        {step === 0 && (
          <>
            <h2 id="onboarding-title" className="onboarding-title">
              Welcome to PROYOU
            </h2>
            <p className="onboarding-lead">
              {firebaseOn
                ? "You’re signed in. Over the next few screens you can add your name, birthday, habits, colors, routines, and task types, or skip anything you’d rather set up later in Settings."
                : "Let’s walk through a few quick choices so the app feels like yours. You can skip any step and change everything later in Settings."}
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <h2 id="onboarding-title" className="onboarding-title">
              What should we call you?
            </h2>
            <p className="onboarding-lead">We’ll use this in greetings and the morning check-in.</p>
            <label className="label" htmlFor="onb-name">
              Name
            </label>
            <input
              id="onb-name"
              className="input onboarding-input"
              value={profile.userName}
              onChange={(e) => setProfile((p) => ({ ...p, userName: e.target.value }))}
              placeholder="Your name"
              autoComplete="name"
            />
          </>
        )}
        {step === 2 && (
          <>
            <h2 id="onboarding-title" className="onboarding-title">
              Birthday (optional)
            </h2>
            <p className="onboarding-lead">
              Enter month and day as MMDD (e.g. 0315 for March 15). We’ll show a happy birthday message on the day and can remind you if notifications are on.
            </p>
            <label className="label" htmlFor="onb-bday">
              MMDD
            </label>
            <input
              id="onb-bday"
              className="input onboarding-input"
              inputMode="numeric"
              maxLength={4}
              value={profile.userBirthday}
              onChange={(e) => setProfile((p) => ({ ...p, userBirthday: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
              placeholder="0315"
              aria-label="Birthday month and day"
            />
          </>
        )}
        {step === 3 && (
          <>
            <h2 id="onboarding-title" className="onboarding-title">
              Habits
            </h2>
            <p className="onboarding-lead">Add habits you want to build or break. You can edit them anytime in Settings.</p>
            <div className="onboarding-habit-row">
              <input
                className="input onboarding-input"
                value={habitLabel}
                onChange={(e) => setHabitLabel(e.target.value)}
                placeholder="e.g. Drink water, Screen off by 10pm"
              />
              <select className="input onboarding-select" value={habitDir} onChange={(e) => setHabitDir(e.target.value)} aria-label="Habit direction">
                <option value="build">Build</option>
                <option value="break">Break</option>
              </select>
              <button type="button" className="btn btn-sm btn-primary" onClick={addHabit}>
                Add
              </button>
            </div>
            <ul className="onboarding-habit-list">
              {(habitTracker.habits || []).map((h) => (
                <li key={h.id} className="onboarding-habit-item">
                  <span>{h.label}</span>
                  <span className="onboarding-habit-meta">{h.direction === "break" ? "Break" : "Build"}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setHabitTracker((prev) => ({
                        ...prev,
                        habits: (prev.habits || []).filter((x) => x.id !== h.id),
                      }))
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {step === 4 && (
          <>
            <h2 id="onboarding-title" className="onboarding-title">
              Color scheme
            </h2>
            <p className="onboarding-lead">Pick a palette. It updates the whole app, header, buttons, and background.</p>
            <div className="onboarding-theme-grid">
              {themeEntries.map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  className={`onboarding-theme-chip ${theme.name === t.name ? "selected" : ""}`}
                  onClick={() => setTheme(t)}
                  title={t.name}
                  style={{
                    background: t.gradient,
                    border: theme.name === t.name ? "3px solid var(--text)" : "2px solid rgba(0,0,0,0.08)",
                  }}
                >
                  {theme.name === t.name ? <CheckIcon style={{ width: 18, height: 18, color: "#222" }} /> : null}
                  <span className="onboarding-theme-label">{t.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {step === 5 && (
          <>
            <h2 id="onboarding-title" className="onboarding-title">
              Morning & night routines
            </h2>
            <p className="onboarding-lead">One line per step. Edit the suggestions or replace them with your own.</p>
            <label className="label">Morning</label>
            <textarea className="input onboarding-textarea" rows={4} value={morningDraft} onChange={(e) => setMorningDraft(e.target.value)} />
            <label className="label" style={{ marginTop: 12 }}>
              Night
            </label>
            <textarea className="input onboarding-textarea" rows={4} value={nightDraft} onChange={(e) => setNightDraft(e.target.value)} />
          </>
        )}
        {step === 6 && (
          <>
            <h2 id="onboarding-title" className="onboarding-title">
              Show routines on Today
            </h2>
            <p className="onboarding-lead">Choose whether morning and wind-down lists appear on your Today view.</p>
            <label className="onboarding-check">
              <input
                type="checkbox"
                checked={routineSchedule.enabledMorning !== false}
                onChange={(e) => setRoutineSchedule((s) => ({ ...s, enabledMorning: e.target.checked }))}
              />
              <span>Show morning routine</span>
            </label>
            <label className="onboarding-check">
              <input
                type="checkbox"
                checked={routineSchedule.enabledNight !== false}
                onChange={(e) => setRoutineSchedule((s) => ({ ...s, enabledNight: e.target.checked }))}
              />
              <span>Show night / wind-down routine</span>
            </label>
          </>
        )}
        {step === 7 && (
          <>
            <h2 id="onboarding-title" className="onboarding-title">
              Task types
            </h2>
            <p className="onboarding-lead">These become your task categories (e.g. Work, School, Personal). Separate with commas.</p>
            <textarea
              className="input onboarding-textarea"
              rows={3}
              value={catsDraft}
              onChange={(e) => setCatsDraft(e.target.value)}
              placeholder={suggestedCategories.join(", ")}
            />
          </>
        )}
        {step === 8 && (
          <>
            <h2 id="onboarding-title" className="onboarding-title">
              You&apos;re all set
            </h2>
            <p className="onboarding-lead">Everything here can be changed in Settings. Enjoy your customized PROYOU.</p>
          </>
        )}
        <div className="onboarding-actions">
          {step > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Back
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={goSkip}>
            {step === 0 ? "Skip setup" : "Skip"}
          </button>
          <button type="button" className="btn btn-primary" onClick={goNext}>
            {step === 8 ? "Continue to app" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

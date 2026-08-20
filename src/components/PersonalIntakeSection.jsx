import React from "react";
import {
  FALLOFF_REASON_OPTIONS,
  INTAKE_GENDER_OPTIONS,
  ONBOARDING_USE_CASES,
  PEAK_TIME_OPTIONS,
  canOfferPeriodTracker,
  defaultPeriodTrackerEnabled,
  normalizeIntakeGender,
} from "../intakeModel.js";

/**
 * Settings → Personal & account intake fields (editable after onboarding).
 */
export function PersonalIntakeSection({ profile, setProfile, coachingTone, setCoachingTone }) {
  const gender = normalizeIntakeGender(profile.intakeGender);
  const showPeriodToggle = canOfferPeriodTracker(gender);

  function setGender(next) {
    const g = normalizeIntakeGender(next);
    setProfile((p) => ({
      ...p,
      intakeGender: g,
      periodTrackerEnabled: canOfferPeriodTracker(g)
        ? p.periodTrackerEnabled ?? defaultPeriodTrackerEnabled(g)
        : false,
    }));
  }

  return (
    <>
      <div className="settings-section">
        <label className="label">Gender (optional)</label>
        <select
          className="input modal-input"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          aria-label="Gender"
        >
          <option value="">Prefer not to answer yet</option>
          {INTAKE_GENDER_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="settings-hint" style={{ marginTop: 6 }}>
          Used for period tracker suggestions only. Not shared with friends.
        </p>
      </div>

      {showPeriodToggle ? (
        <div className="settings-section">
          <label className="social-toggle-row">
            <input
              type="checkbox"
              checked={!!profile.periodTrackerEnabled}
              onChange={(e) => setProfile((p) => ({ ...p, periodTrackerEnabled: e.target.checked }))}
            />
            <span>Show period tracker in You</span>
          </label>
        </div>
      ) : null}

      <div className="settings-section">
        <label className="label">What brought you to ProYou</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {ONBOARDING_USE_CASES.map((uc) => {
            const selected = (profile.onboardingUseCases || []).includes(uc.id);
            return (
              <button
                key={uc.id}
                type="button"
                className={`btn btn-sm${selected ? " btn-primary" : ""}`}
                onClick={() =>
                  setProfile((p) => {
                    const cur = Array.isArray(p.onboardingUseCases) ? p.onboardingUseCases : [];
                    const next = selected ? cur.filter((x) => x !== uc.id) : [...cur, uc.id];
                    const patch = { onboardingUseCases: next };
                    if (uc.id === "cycle" && !selected && canOfferPeriodTracker(p.intakeGender)) {
                      patch.periodTrackerEnabled = true;
                    }
                    return { ...p, ...patch };
                  })
                }
              >
                {uc.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="settings-section">
        <label className="label">Peak focus time</label>
        <select
          className="input modal-input"
          value={profile.peakTime || ""}
          onChange={(e) => setProfile((p) => ({ ...p, peakTime: e.target.value }))}
        >
          <option value="">Not set</option>
          {PEAK_TIME_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="settings-section">
        <label className="label">What makes you fall off track</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {FALLOFF_REASON_OPTIONS.map((fr) => {
            const selected = (profile.falloffReasons || []).includes(fr.id);
            return (
              <button
                key={fr.id}
                type="button"
                className={`btn btn-sm${selected ? " btn-primary" : ""}`}
                onClick={() =>
                  setProfile((p) => {
                    const cur = Array.isArray(p.falloffReasons) ? p.falloffReasons : [];
                    const next = selected ? cur.filter((x) => x !== fr.id) : [...cur, fr.id];
                    return { ...p, falloffReasons: next };
                  })
                }
              >
                {fr.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="settings-section">
        <label className="label">Coach tone</label>
        <select
          className="input modal-input"
          value={coachingTone || "gentle"}
          onChange={(e) => setCoachingTone?.(e.target.value)}
        >
          <option value="gentle">Gentle</option>
          <option value="direct">Direct</option>
          <option value="structured">Structured</option>
        </select>
      </div>
    </>
  );
}

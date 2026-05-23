import React, { useState } from "react";
import { PillButton } from "./PillButton";
import { ModuleToggle } from "./ModuleToggle";
import { NavIcons } from "./NavIcons";
import { MODULE_REGISTRY, DEFAULT_ENABLED_MODULES, DEFAULT_NAV_ORDER } from "../modules/registry";

const USE_CASES = [
  { id: "adhd", label: "ADHD support" },
  { id: "productivity", label: "Productivity" },
  { id: "fitness", label: "Fitness" },
  { id: "finances", label: "Finances" },
  { id: "routines", label: "Routines" },
  { id: "medication", label: "Medication" },
  { id: "sleep", label: "Sleep" },
  { id: "burnout", label: "Burnout recovery" },
  { id: "school", label: "School" },
  { id: "business", label: "Business" },
  { id: "emotional", label: "Emotional regulation" },
];

const COACHING_TONES = [
  { id: "gentle", label: "Gentle", description: "Soft, encouraging, patient" },
  { id: "direct", label: "Direct", description: "Clear, concise, no-nonsense" },
  { id: "structured", label: "Structured", description: "Step-by-step, organized" },
];

const PEAK_TIMES = [
  { id: "morning", label: "Morning", time: "6am–12pm" },
  { id: "afternoon", label: "Afternoon", time: "12pm–5pm" },
  { id: "evening", label: "Evening", time: "5pm–10pm" },
  { id: "varies", label: "It varies", time: "" },
];

const FALLOFF_REASONS = [
  { id: "overwhelm", label: "Feeling overwhelmed" },
  { id: "boredom", label: "Getting bored" },
  { id: "perfectionism", label: "Perfectionism paralysis" },
  { id: "fatigue", label: "Physical fatigue" },
  { id: "distraction", label: "Distractions" },
  { id: "emotional", label: "Emotional dip" },
  { id: "schedule_shift", label: "Schedule disruption" },
];

const TOTAL_STEPS = 7;

export function OnboardingV2({ onComplete, profile, setProfile }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.name || "");
  const [useCases, setUseCases] = useState([]);
  const [enabledModules, setEnabledModules] = useState([...DEFAULT_ENABLED_MODULES]);
  const [peakTime, setPeakTime] = useState("");
  const [falloffReasons, setFalloffReasons] = useState([]);
  const [coachingTone, setCoachingTone] = useState("gentle");

  function toggleUseCase(id) {
    setUseCases((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function toggleModule(id) {
    setEnabledModules((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function toggleFalloff(id) {
    setFalloffReasons((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function finish() {
    const navOrder = DEFAULT_NAV_ORDER.filter((id) => enabledModules.includes(id));
    onComplete({
      name,
      useCases,
      enabledModules,
      navOrder,
      peakTime,
      falloffReasons,
      coachingTone,
    });
  }

  function handleNext() {
    if (step >= TOTAL_STEPS - 1) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  }

  function handleSkip() {
    finish();
  }

  return (
    <div className="py-onboarding">
      <div className="py-onboarding__card">
        {step === 0 && (
          <>
            <div className="py-onboarding__brand">ProYou</div>
            <p className="py-onboarding__subtitle">
              Your adaptive personal operating system.<br />
              Built for real brains, real energy, real life.
            </p>
            <div className="py-onboarding__actions">
              <PillButton variant="primary" size="lg" onClick={handleNext}>
                Get started
              </PillButton>
              <PillButton variant="ghost" onClick={handleSkip}>
                Skip setup
              </PillButton>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 style={{ fontSize: "var(--py-text-title)", fontWeight: 600, color: "var(--py-ink)", marginBottom: "var(--py-space-2)" }}>
              What's your name?
            </h2>
            <p className="py-onboarding__subtitle">So ProYou can greet you personally.</p>
            <input
              className="py-input"
              placeholder="Your first name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              style={{ marginBottom: "var(--py-space-5)" }}
            />
            <div className="py-onboarding__actions">
              <PillButton variant="primary" size="lg" onClick={handleNext}>
                Continue
              </PillButton>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ fontSize: "var(--py-text-title)", fontWeight: 600, color: "var(--py-ink)", marginBottom: "var(--py-space-2)" }}>
              What are you using ProYou for?
            </h2>
            <p className="py-onboarding__subtitle">Select all that apply. This shapes your experience.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--py-space-2)", justifyContent: "center", marginTop: "var(--py-space-4)" }}>
              {USE_CASES.map((uc) => (
                <button
                  key={uc.id}
                  type="button"
                  onClick={() => toggleUseCase(uc.id)}
                  className={`py-pill-btn ${useCases.includes(uc.id) ? "py-pill-btn--primary" : "py-pill-btn--secondary"}`}
                  style={{ fontSize: "var(--py-text-subhead)" }}
                >
                  {uc.label}
                </button>
              ))}
            </div>
            <div className="py-onboarding__actions">
              <PillButton variant="primary" size="lg" onClick={handleNext}>
                Continue
              </PillButton>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={{ fontSize: "var(--py-text-title)", fontWeight: 600, color: "var(--py-ink)", marginBottom: "var(--py-space-2)" }}>
              Choose your modules
            </h2>
            <p className="py-onboarding__subtitle">Pick what shows in your navigation. You can change this anytime.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--py-space-2)", marginTop: "var(--py-space-4)", maxHeight: 320, overflowY: "auto", textAlign: "left" }}>
              {Object.values(MODULE_REGISTRY).filter((m) => !m.alwaysVisible).map((mod) => (
                <ModuleToggle
                  key={mod.id}
                  module={mod}
                  enabled={enabledModules.includes(mod.id)}
                  onToggle={(on) => toggleModule(mod.id)}
                />
              ))}
            </div>
            <div className="py-onboarding__actions">
              <PillButton variant="primary" size="lg" onClick={handleNext}>
                Continue
              </PillButton>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 style={{ fontSize: "var(--py-text-title)", fontWeight: 600, color: "var(--py-ink)", marginBottom: "var(--py-space-2)" }}>
              When are you most capable?
            </h2>
            <p className="py-onboarding__subtitle">ProYou will suggest important tasks during your peak time.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--py-space-2)", marginTop: "var(--py-space-4)" }}>
              {PEAK_TIMES.map((pt) => (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => setPeakTime(pt.id)}
                  className={`py-pill-btn ${peakTime === pt.id ? "py-pill-btn--primary" : "py-pill-btn--secondary"}`}
                  style={{ justifyContent: "flex-start", width: "100%", fontSize: "var(--py-text-body)" }}
                >
                  <span style={{ fontWeight: 600 }}>{pt.label}</span>
                  {pt.time && <span style={{ opacity: 0.6, marginLeft: 8 }}>{pt.time}</span>}
                </button>
              ))}
            </div>
            <div className="py-onboarding__actions">
              <PillButton variant="primary" size="lg" onClick={handleNext}>
                Continue
              </PillButton>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h2 style={{ fontSize: "var(--py-text-title)", fontWeight: 600, color: "var(--py-ink)", marginBottom: "var(--py-space-2)" }}>
              What causes you to fall off?
            </h2>
            <p className="py-onboarding__subtitle">Select what applies. ProYou will watch for these patterns.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--py-space-2)", justifyContent: "center", marginTop: "var(--py-space-4)" }}>
              {FALLOFF_REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleFalloff(r.id)}
                  className={`py-pill-btn ${falloffReasons.includes(r.id) ? "py-pill-btn--primary" : "py-pill-btn--secondary"}`}
                  style={{ fontSize: "var(--py-text-subhead)" }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="py-onboarding__actions">
              <PillButton variant="primary" size="lg" onClick={handleNext}>
                Continue
              </PillButton>
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <h2 style={{ fontSize: "var(--py-text-title)", fontWeight: 600, color: "var(--py-ink)", marginBottom: "var(--py-space-2)" }}>
              How should ProYou coach you?
            </h2>
            <p className="py-onboarding__subtitle">Choose the tone that resonates with you.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--py-space-3)", marginTop: "var(--py-space-4)" }}>
              {COACHING_TONES.map((tone) => (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => setCoachingTone(tone.id)}
                  className={`py-pill-btn ${coachingTone === tone.id ? "py-pill-btn--primary" : "py-pill-btn--secondary"}`}
                  style={{ justifyContent: "flex-start", width: "100%", flexDirection: "column", alignItems: "flex-start", padding: "var(--py-space-4) var(--py-space-5)" }}
                >
                  <span style={{ fontWeight: 600, fontSize: "var(--py-text-body)" }}>{tone.label}</span>
                  <span style={{ opacity: 0.7, fontSize: "var(--py-text-caption)" }}>{tone.description}</span>
                </button>
              ))}
            </div>
            <div className="py-onboarding__actions">
              <PillButton variant="primary" size="lg" onClick={finish}>
                Start using ProYou
              </PillButton>
            </div>
          </>
        )}

        {/* Progress dots */}
        {step > 0 && (
          <div className="py-onboarding__progress">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div key={i} className={`py-onboarding__dot ${i === step ? "py-onboarding__dot--active" : ""}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

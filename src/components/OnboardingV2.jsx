import React, { useState } from "react";
import { PillButton } from "./PillButton";
import { ModuleToggle } from "./ModuleToggle";
import { THEMES } from "../themes";
import { ICON_STYLE_OPTIONS, ICON_STYLE_SIMPLE, iconStyleForTheme, normalizeIconStyle } from "../iconStyle";
import { dockNavAssetUrl } from "../dockNavAssets";
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
  { id: "morning", label: "Morning", time: "6am to 12pm" },
  { id: "afternoon", label: "Afternoon", time: "12pm to 5pm" },
  { id: "evening", label: "Evening", time: "5pm to 10pm" },
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

const TOTAL_STEPS = 8;
const LAST_STEP = TOTAL_STEPS - 1;

const ONBOARDING_THEME_PREVIEW = {
  todayicondm: "todayicondm.png",
  goalsicondm: "goalsicondm.png",
};

export function OnboardingV2({ onComplete, profile, theme, setTheme }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.name || profile?.userName || "");
  const [useCases, setUseCases] = useState([]);
  const [enabledModules, setEnabledModules] = useState([...DEFAULT_ENABLED_MODULES]);
  const [peakTime, setPeakTime] = useState("");
  const [falloffReasons, setFalloffReasons] = useState([]);
  const [coachingTone, setCoachingTone] = useState("gentle");
  const [onboardingTheme, setOnboardingTheme] = useState(() => theme || THEMES["Classic Pink"]);
  const [iconStyle, setIconStyle] = useState(() => normalizeIconStyle(profile?.iconStyle));

  function toggleUseCase(id) {
    setUseCases((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleModule(id) {
    setEnabledModules((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleFalloff(id) {
    setFalloffReasons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function finish(startTour = null) {
    const navOrder = DEFAULT_NAV_ORDER.filter((id) => enabledModules.includes(id));
    onComplete({
      name,
      useCases,
      enabledModules,
      navOrder,
      peakTime,
      falloffReasons,
      coachingTone,
      theme: onboardingTheme,
      iconStyle,
      startTour,
    });
  }

  function handleNext() {
    if (step >= LAST_STEP) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  }

  function handleBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  function handleSkip() {
    finish();
  }

  const appearanceDark =
    onboardingTheme?.name === "Midnight" || onboardingTheme?.name === "Mocha";

  return (
    <div className="py-onboarding" role="dialog" aria-modal="true" aria-label="Set up ProYou">
      {step > 0 && (
        <div className="py-onboarding__nav">
          <button
            type="button"
            className="py-onboarding__navbtn"
            onClick={handleBack}
            aria-label="Go back"
          >
            <span aria-hidden="true">‹</span> Back
          </button>
          <span className="py-onboarding__stepcount">{`Step ${step} of ${LAST_STEP}`}</span>
          <button
            type="button"
            className="py-onboarding__navbtn py-onboarding__navbtn--muted"
            onClick={handleSkip}
          >
            Skip
          </button>
        </div>
      )}
      <div className="py-onboarding__card" key={step}>
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
              What&apos;s your name?
            </h2>
            <p className="py-onboarding__subtitle">So ProYou can greet you personally.</p>
            <input
              className="py-input"
              placeholder="Your first name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNext();
              }}
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
              Colors &amp; icons
            </h2>
            <p className="py-onboarding__subtitle">Pick your palette and how navigation icons should look.</p>
            <p className="py-onboarding__subtitle" style={{ marginTop: "var(--py-space-3)", fontWeight: 600 }}>
              Theme
            </p>
            <div className="onboarding-theme-picker">
              {Object.entries(THEMES).map(([key, themeData]) => {
                const swatchInk = themeData.name === "Midnight" || themeData.name === "Mocha" ? "#fafafa" : "#333";
                const selected = onboardingTheme?.name === themeData.name;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`theme-option onboarding-theme-option ${selected ? "selected" : ""}`}
                    onClick={() => {
                      setOnboardingTheme(themeData);
                      if (setTheme) setTheme(themeData);
                      setIconStyle(iconStyleForTheme(themeData));
                    }}
                    style={{
                      background: themeData.gradient,
                      border: selected ? `3px solid ${swatchInk}` : "2px solid transparent",
                    }}
                    title={themeData.name}
                    aria-label={themeData.name}
                    aria-pressed={selected}
                  />
                );
              })}
            </div>
            <p className="py-onboarding__subtitle" style={{ marginTop: "var(--py-space-4)", fontWeight: 600 }}>
              Icons
            </p>
            <div className="onboarding-icon-style-picker">
              {ICON_STYLE_OPTIONS.map((opt) => {
                const selected = iconStyle === opt.id;
                const previewImg =
                  opt.id === ICON_STYLE_SIMPLE
                    ? ONBOARDING_THEME_PREVIEW.todayicondm
                    : "homeicon.png";
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`onboarding-icon-style-option ${selected ? "onboarding-icon-style-option--selected" : ""}`}
                    onClick={() => setIconStyle(opt.id)}
                    aria-pressed={selected}
                  >
                    <span
                      className={`onboarding-icon-style-option__preview ${
                        opt.id === ICON_STYLE_SIMPLE
                          ? appearanceDark
                            ? "onboarding-icon-style-option__preview--dark"
                            : "onboarding-icon-style-option__preview--theme"
                          : ""
                      }`}
                    >
                      <img src={dockNavAssetUrl(previewImg)} alt="" draggable={false} />
                    </span>
                    <span className="onboarding-icon-style-option__label">{opt.label}</span>
                    <span className="onboarding-icon-style-option__desc">{opt.description}</span>
                  </button>
                );
              })}
            </div>
            <div className="py-onboarding__actions">
              <PillButton variant="primary" size="lg" onClick={handleNext}>
                Continue
              </PillButton>
            </div>
          </>
        )}

        {step === 7 && (
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
              <PillButton variant="primary" size="lg" onClick={() => finish("quick")}>
                Take a quick tour
              </PillButton>
              <PillButton variant="ghost" onClick={() => finish(null)}>
                Skip tour, start using ProYou
              </PillButton>
            </div>
            <p className="py-onboarding__finehint">
              You can replay the tour anytime from Settings.
            </p>
          </>
        )}

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

/** Personal intake fields (onboarding + Settings). */

export const INTAKE_GENDER_OPTIONS = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "other", label: "Other" },
  { id: "prefer_not_to_say", label: "Prefer not to say" },
];

export const ONBOARDING_USE_CASES = [
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
  { id: "cycle", label: "Cycle / period tracking" },
];

export const PEAK_TIME_OPTIONS = [
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
  { id: "varies", label: "It varies" },
];

export const FALLOFF_REASON_OPTIONS = [
  { id: "overwhelm", label: "Feeling overwhelmed" },
  { id: "boredom", label: "Getting bored" },
  { id: "perfectionism", label: "Perfectionism paralysis" },
  { id: "fatigue", label: "Physical fatigue" },
  { id: "distraction", label: "Distractions" },
  { id: "emotional", label: "Emotional dip" },
  { id: "schedule_shift", label: "Schedule disruption" },
];

export function normalizeIntakeGender(value) {
  const v = String(value || "").trim();
  return INTAKE_GENDER_OPTIONS.some((o) => o.id === v) ? v : "";
}

export function canOfferPeriodTracker(gender) {
  return normalizeIntakeGender(gender) !== "male";
}

export function defaultPeriodTrackerEnabled(_gender) {
  return false;
}

export function normalizeStringArray(raw, allowedIds) {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(allowedIds);
  return [...new Set(raw.map((x) => String(x).trim()).filter((id) => allowed.has(id)))];
}

export function normalizePeakTime(value) {
  const v = String(value || "").trim();
  return PEAK_TIME_OPTIONS.some((o) => o.id === v) ? v : "";
}

/** Merge intake fields onto profile load/save. */
export function normalizeIntakeProfile(p = {}) {
  const gender = normalizeIntakeGender(p.intakeGender);
  const canPeriod = canOfferPeriodTracker(gender);
  const useCases = normalizeStringArray(
    p.onboardingUseCases,
    ONBOARDING_USE_CASES.map((o) => o.id),
  );
  let periodTrackerEnabled;
  if (!canPeriod) {
    periodTrackerEnabled = false;
  } else if (useCases.includes("cycle")) {
    periodTrackerEnabled = true;
  } else if (typeof p.periodTrackerEnabled === "boolean") {
    periodTrackerEnabled = p.periodTrackerEnabled;
  } else {
    periodTrackerEnabled = defaultPeriodTrackerEnabled(gender);
  }

  return {
    intakeGender: gender,
    periodTrackerEnabled,
    testPilot: p.testPilot === true,
    onboardingUseCases: useCases,
    peakTime: normalizePeakTime(p.peakTime),
    falloffReasons: normalizeStringArray(
      p.falloffReasons,
      FALLOFF_REASON_OPTIONS.map((o) => o.id),
    ),
  };
}

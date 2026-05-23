/**
 * Medications module: data model, storage, and logic.
 * Safety: This is not medical advice. Always confirm medication instructions with a clinician.
 */

const MEDICATIONS_STORAGE_KEY = "cute_schedule_medications_v1";

export function defaultMedicationsState() {
  return {
    medications: [],
    log: {},
  };
}

export function loadMedicationsFromDisk() {
  try {
    const raw = localStorage.getItem(MEDICATIONS_STORAGE_KEY);
    if (!raw) return defaultMedicationsState();
    const parsed = JSON.parse(raw);
    return {
      medications: Array.isArray(parsed.medications) ? parsed.medications.map(normalizeMedication) : [],
      log: parsed.log && typeof parsed.log === "object" ? parsed.log : {},
    };
  } catch {
    return defaultMedicationsState();
  }
}

export function saveMedicationsToDisk(state) {
  try {
    localStorage.setItem(MEDICATIONS_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function normalizeMedication(med) {
  if (!med || typeof med !== "object") return null;
  return {
    id: med.id || generateId(),
    name: typeof med.name === "string" ? med.name.trim() : "",
    dose: typeof med.dose === "string" ? med.dose.trim() : "",
    schedule: Array.isArray(med.schedule) ? med.schedule : ["morning"],
    notes: typeof med.notes === "string" ? med.notes : "",
    refillDate: med.refillDate || null,
    createdAt: med.createdAt || Date.now(),
    archived: !!med.archived,
  };
}

export function getMedicationsDueNow(medications, timeOfDay) {
  return medications.filter(
    (med) => !med.archived && med.schedule.includes(timeOfDay)
  );
}

export function logMedicationAction(log, medId, dayKey, action) {
  const key = `${dayKey}:${medId}`;
  return {
    ...log,
    [key]: {
      action, // "taken" | "skipped" | "snoozed"
      timestamp: Date.now(),
    },
  };
}

export function getMedicationStatus(log, medId, dayKey) {
  const key = `${dayKey}:${medId}`;
  return log[key] || null;
}

export function getMissedMedications(medications, log, dayKey) {
  return medications.filter((med) => {
    if (med.archived) return false;
    const status = getMedicationStatus(log, med.id, dayKey);
    return !status;
  });
}

export function getMedicationAdherence(medications, log, days = 7) {
  if (medications.length === 0) return null;
  const today = new Date();
  let total = 0;
  let taken = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    for (const med of medications) {
      if (med.archived) continue;
      total += med.schedule.length;
      const status = getMedicationStatus(log, med.id, key);
      if (status?.action === "taken") taken += med.schedule.length;
    }
  }
  return total > 0 ? Math.round((taken / total) * 100) : null;
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

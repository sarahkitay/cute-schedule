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

const SCHEDULE_DEFAULT_REMINDER_TIMES = {
  morning: "08:00",
  afternoon: "13:00",
  evening: "18:00",
  bedtime: "21:00",
};

export function normalizeMedTimeKey(t) {
  if (!t || typeof t !== "string") return "";
  const m = t.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function defaultReminderTimesFromSchedule(schedule) {
  const times = (Array.isArray(schedule) ? schedule : [])
    .map((slot) => SCHEDULE_DEFAULT_REMINDER_TIMES[slot])
    .filter(Boolean);
  return [...new Set(times)].sort();
}

export function formatMedReminderTimes(times) {
  const list = (times || []).map(normalizeMedTimeKey).filter(Boolean);
  if (!list.length) return "";
  return list
    .map((hm) => {
      const [h, m] = hm.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    })
    .join(", ");
}

export function normalizeMedication(med) {
  if (!med || typeof med !== "object") return null;
  const schedule = Array.isArray(med.schedule) && med.schedule.length ? med.schedule : ["morning"];
  let reminderTimes = Array.isArray(med.reminderTimes)
    ? [...new Set(med.reminderTimes.map(normalizeMedTimeKey).filter(Boolean))].sort()
    : [];
  const reminderEnabled = med.reminderEnabled === true;
  if (reminderEnabled && reminderTimes.length === 0) {
    reminderTimes = defaultReminderTimesFromSchedule(schedule);
  }
  return {
    id: med.id || generateId(),
    name: typeof med.name === "string" ? med.name.trim() : "",
    dose: typeof med.dose === "string" ? med.dose.trim() : "",
    schedule,
    notes: typeof med.notes === "string" ? med.notes : "",
    refillDate: med.refillDate || null,
    createdAt: med.createdAt || Date.now(),
    archived: !!med.archived,
    reminderEnabled,
    reminderTimes,
  };
}

function addDaysKey(dayKeyStr, deltaDays) {
  const d = new Date(`${dayKeyStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dayKeyStr;
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Server / background push rows for per-med daily reminder times. */
export function buildMedicationPushReminderEntries(medications, dayKeyToday, nowMs, maxAtMs) {
  const out = [];
  if (!Array.isArray(medications)) return out;
  for (const raw of medications) {
    const med = normalizeMedication(raw);
    if (!med || med.archived || !med.reminderEnabled) continue;
    const times = med.reminderTimes.length ? med.reminderTimes : defaultReminderTimesFromSchedule(med.schedule);
    if (!times.length) continue;
    const dosePart = med.dose ? ` (${med.dose})` : "";
    for (const hm of times) {
      for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
        const dayKey = dayOffset === 0 ? dayKeyToday : addDaysKey(dayKeyToday, 1);
        const atDate = new Date(`${dayKey}T${hm}:00`);
        const t = atDate.getTime();
        if (!Number.isFinite(t) || t < nowMs || t > maxAtMs) continue;
        out.push({
          at: atDate.toISOString(),
          title: "Medication reminder",
          body: `Time to take ${med.name}${dosePart}`,
          tag: `med-${med.id}-${dayKey}-${hm}`,
        });
      }
    }
  }
  return out;
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

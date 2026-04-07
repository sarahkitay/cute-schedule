import { getDb, initFirebase, getScheduleDocId } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const FIRESTORE_COLLECTION = "schedules";

/** Plain JSON clone; omits undefined (Firestore does not allow undefined). */
function cloneForFirestore(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object") return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

/**
 * Encode `hours` map keys (e.g. "09:00") for Firestore - some SDK/console paths mishandle ":" in map keys.
 * Round-trip: decode on read. Plain keys without "%" pass through decodeURIComponent unchanged.
 */
function encodeHoursMapKeys(hours) {
  if (!hours || typeof hours !== "object") return hours;
  const out = {};
  for (const [k, v] of Object.entries(hours)) {
    out[encodeURIComponent(k)] = v;
  }
  return out;
}

function decodeHoursMapKeys(hours) {
  if (!hours || typeof hours !== "object") return hours;
  const out = {};
  for (const [k, v] of Object.entries(hours)) {
    try {
      out[decodeURIComponent(k)] = v;
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function encodeAppStateHourKeys(appState) {
  const a = cloneForFirestore(appState);
  if (!a?.days || typeof a.days !== "object") return a;
  const days = { ...a.days };
  for (const dk of Object.keys(days)) {
    const day = days[dk];
    if (!day?.hours || typeof day.hours !== "object") continue;
    days[dk] = { ...day, hours: encodeHoursMapKeys(day.hours) };
  }
  return { ...a, days };
}

function decodeAppStateHourKeys(appState) {
  const a = cloneForFirestore(appState);
  if (!a?.days || typeof a.days !== "object") return a;
  const days = { ...a.days };
  for (const dk of Object.keys(days)) {
    const day = days[dk];
    if (!day?.hours || typeof day.hours !== "object") continue;
    days[dk] = { ...day, hours: decodeHoursMapKeys(day.hours) };
  }
  return { ...a, days };
}

class CloudStorage {
  constructor() {
    this.storageKey = "cute-schedule-data";
    this.syncKey = "cute-schedule-sync";
    this._loadFullStateOncePromise = null;
  }

  /** One shared in-flight load per tab (React StrictMode double-mount would otherwise run two loads and race setState). */
  loadFullStateOnce() {
    if (!this._loadFullStateOncePromise) {
      this._loadFullStateOncePromise = this.loadFullState();
    }
    return this._loadFullStateOncePromise;
  }

  /** Call when Firebase auth uid changes so the next load hits the correct document. */
  invalidateLoadCache() {
    this._loadFullStateOncePromise = null;
  }

  /** Save full app state to Firestore (and keep localStorage as fallback). */
  async saveFullState(payload) {
    const { appState, notes, finance, profile, theme, routineTemplate, morningRoutineTemplate, routineSchedule, coachMeta, coachUserProfile, moodboard, customCategories, patterns, habitTracker } = payload;
    const appStateEncoded = appState != null ? encodeAppStateHourKeys(appState) : null;
    const dataToSave = {
      appState: appStateEncoded,
      notes: cloneForFirestore(notes) ?? [],
      finance: cloneForFirestore(finance) ?? null,
      profile: cloneForFirestore(profile) ?? null,
      theme: cloneForFirestore(theme) ?? null,
      routineTemplate: cloneForFirestore(routineTemplate) ?? null,
      morningRoutineTemplate: cloneForFirestore(morningRoutineTemplate) ?? null,
      routineSchedule: cloneForFirestore(routineSchedule) ?? null,
      coachMeta: cloneForFirestore(coachMeta) ?? null,
      coachUserProfile: cloneForFirestore(coachUserProfile) ?? null,
      moodboard: cloneForFirestore(moodboard) ?? null,
      customCategories: cloneForFirestore(customCategories) ?? null,
      patterns: cloneForFirestore(patterns) ?? null,
      habitTracker: cloneForFirestore(habitTracker) ?? null,
      updatedAt: new Date().toISOString(),
      version: "1.0",
    };

    try {
      const firebaseDb = getDb();
      if (firebaseDb) {
        const docId = getScheduleDocId();
        const ref = doc(firebaseDb, FIRESTORE_COLLECTION, docId);
        // Full replace - merge:true deep-merges nested maps and can leave stale/empty `hours` vs real tasks.
        await setDoc(ref, dataToSave);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(this.syncKey, Date.now().toString());
        }
        return { success: true, source: "firestore" };
      }
    } catch (error) {
      console.error("Firestore save failed:", error?.code ?? error);
      if (error?.code === "permission-denied") {
        console.error(
          "Firestore: permission denied - in Firebase Console → Firestore → Rules, allow read/write on schedules/{id} for this app."
        );
      }
    }
    return { success: true, source: "localOnly" };
  }

  /** Load full app state from Firestore. Returns null if not configured or offline. */
  async loadFullState() {
    try {
      initFirebase();
      const firebaseDb = getDb();
      if (!firebaseDb) return null;

      const docId = getScheduleDocId();
      const ref = doc(firebaseDb, FIRESTORE_COLLECTION, docId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;

      const data = snap.data();
      const rawApp = data.appState ?? null;
      return {
        appState: rawApp != null ? decodeAppStateHourKeys(rawApp) : null,
        notes: data.notes ?? [],
        finance: data.finance ?? null,
        profile: data.profile ?? null,
        theme: data.theme ?? null,
        routineTemplate: data.routineTemplate ?? null,
        morningRoutineTemplate: data.morningRoutineTemplate ?? null,
        routineSchedule: data.routineSchedule ?? null,
        coachMeta: data.coachMeta ?? null,
        coachUserProfile: data.coachUserProfile ?? null,
        moodboard: data.moodboard ?? null,
        customCategories: data.customCategories ?? null,
        patterns: data.patterns ?? null,
        habitTracker: data.habitTracker ?? null,
        updatedAt: data.updatedAt ?? null,
      };
    } catch (error) {
      console.warn("Firestore load failed:", error);
      return null;
    }
  }

  // Legacy: save(data) / load() for backward compatibility (e.g. categories-only)
  async save(data) {
    try {
      const dataToSave = {
        categories: data,
        timestamp: new Date().toISOString(),
        version: "1.0",
      };
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this.storageKey, JSON.stringify(dataToSave));
        localStorage.setItem(this.syncKey, Date.now().toString());
      }
      const firebaseDb = getDb();
      if (firebaseDb) {
        const docId = getScheduleDocId();
        const ref = doc(firebaseDb, FIRESTORE_COLLECTION, docId);
        await setDoc(ref, { categories: data, updatedAt: new Date().toISOString() }, { merge: true });
      }
      return { success: true };
    } catch (error) {
      console.error("Error saving to cloud:", error);
      try {
        if (typeof localStorage !== "undefined") localStorage.setItem(this.storageKey, JSON.stringify(data));
        return { success: true, fallback: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  }

  async load() {
    try {
      const full = await this.loadFullState();
      if (full && full.appState) return full;
      if (typeof localStorage !== "undefined") {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
          if (parsed.categories) return parsed.categories;
        }
      }
      return null;
    } catch (error) {
      console.error("Error loading from cloud:", error);
      return null;
    }
  }

  getLastSync() {
    try {
      if (typeof localStorage === "undefined") return null;
      const syncTime = localStorage.getItem(this.syncKey);
      return syncTime ? new Date(parseInt(syncTime, 10)) : null;
    } catch {
      return null;
    }
  }

  needsSync() {
    const lastSync = this.getLastSync();
    if (!lastSync) return true;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastSync < fiveMinutesAgo;
  }

  initialize(userId, cloudService = null) {
    this.userId = userId;
    this.cloudService = cloudService;
  }
}

const cloudStorage = new CloudStorage();
if (typeof window !== "undefined") {
  window.cloudStorage = cloudStorage;
}

export default cloudStorage;

import { getDb, initFirebase, getDeviceId } from "./firebase";
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

class CloudStorage {
  constructor() {
    this.storageKey = "cute-schedule-data";
    this.syncKey = "cute-schedule-sync";
  }

  /** Save full app state to Firestore (and keep localStorage as fallback). */
  async saveFullState(payload) {
    const { appState, notes, finance, profile, theme, routineTemplate, morningRoutineTemplate, routineSchedule, coachMeta, coachUserProfile, moodboard, customCategories, patterns } = payload;
    const dataToSave = {
      appState: cloneForFirestore(appState) ?? null,
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
      updatedAt: new Date().toISOString(),
      version: "1.0",
    };

    try {
      const firebaseDb = getDb();
      if (firebaseDb) {
        const deviceId = getDeviceId();
        const ref = doc(firebaseDb, FIRESTORE_COLLECTION, deviceId);
        // Full replace — merge:true deep-merges nested maps and can leave stale/empty `hours` vs real tasks.
        await setDoc(ref, dataToSave);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(this.syncKey, Date.now().toString());
        }
        return { success: true, source: "firestore" };
      }
    } catch (error) {
      console.warn("Firestore save failed:", error);
    }
    return { success: true, source: "localOnly" };
  }

  /** Load full app state from Firestore. Returns null if not configured or offline. */
  async loadFullState() {
    try {
      initFirebase();
      const firebaseDb = getDb();
      if (!firebaseDb) return null;

      const deviceId = getDeviceId();
      const ref = doc(firebaseDb, FIRESTORE_COLLECTION, deviceId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;

      const data = snap.data();
      return {
        appState: data.appState ?? null,
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
        const deviceId = getDeviceId();
        const ref = doc(firebaseDb, FIRESTORE_COLLECTION, deviceId);
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

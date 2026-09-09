import { getDb, initFirebase, getScheduleDocId } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  cloneForFirestore,
  encodeAppStateHourKeys,
  decodeAppStateHourKeys,
} from "./cloudStateCodec.js";
import { healthProgramCount, preferRicherHealth } from "./cloudPersist.js";

const FIRESTORE_COLLECTION = "schedules";

class CloudStorage {
  constructor() {
    this.storageKey = "cute-schedule-data";
    this.syncKey = "cute-schedule-sync";
    this._loadFullStateOncePromise = null;
    /** Last cloud health we loaded (used so empty local saves cannot wipe My programs). */
    this._lastCloudHealth = null;
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
    this._lastCloudHealth = null;
  }

  rememberCloudHealth(health) {
    if (health && typeof health === "object") {
      this._lastCloudHealth = cloneForFirestore(health);
    }
  }

  /**
   * Never write fewer workout programs than cloud already has (empty boot races wiped My programs).
   */
  protectHealthAgainstThinOverwrite(outgoingHealth) {
    let health = cloneForFirestore(outgoingHealth) ?? null;
    const known = this._lastCloudHealth;
    if (!known) return health;
    const outN = healthProgramCount(health);
    const cloudN = healthProgramCount(known);
    if (cloudN > outN) {
      health = cloneForFirestore(preferRicherHealth(health, known));
    }
    return health;
  }

  /** Save full app state to Firestore (and keep localStorage as fallback). */
  async saveFullState(payload) {
    const { appState, notes, finance, profile, health, theme, routineTemplate, morningRoutineTemplate, routineSchedule, coachMeta, coachUserProfile, moodboard, customCategories, patterns, habitTracker } = payload;
    const appStateEncoded = appState != null ? encodeAppStateHourKeys(appState) : null;
    let healthSafe = this.protectHealthAgainstThinOverwrite(health);

    try {
      const firebaseDb = getDb();
      if (firebaseDb) {
        const docId = getScheduleDocId();
        const ref = doc(firebaseDb, FIRESTORE_COLLECTION, docId);
        try {
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const existingHealth = snap.data()?.health;
            if (existingHealth && typeof existingHealth === "object") {
              this.rememberCloudHealth(existingHealth);
              const outN = healthProgramCount(healthSafe);
              const cloudN = healthProgramCount(existingHealth);
              if (cloudN > outN) {
                healthSafe = cloneForFirestore(preferRicherHealth(healthSafe, existingHealth));
              }
            }
          }
        } catch {
          /* best-effort guard; still attempt the write */
        }

        const dataToSave = {
          appState: appStateEncoded,
          notes: cloneForFirestore(notes) ?? [],
          finance: cloneForFirestore(finance) ?? null,
          profile: cloneForFirestore(profile) ?? null,
          health: healthSafe,
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

        // Full replace - merge:true deep-merges nested maps and can leave stale/empty `hours` vs real tasks.
        await setDoc(ref, dataToSave);
        this.rememberCloudHealth(healthSafe);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(this.syncKey, Date.now().toString());
        }
        return { success: true, source: "firestore" };
      }
    } catch (error) {
      console.error("Cloud save failed:", error?.code ?? error);
      if (error?.code === "permission-denied") {
        console.error("Cloud save permission denied.");
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
      if (data.health && typeof data.health === "object") {
        this.rememberCloudHealth(data.health);
      }
      return {
        appState: rawApp != null ? decodeAppStateHourKeys(rawApp) : null,
        notes: data.notes ?? [],
        finance: data.finance ?? null,
        profile: data.profile ?? null,
        health: data.health ?? null,
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
      console.warn("Cloud load failed:", error);
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

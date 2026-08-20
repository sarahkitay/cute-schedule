import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { APP_TRIAL_DAYS } from "./constants.js";
import { getAppTrialStartMs, getAppTrialStatus } from "./appTrial.js";

const TRIAL_WARNING_NOTIF_ID = 900_001;
const TRIAL_WARNING_DAYS_BEFORE = 2;
const TRIAL_WARNING_SCHEDULED_KEY = "proyou_app_trial_warning_scheduled_v1";

function morningOnDay(ms) {
  const d = new Date(ms);
  d.setHours(10, 0, 0, 0);
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
  }
  return d;
}

function trialWarningAtMs(startMs) {
  const endMs = startMs + APP_TRIAL_DAYS * 86400000;
  const warnMs = endMs - TRIAL_WARNING_DAYS_BEFORE * 86400000;
  return morningOnDay(warnMs).getTime();
}

async function ensureNotificationPermission() {
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === "granted") return true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === "granted";
  } catch {
    return false;
  }
}

/**
 * Schedule a local reminder 2 days before the 30-day app trial ends.
 * Data on device is never deleted when the trial ends.
 */
export async function syncAppTrialEndingNotification() {
  const status = getAppTrialStatus();
  if (!status.active || status.startMs == null) {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: TRIAL_WARNING_NOTIF_ID }] });
      localStorage.removeItem(TRIAL_WARNING_SCHEDULED_KEY);
    } catch {
      /* ignore */
    }
    return;
  }

  const warnAt = trialWarningAtMs(status.startMs);
  if (warnAt <= Date.now()) {
    return;
  }

  let already = false;
  try {
    already = localStorage.getItem(TRIAL_WARNING_SCHEDULED_KEY) === String(warnAt);
  } catch {
    /* ignore */
  }
  if (already) return;

  if (Capacitor.isNativePlatform()) {
    const ok = await ensureNotificationPermission();
    if (!ok) return;
  }

  try {
    await LocalNotifications.cancel({ notifications: [{ id: TRIAL_WARNING_NOTIF_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: TRIAL_WARNING_NOTIF_ID,
          title: "ProYou free trial ending soon",
          body: "Your welcome access ends in 2 days. Your schedules, habits, and logs stay on this device. Subscribe anytime to unlock Pro features again.",
          schedule: { at: new Date(warnAt) },
          extra: { proyouSource: "app_trial_warning" },
        },
      ],
    });
    localStorage.setItem(TRIAL_WARNING_SCHEDULED_KEY, String(warnAt));
  } catch {
    /* ignore — web may lack notification support */
  }
}

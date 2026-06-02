const DISMISSED_KEY = "cute_schedule_alarm_dismissed_v1";

function dayKeyFromDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function loadDismissedMap() {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function isAlarmDismissedToday(alarmId) {
  const map = loadDismissedMap();
  const today = dayKeyFromDate();
  return map[today]?.[String(alarmId)] === true;
}

export function markAlarmDismissedToday(alarmId) {
  const today = dayKeyFromDate();
  const map = loadDismissedMap();
  if (!map[today]) map[today] = {};
  map[today][String(alarmId)] = true;
  const keys = Object.keys(map).sort();
  while (keys.length > 14) {
    delete map[keys.shift()];
  }
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(map));
  } catch {}
}

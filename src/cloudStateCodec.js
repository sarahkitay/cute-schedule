/** Plain JSON clone; omits undefined (Firestore does not allow undefined). */
export function cloneForFirestore(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object") return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

/**
 * Encode `hours` map keys (e.g. "09:00") for Firestore — some SDK/console paths
 * mishandle ":" in map keys. Round-trip with decodeHoursMapKeys on read.
 */
export function encodeHoursMapKeys(hours) {
  if (!hours || typeof hours !== "object") return hours;
  const out = {};
  for (const [k, v] of Object.entries(hours)) {
    out[encodeURIComponent(k)] = v;
  }
  return out;
}

export function decodeHoursMapKeys(hours) {
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

export function encodeAppStateHourKeys(appState) {
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

export function decodeAppStateHourKeys(appState) {
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

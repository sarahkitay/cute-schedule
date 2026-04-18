/** Normalize time keys to HH:mm (24h). */
export function normalizeTimeKey(raw: string): string {
  const s = String(raw || "").trim();
  const parts = s.split(":");
  if (parts.length < 2) return "09:00";
  let h = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return "09:00";
  h = Math.min(23, Math.max(0, h));
  m = Math.min(59, Math.max(0, m));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = normalizeTimeKey(hhmm).split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Add minutes to HH:mm. */
export function addMinutes(hhmm: string, delta: number): string {
  const base = toMinutes(normalizeTimeKey(hhmm));
  return fromMinutes(Math.max(0, Math.min(24 * 60 - 1, base + delta)));
}

export function taskCountInHour(
  hours: Record<string, Record<string, unknown[]>>,
  hourKey: string
): number {
  const slot = hours?.[hourKey];
  if (!slot || typeof slot !== "object") return 0;
  return Object.values(slot).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
}

/**
 * Pick an hour bucket for insertion: prefer exact normalized start if that hour exists,
 * else nearest existing hour at/after start, else latest hour before start, else start key.
 */
export function pickInsertionHourKey(
  preferredStart: string,
  todayHours: Record<string, unknown>
): string {
  const want = normalizeTimeKey(preferredStart);
  const keys = Object.keys(todayHours || {}).map(normalizeTimeKey).sort();
  if (keys.length === 0) return want;
  if (keys.includes(want)) return want;
  const wantM = toMinutes(want);
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const k of keys) {
    const km = toMinutes(k);
    if (km >= wantM) {
      const d = km - wantM;
      if (d < bestDiff) {
        bestDiff = d;
        best = k;
      }
    }
  }
  if (best) return best;
  for (const k of keys) {
    const km = toMinutes(k);
    const d = wantM - km;
    if (d >= 0 && d < bestDiff) {
      bestDiff = d;
      best = k;
    }
  }
  return best || want;
}

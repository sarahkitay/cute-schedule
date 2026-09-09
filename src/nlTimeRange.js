/**
 * Parse natural-language clock times and ranges for quick-add.
 * Examples: "10am to 5pm", "5-7pm", "10:00-17:00", "from 9am until 12:30pm"
 */

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** @returns {"am"|"pm"|null} */
function normalizeMeridiem(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase().replace(/\./g, "");
  if (s === "a" || s === "am") return "am";
  if (s === "p" || s === "pm") return "pm";
  return null;
}

/**
 * @param {number} hour12
 * @param {number} mins
 * @param {"am"|"pm"} mer
 * @returns {string|null} HH:mm
 */
export function clockPartsToTimeKey(hour12, mins, mer) {
  let h = Number(hour12);
  const m = Number(mins) || 0;
  if (!Number.isFinite(h) || h < 1 || h > 12 || m < 0 || m > 59) return null;
  if (mer === "pm" && h < 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  return `${pad2(h)}:${pad2(m)}`;
}

/**
 * @param {number} hour24
 * @param {number} mins
 * @returns {string|null}
 */
export function hour24ToTimeKey(hour24, mins) {
  const h = Number(hour24);
  const m = Number(mins) || 0;
  if (!Number.isFinite(h) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${pad2(h)}:${pad2(m)}`;
}

export function timeKeyToMinutes(timeKey) {
  const [h, m] = String(timeKey || "")
    .split(":")
    .map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Resolve a clock token that may or may not include am/pm.
 * @returns {string|null} HH:mm
 */
export function resolveClockToken({ hour, mins = 0, meridiem }, { inheritMeridiem = null, preferLaterThan = null } = {}) {
  const explicit = normalizeMeridiem(meridiem);
  if (explicit) return clockPartsToTimeKey(hour, mins, explicit);

  const inherited = normalizeMeridiem(inheritMeridiem);
  if (inherited) {
    const withInherited = clockPartsToTimeKey(hour, mins, inherited);
    if (preferLaterThan == null) return withInherited;
    const base = timeKeyToMinutes(preferLaterThan);
    if (withInherited && base != null && timeKeyToMinutes(withInherited) > base) return withInherited;
    const other = inherited === "am" ? "pm" : "am";
    const withOther = clockPartsToTimeKey(hour, mins, other);
    if (withOther && base != null && timeKeyToMinutes(withOther) > base) return withOther;
    return withInherited;
  }

  // Explicit 24h style when hour is 0 or 13–23.
  const hNum = Number(hour);
  if (hNum === 0 || (hNum >= 13 && hNum <= 23)) return hour24ToTimeKey(hNum, mins);

  if (preferLaterThan != null && hNum >= 1 && hNum <= 12) {
    const asAm = clockPartsToTimeKey(hNum, mins, "am");
    const asPm = clockPartsToTimeKey(hNum, mins, "pm");
    const base = timeKeyToMinutes(preferLaterThan);
    if (asAm && base != null && timeKeyToMinutes(asAm) > base) return asAm;
    if (asPm && base != null && timeKeyToMinutes(asPm) > base) return asPm;
  }

  return null;
}

const RANGE_RE =
  /\b(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|am|pm|a|p)?\s*(?:to|until|till|thru|through|-|–|—)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|am|pm|a|p)?\b/i;

/**
 * Pull a start–end time range out of NL text.
 * @returns {{ start: string, end: string, working: string } | null}
 */
export function extractNlTimeRange(str) {
  const raw = String(str || "");
  const m = raw.match(RANGE_RE);
  if (!m) return null;

  const startHour = parseInt(m[1], 10);
  const startMins = m[2] != null ? parseInt(m[2], 10) : 0;
  const startMer = m[3] || null;
  const endHour = parseInt(m[4], 10);
  const endMins = m[5] != null ? parseInt(m[5], 10) : 0;
  const endMer = m[6] || null;

  let start = null;
  let end = null;

  const startMerN = normalizeMeridiem(startMer);
  const endMerN = normalizeMeridiem(endMer);

  if (startMerN && endMerN) {
    start = clockPartsToTimeKey(startHour, startMins, startMerN);
    end = clockPartsToTimeKey(endHour, endMins, endMerN);
  } else if (!startMerN && endMerN) {
    // "5-7pm" / "10-5pm" → both use end meridiem first; if that makes end ≤ start, flip start.
    end = clockPartsToTimeKey(endHour, endMins, endMerN);
    start = clockPartsToTimeKey(startHour, startMins, endMerN);
    if (start && end && timeKeyToMinutes(end) <= timeKeyToMinutes(start)) {
      const flipped = endMerN === "pm" ? "am" : "pm";
      start = clockPartsToTimeKey(startHour, startMins, flipped);
    }
  } else if (startMerN && !endMerN) {
    // "10am-5" / "10am to 5" → prefer end after start (usually pm for daytime blocks)
    start = clockPartsToTimeKey(startHour, startMins, startMerN);
    end = resolveClockToken(
      { hour: endHour, mins: endMins, meridiem: null },
      { inheritMeridiem: startMerN, preferLaterThan: start }
    );
    if (!end && start) {
      const other = startMerN === "am" ? "pm" : "am";
      const candidate = clockPartsToTimeKey(endHour, endMins, other);
      if (candidate && timeKeyToMinutes(candidate) > timeKeyToMinutes(start)) end = candidate;
      else end = clockPartsToTimeKey(endHour, endMins, startMerN);
    }
  } else {
    // No meridiem: allow clear 24h forms like "10:00-17:00" or "13-17"
    const startLooks24 = startHour >= 13 || startHour === 0 || (m[2] != null && startHour >= 0);
    const endLooks24 = endHour >= 13 || endHour === 0 || (m[5] != null && endHour >= 0);
    if (
      (startHour >= 13 || endHour >= 13 || startHour === 0 || endHour === 0) &&
      startHour <= 23 &&
      endHour <= 23
    ) {
      start = hour24ToTimeKey(startHour, startMins);
      end = hour24ToTimeKey(endHour, endMins);
    } else if (m[2] != null && m[5] != null && startLooks24 && endLooks24 && startHour <= 23 && endHour <= 23) {
      // Both have :mm — treat as 24h when hours are unambiguous (0–23)
      start = hour24ToTimeKey(startHour, startMins);
      end = hour24ToTimeKey(endHour, endMins);
    } else {
      return null;
    }
  }

  if (!start || !end) return null;
  if (timeKeyToMinutes(end) <= timeKeyToMinutes(start)) return null;

  let working = raw.replace(m[0], " ").replace(/\s+/g, " ").trim();
  working = working.replace(/^\bfrom\b\s+/i, "").replace(/\s+/g, " ").trim();
  return { start, end, working };
}

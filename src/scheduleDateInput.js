/** Parse a typed date into YYYY-MM-DD, or null if it is not a calendar day. */

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function ymd(year, monthIndex, day) {
  const dt = new Date(year, monthIndex, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== monthIndex || dt.getDate() !== day) return null;
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

/**
 * @param {unknown} raw
 * @param {Date} [now]
 * @returns {string | null}
 */
export function parseFlexibleDayKey(raw, now = new Date()) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return ymd(y, m - 1, d);
  }

  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    return ymd(year, month - 1, day);
  }

  m = s.match(/^(\d{1,2})[./-](\d{1,2})$/);
  if (m) {
    return ymd(now.getFullYear(), Number(m[1]) - 1, Number(m[2]));
  }

  m = s.match(/^([a-z]+)\s+(\d{1,2})(?:,?\s*(\d{2,4}))?$/i);
  if (m) {
    const monthName = m[1].toLowerCase();
    const monthIndex = MONTH_NAMES.findIndex((n) => n.startsWith(monthName) || monthName.startsWith(n.slice(0, 3)));
    if (monthIndex < 0) return null;
    const day = Number(m[2]);
    let year = m[3] ? Number(m[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    return ymd(year, monthIndex, day);
  }

  return null;
}

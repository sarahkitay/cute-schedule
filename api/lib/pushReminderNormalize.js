/**
 * @param {unknown[]} list
 * @param {number} nowMs
 * @param {number} maxFutureMs
 */
export function normalizeReminderPayload(list, nowMs, maxFutureMs) {
  const listArr = Array.isArray(list) ? list : [];
  return listArr
    .filter((r) => r && r.at && r.title)
    .map((r) => ({
      at: r.at,
      title: String(r.title).slice(0, 200),
      body: r.body != null ? String(r.body).slice(0, 500) : "",
      tag: r.tag != null ? String(r.tag).slice(0, 100) : `rem-${nowMs}-${Math.random().toString(36).slice(2)}`,
    }))
    .filter((r) => {
      const t = new Date(r.at).getTime();
      return t >= nowMs - 5 * 60 * 1000 && t <= nowMs + maxFutureMs;
    });
}

/** @param {unknown} e */
export function logServerError(context, e) {
  console.error(context, e);
}

/**
 * In production, avoid returning exception strings or upstream payloads to clients.
 * @param {unknown} e
 */
export function clientSafeDetail(e, isProd) {
  if (isProd) return undefined;
  const s = typeof e === "string" ? e : String(e);
  return s.length > 500 ? s.slice(0, 500) + "…" : s;
}

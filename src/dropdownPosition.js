/** Viewport-safe fixed position for dropdown / ⋯ menus. */
export function computeDropdownPosition(rect, opts = {}) {
  const pad = 16;
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const vw =
    typeof window !== "undefined" ? Math.min(vv?.width ?? window.innerWidth, window.innerWidth) : 400;
  const vh =
    typeof window !== "undefined" ? Math.min(vv?.height ?? window.innerHeight, window.innerHeight) : 700;
  const maxH = opts.maxHeight ?? 280;
  const panelW = Math.min(opts.panelWidth ?? 200, vw - pad * 2);
  let left = rect.right - panelW;
  const minLeft = pad;
  const maxLeft = vw - pad - panelW;
  if (left < minLeft) {
    left = Math.min(Math.max(rect.left, minLeft), maxLeft);
  }
  if (left > maxLeft) left = maxLeft;
  left = Math.max(minLeft, Math.min(left, maxLeft));
  const leftNudge = opts.leftNudge ?? 12;
  if (left > minLeft && leftNudge > 0) left = Math.max(minLeft, left - leftNudge);
  left = Math.max(minLeft, Math.min(left, vw - pad - panelW));

  const gap = 6;
  const topBelow = rect.bottom + gap;
  let top;
  let bottom;
  if (topBelow + maxH > vh - pad) {
    bottom = vh - rect.top + gap;
  } else {
    top = Math.max(pad, Math.min(topBelow, vh - pad - 48));
  }
  return { left, top, bottom, width: panelW };
}

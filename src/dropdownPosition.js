/** Viewport-safe fixed position for dropdown / ⋯ menus. Always returns `top` (never off-screen `bottom`). */

function viewportBox() {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const offsetTop = vv?.offsetTop ?? 0;
  const offsetLeft = vv?.offsetLeft ?? 0;
  const vw = typeof window !== "undefined" ? Math.min(vv?.width ?? window.innerWidth, window.innerWidth) : 400;
  const vh = typeof window !== "undefined" ? Math.min(vv?.height ?? window.innerHeight, window.innerHeight) : 700;
  return { offsetTop, offsetLeft, vw, vh, visTop: offsetTop, visBottom: offsetTop + vh };
}

/**
 * @param {DOMRect} rect
 * @param {{ panelWidth?: number, maxHeight?: number, leftNudge?: number, pad?: number, minHeight?: number }} [opts]
 * @returns {{ left: number, top: number, width: number, maxHeight: number, placement: "below" | "above" }}
 */
export function computeDropdownPosition(rect, opts = {}) {
  const pad = opts.pad ?? 12;
  const gap = 6;
  const minH = opts.minHeight ?? 120;
  const { visTop, visBottom, vw } = viewportBox();

  const panelW = Math.min(opts.panelWidth ?? 200, Math.max(160, vw - pad * 2));
  let left = rect.right - panelW;
  const minLeft = pad;
  const maxLeft = Math.max(minLeft, vw - pad - panelW);
  if (left < minLeft) left = Math.min(Math.max(rect.left, minLeft), maxLeft);
  if (left > maxLeft) left = maxLeft;
  const leftNudge = opts.leftNudge ?? 12;
  if (left > minLeft && leftNudge > 0) left = Math.max(minLeft, left - leftNudge);
  left = Math.max(minLeft, Math.min(left, maxLeft));

  const spaceBelow = visBottom - pad - (rect.bottom + gap);
  const spaceAbove = rect.top - gap - visTop - pad;
  const wanted = opts.maxHeight ?? 280;
  const preferBelow = spaceBelow >= Math.min(180, wanted) || spaceBelow >= spaceAbove;
  const available = Math.max(minH, preferBelow ? spaceBelow : spaceAbove);
  const maxHeight = Math.max(minH, Math.min(wanted, available));

  let top;
  if (preferBelow) {
    top = rect.bottom + gap;
    if (top + maxHeight > visBottom - pad) top = visBottom - pad - maxHeight;
  } else {
    top = rect.top - gap - maxHeight;
  }
  const minTop = visTop + pad;
  const maxTop = visBottom - pad - maxHeight;
  top = Math.max(minTop, Math.min(top, Math.max(minTop, maxTop)));

  return {
    left,
    top,
    width: panelW,
    maxHeight,
    placement: preferBelow ? "below" : "above",
  };
}

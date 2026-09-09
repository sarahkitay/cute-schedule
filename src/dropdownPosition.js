/** Viewport-safe fixed position for dropdown / ⋯ menus. Always returns `top` (never off-screen `bottom`). */

function readSafeAreaInsets() {
  if (typeof document === "undefined") return { top: 0, right: 0, bottom: 0, left: 0 };
  try {
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText =
      "position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
    document.body.appendChild(el);
    const s = getComputedStyle(el);
    const insets = {
      top: parseFloat(s.paddingTop) || 0,
      right: parseFloat(s.paddingRight) || 0,
      bottom: parseFloat(s.paddingBottom) || 0,
      left: parseFloat(s.paddingLeft) || 0,
    };
    el.remove();
    return insets;
  } catch {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
}

function viewportBox() {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const offsetTop = vv?.offsetTop ?? 0;
  const offsetLeft = vv?.offsetLeft ?? 0;
  const vw = typeof window !== "undefined" ? Math.min(vv?.width ?? window.innerWidth, window.innerWidth) : 400;
  const vh = typeof window !== "undefined" ? Math.min(vv?.height ?? window.innerHeight, window.innerHeight) : 700;
  const safe = readSafeAreaInsets();
  return {
    offsetTop,
    offsetLeft,
    vw,
    vh,
    visTop: offsetTop,
    visBottom: offsetTop + vh,
    safeTop: safe.top,
    safeBottom: safe.bottom,
    safeLeft: safe.left,
    safeRight: safe.right,
  };
}

/**
 * @param {DOMRect|{left:number,right:number,top:number,bottom:number,width?:number,height?:number}} rect
 * @param {{ panelWidth?: number, maxHeight?: number, leftNudge?: number, pad?: number, minHeight?: number }} [opts]
 * @returns {{ left: number, top: number, width: number, maxHeight: number, placement: "below" | "above" | "center", useCenterModal: boolean }}
 */
export function computeDropdownPosition(rect, opts = {}) {
  const pad = opts.pad ?? 12;
  const gap = 6;
  const minH = opts.minHeight ?? 120;
  const { visTop, visBottom, vw, safeTop, safeBottom } = viewportBox();

  const topPad = pad + safeTop;
  const bottomPad = pad + safeBottom;

  const panelW = Math.min(opts.panelWidth ?? 200, Math.max(160, vw - pad * 2));
  let left = rect.right - panelW;
  const minLeft = pad;
  const maxLeft = Math.max(minLeft, vw - pad - panelW);
  if (left < minLeft) left = Math.min(Math.max(rect.left, minLeft), maxLeft);
  if (left > maxLeft) left = maxLeft;
  const leftNudge = opts.leftNudge ?? 12;
  if (left > minLeft && leftNudge > 0) left = Math.max(minLeft, left - leftNudge);
  left = Math.max(minLeft, Math.min(left, maxLeft));

  const spaceBelow = visBottom - bottomPad - (rect.bottom + gap);
  const spaceAbove = rect.top - gap - visTop - topPad;
  const wanted = opts.maxHeight ?? 280;
  const preferBelow = spaceBelow >= Math.min(180, wanted) || spaceBelow >= spaceAbove;
  const available = Math.max(0, preferBelow ? spaceBelow : spaceAbove);
  // Prefer a centered modal when the menu cannot fit without heavy clipping/shrinking.
  const useCenterModal = available < Math.min(wanted * 0.85, 360);

  if (useCenterModal) {
    const maxHeight = Math.max(minH, Math.min(wanted, visBottom - visTop - topPad - bottomPad));
    return {
      left: Math.max(minLeft, (vw - panelW) / 2),
      top: visTop + topPad + Math.max(0, (visBottom - visTop - topPad - bottomPad - maxHeight) / 2),
      width: panelW,
      maxHeight,
      placement: "center",
      useCenterModal: true,
    };
  }

  const maxHeight = Math.max(minH, Math.min(wanted, available));

  let top;
  if (preferBelow) {
    top = rect.bottom + gap;
    if (top + maxHeight > visBottom - bottomPad) top = visBottom - bottomPad - maxHeight;
  } else {
    top = rect.top - gap - maxHeight;
  }
  const minTop = visTop + topPad;
  const maxTop = visBottom - bottomPad - maxHeight;
  top = Math.max(minTop, Math.min(top, Math.max(minTop, maxTop)));

  return {
    left,
    top,
    width: panelW,
    maxHeight,
    placement: preferBelow ? "below" : "above",
    useCenterModal: false,
  };
}

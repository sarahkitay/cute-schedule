import React, { useEffect, useMemo, useState } from "react";
import {
  formatTimerDisplay,
  getActiveTimerRemaining,
  isActiveTimerPillVisible,
  normalizeActiveTimer,
} from "../modules/timers.js";

/**
 * Floating countdown above the dock on every tab while a focus timer runs.
 * When `ringing`, shows a Dismiss control until the user stops the alert.
 */
export function GlobalActiveTimerPill({
  activeTimer,
  ringing = false,
  onOpenTimers,
  onPause,
  onDismiss,
}) {
  const active = normalizeActiveTimer(activeTimer);
  const running = !!active?.running;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!running && !ringing) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running, ringing, active?.endsAt]);

  const remainingMs = useMemo(() => {
    if (!active) return 0;
    return getActiveTimerRemaining(active);
  }, [active, running, active?.endsAt, active?.remainingMs]);

  if (!ringing && !isActiveTimerPillVisible(activeTimer)) return null;

  const label = active?.linkedTask?.taskText || active?.label || "Timer";

  if (ringing) {
    return (
      <div
        className="global-active-timer-pill global-active-timer-pill--ringing"
        role="alertdialog"
        aria-labelledby="global-timer-ring-title"
      >
        <div className="global-active-timer-pill__main global-active-timer-pill__main--ringing">
          <span className="global-active-timer-pill__icon" aria-hidden>
            <img
              src={`${import.meta.env.BASE_URL}timericon.png`}
              alt=""
              className="global-active-timer-pill__icon-img global-active-timer-pill__icon-img--light"
              width={28}
              height={28}
              decoding="async"
            />
            <img
              src={`${import.meta.env.BASE_URL}timericondark.png`}
              alt=""
              className="global-active-timer-pill__icon-img global-active-timer-pill__icon-img--dark"
              width={28}
              height={28}
              decoding="async"
            />
          </span>
          <span className="global-active-timer-pill__text">
            <span id="global-timer-ring-title" className="global-active-timer-pill__time">
              Timer finished
            </span>
            <span className="global-active-timer-pill__label">{label}</span>
          </span>
        </div>
        {typeof onDismiss === "function" ? (
          <button
            type="button"
            className="global-active-timer-pill__dismiss btn btn-primary"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="global-active-timer-pill" role="status" aria-live="polite">
      <button
        type="button"
        className="global-active-timer-pill__main"
        onClick={onOpenTimers}
        aria-label={`${label}, ${formatTimerDisplay(remainingMs)} remaining. Open timers.`}
      >
        <span className="global-active-timer-pill__icon" aria-hidden>
          <img
            src={`${import.meta.env.BASE_URL}timericon.png`}
            alt=""
            className="global-active-timer-pill__icon-img global-active-timer-pill__icon-img--light"
            width={28}
            height={28}
            decoding="async"
          />
          <img
            src={`${import.meta.env.BASE_URL}timericondark.png`}
            alt=""
            className="global-active-timer-pill__icon-img global-active-timer-pill__icon-img--dark"
            width={28}
            height={28}
            decoding="async"
          />
        </span>
        <span className="global-active-timer-pill__text">
          <span className="global-active-timer-pill__time">{formatTimerDisplay(remainingMs)}</span>
          <span className="global-active-timer-pill__label">{label}</span>
        </span>
      </button>
      {running && typeof onPause === "function" ? (
        <button
          type="button"
          className="global-active-timer-pill__pause"
          onClick={onPause}
          aria-label="Pause timer"
        >
          Pause
        </button>
      ) : null}
    </div>
  );
}

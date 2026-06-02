import React, { useEffect, useMemo, useState } from "react";
import {
  formatTimerDisplay,
  getActiveTimerRemaining,
  isActiveTimerPillVisible,
  normalizeActiveTimer,
} from "../modules/timers.js";

/**
 * Floating countdown above the dock on every tab while a focus timer runs.
 */
export function GlobalActiveTimerPill({ activeTimer, onOpenTimers, onPause }) {
  const active = normalizeActiveTimer(activeTimer);
  const running = !!active?.running;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running, active?.endsAt]);

  const remainingMs = useMemo(() => {
    if (!active) return 0;
    return getActiveTimerRemaining(active);
  }, [active, running, active?.endsAt, active?.remainingMs]);

  if (!isActiveTimerPillVisible(activeTimer)) return null;

  const label = active.linkedTask?.taskText || active.label || "Timer";

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

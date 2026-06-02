import React, { useEffect, useState } from "react";
import { formatTimerDisplay } from "../taskTimerHelpers.js";

/** Countdown chip on a task row when a linked timer is running. */
export function TaskTimerBadge({ remainingMs }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (remainingMs == null || remainingMs <= 0) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [remainingMs]);

  if (remainingMs == null || remainingMs <= 0) return null;
  return (
    <span className="task-timer-badge" aria-label={`${formatTimerDisplay(remainingMs)} left`}>
      {formatTimerDisplay(remainingMs)}
    </span>
  );
}

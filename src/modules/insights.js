/**
 * Insights module: deterministic pattern detection from user data.
 * These functions derive insights from real schedule, habit, and behavior data.
 * The AI coach can phrase these outputs naturally.
 */

export function computeMomentumScore(completionHistory, days = 7) {
  if (!completionHistory || completionHistory.length < 2) return null;
  const recent = completionHistory.slice(-days);
  const total = recent.reduce((a, d) => a + (d.completed || 0), 0);
  const possible = recent.reduce((a, d) => a + (d.total || 1), 0);
  if (possible === 0) return null;
  const rate = total / possible;
  const trend = recent.length >= 3
    ? (recent[recent.length - 1]?.completed || 0) / Math.max(1, recent[recent.length - 1]?.total || 1) -
      (recent[0]?.completed || 0) / Math.max(1, recent[0]?.total || 1)
    : 0;
  return {
    score: Math.round(rate * 100),
    trend: trend > 0.1 ? "rising" : trend < -0.1 ? "falling" : "steady",
    label: rate >= 0.8 ? "Strong" : rate >= 0.5 ? "Building" : "Rebuilding",
  };
}

export function detectDrift(completionHistory, threshold = 3) {
  if (!completionHistory || completionHistory.length < threshold) return null;
  const recent = completionHistory.slice(-threshold);
  const declining = recent.every((d, i) => {
    if (i === 0) return true;
    const prev = recent[i - 1];
    const prevRate = (prev.completed || 0) / Math.max(1, prev.total || 1);
    const currRate = (d.completed || 0) / Math.max(1, d.total || 1);
    return currRate <= prevRate;
  });
  if (!declining) return null;
  const avgRate = recent.reduce((a, d) => a + (d.completed || 0) / Math.max(1, d.total || 1), 0) / recent.length;
  return {
    detected: true,
    severity: avgRate < 0.3 ? "high" : avgRate < 0.5 ? "moderate" : "mild",
    message: avgRate < 0.3
      ? "Looks like things have been tough recently. Let's find one small win."
      : "You tend to drift when capacity drops. Worth testing a lighter day tomorrow.",
  };
}

export function findPeakCompletionWindow(taskCompletions) {
  if (!taskCompletions || taskCompletions.length < 5) return null;
  const hourCounts = {};
  for (const t of taskCompletions) {
    const h = t.completedHour;
    if (typeof h !== "number") continue;
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  }
  let peakHour = null;
  let peakCount = 0;
  for (const [h, count] of Object.entries(hourCounts)) {
    if (count > peakCount) {
      peakHour = parseInt(h);
      peakCount = count;
    }
  }
  if (peakHour === null) return null;
  const period = peakHour < 12 ? "morning" : peakHour < 17 ? "afternoon" : "evening";
  const label = peakHour < 12
    ? `${peakHour}:00 AM`
    : peakHour === 12
    ? "12:00 PM"
    : `${peakHour - 12}:00 PM`;
  return { hour: peakHour, period, label, count: peakCount };
}

export function computeCompletionTrend(completionHistory, days = 14) {
  if (!completionHistory || completionHistory.length < 4) return null;
  const recent = completionHistory.slice(-days);
  const half = Math.floor(recent.length / 2);
  const first = recent.slice(0, half);
  const second = recent.slice(half);
  const avgFirst = first.reduce((a, d) => a + (d.completed || 0) / Math.max(1, d.total || 1), 0) / first.length;
  const avgSecond = second.reduce((a, d) => a + (d.completed || 0) / Math.max(1, d.total || 1), 0) / second.length;
  const diff = avgSecond - avgFirst;
  return {
    direction: diff > 0.05 ? "improving" : diff < -0.05 ? "declining" : "stable",
    magnitude: Math.abs(Math.round(diff * 100)),
    message: diff > 0.05
      ? `You're completing ${Math.round(diff * 100)}% more tasks this week.`
      : diff < -0.05
      ? `Completion has dipped ${Math.round(Math.abs(diff) * 100)}%. Based on your recent entries, lighter planning might help.`
      : "Your completion rate has been steady.",
  };
}

export function computeRoutineConsistency(routineLog, days = 14) {
  if (!routineLog || Object.keys(routineLog).length < 3) return null;
  const entries = Object.entries(routineLog).slice(-days);
  let completed = 0;
  let total = entries.length;
  for (const [, val] of entries) {
    if (val?.completed) completed++;
  }
  const rate = total > 0 ? completed / total : 0;
  return {
    rate: Math.round(rate * 100),
    label: rate >= 0.85 ? "Very consistent" : rate >= 0.6 ? "Building consistency" : "Inconsistent",
    message: rate >= 0.85
      ? "Your routines are locked in."
      : rate >= 0.6
      ? "Routines are building. Keep showing up."
      : "Routines have been inconsistent. Worth testing a shorter version.",
  };
}

export function computeCapacityPatterns(capacityLog) {
  if (!capacityLog || capacityLog.length < 5) return null;
  const dayOfWeek = [0, 0, 0, 0, 0, 0, 0];
  const dayCount = [0, 0, 0, 0, 0, 0, 0];
  for (const entry of capacityLog) {
    const dow = new Date(entry.date + "T12:00:00").getDay();
    const val = entry.capacity === "high" ? 3 : entry.capacity === "medium" ? 2 : 1;
    dayOfWeek[dow] += val;
    dayCount[dow]++;
  }
  const avgByDay = dayOfWeek.map((sum, i) => dayCount[i] > 0 ? sum / dayCount[i] : 0);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const peakDay = avgByDay.indexOf(Math.max(...avgByDay));
  const lowDay = avgByDay.indexOf(Math.min(...avgByDay.filter(v => v > 0)));
  return {
    peakDay: dayNames[peakDay],
    lowDay: dayNames[lowDay],
    message: `You tend to have the most energy on ${dayNames[peakDay]}s.`,
  };
}

export function suggestLowCapacityTask(tasks, capacity) {
  if (capacity !== "low" || !tasks || tasks.length === 0) return null;
  const light = tasks.filter(
    (t) => !t.done && (t.energy === "light" || t.energy === "low" || !t.energy)
  );
  if (light.length === 0) return null;
  const task = light[0];
  return {
    task,
    message: `On low-capacity days, starting with "${task.text}" (light energy) can help build momentum.`,
  };
}

export function detectNeglectedObjective(objectives, taskHistory) {
  if (!objectives || objectives.length === 0) return null;
  const neglected = objectives.filter((obj) => {
    if (obj.done) return false;
    const related = (taskHistory || []).filter(
      (t) => t.objectiveId === obj.id && t.completedAt
    );
    return related.length === 0;
  });
  if (neglected.length === 0) return null;
  return {
    objective: neglected[0],
    message: `"${neglected[0].text}" hasn't seen action yet. One small task could get it moving.`,
  };
}

export function computeOverduePressure(tasks) {
  if (!tasks || tasks.length === 0) return null;
  const overdue = tasks.filter((t) => t.overdue && !t.done);
  if (overdue.length === 0) return null;
  return {
    count: overdue.length,
    severity: overdue.length >= 5 ? "high" : overdue.length >= 3 ? "moderate" : "low",
    message: overdue.length >= 5
      ? `${overdue.length} overdue tasks are creating pressure. Let's reduce by completing or rescheduling two.`
      : overdue.length >= 3
      ? `You have ${overdue.length} overdue tasks. Let's move one forward.`
      : `${overdue.length} overdue. You're close to clear.`,
  };
}

export function computeStreakMomentum(streak) {
  if (!streak || streak < 1) return null;
  return {
    days: streak,
    label: streak >= 30 ? "Incredible" : streak >= 14 ? "Strong" : streak >= 7 ? "Building" : "Starting",
    message: streak >= 14
      ? `${streak} day streak. You're proving something to yourself.`
      : streak >= 7
      ? `${streak} days in a row. Keep it going.`
      : `Day ${streak}. Every day counts.`,
  };
}

export function generateWeeklyReport(data) {
  const insights = [];
  const momentum = computeMomentumScore(data.completionHistory);
  if (momentum) insights.push({ type: "momentum", ...momentum });
  const drift = detectDrift(data.completionHistory);
  if (drift?.detected) insights.push({ type: "drift", ...drift });
  const peak = findPeakCompletionWindow(data.taskCompletions);
  if (peak) insights.push({ type: "peak_time", ...peak });
  const trend = computeCompletionTrend(data.completionHistory);
  if (trend) insights.push({ type: "completion_trend", ...trend });
  const routine = computeRoutineConsistency(data.routineLog);
  if (routine) insights.push({ type: "routine", ...routine });
  const capacity = computeCapacityPatterns(data.capacityLog);
  if (capacity) insights.push({ type: "capacity", ...capacity });
  const overdue = computeOverduePressure(data.tasks);
  if (overdue) insights.push({ type: "overdue", ...overdue });
  const streak = computeStreakMomentum(data.streak);
  if (streak) insights.push({ type: "streak", ...streak });
  return insights;
}

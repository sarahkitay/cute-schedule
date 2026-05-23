import React, { useMemo } from "react";
import {
  computeMomentumScore,
  detectDrift,
  findPeakCompletionWindow,
  computeCompletionTrend,
  computeRoutineConsistency,
  computeCapacityPatterns,
  computeStreakMomentum,
  computeOverduePressure,
} from "../modules/insights";

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ padding: 18, background: "rgba(255,255,255,0.6)", backdropFilter: "blur(16px)", border: "1px solid rgba(0,0,0,0.04)", borderRadius: 22, boxShadow: "0 3px 14px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.6)" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: color || "var(--py-accent-deep)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: "var(--py-ink)", marginTop: 6, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--py-ink-tertiary)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function InsightRow({ title, text, accent }) {
  return (
    <div style={{ padding: "14px 16px", background: accent ? "rgba(255,225,235,0.4)" : "rgba(255,255,255,0.5)", border: `1px solid ${accent ? "rgba(232,169,183,0.2)" : "rgba(0,0,0,0.04)"}`, borderRadius: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.02), inset 0 1px 0 rgba(255,255,255,0.5)" }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--py-ink)", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--py-ink-secondary)", lineHeight: 1.45 }}>{text}</div>
    </div>
  );
}

export function InsightsPage({ data }) {
  const momentum = useMemo(() => computeMomentumScore(data.completionHistory), [data.completionHistory]);
  const drift = useMemo(() => detectDrift(data.completionHistory), [data.completionHistory]);
  const peak = useMemo(() => findPeakCompletionWindow(data.taskCompletions), [data.taskCompletions]);
  const trend = useMemo(() => computeCompletionTrend(data.completionHistory), [data.completionHistory]);
  const routine = useMemo(() => computeRoutineConsistency(data.routineLog), [data.routineLog]);
  const capacity = useMemo(() => computeCapacityPatterns(data.capacityLog), [data.capacityLog]);
  const streak = useMemo(() => computeStreakMomentum(data.streak), [data.streak]);
  const overdue = useMemo(() => computeOverduePressure(data.tasks), [data.tasks]);

  const totalTasks = (data.completionHistory || []).reduce((a, d) => a + (d.total || 0), 0);
  const completedTasks = (data.completionHistory || []).reduce((a, d) => a + (d.completed || 0), 0);
  const avgRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <img src={`${import.meta.env.BASE_URL}InsightsIcon.png`} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: "contain" }} />
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: "var(--py-ink)", margin: 0 }}>Insights</h2>
          <p style={{ fontSize: 13, color: "var(--py-ink-tertiary)", margin: 0 }}>Your patterns & averages</p>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <StatCard label="Completion" value={`${avgRate}%`} sub={`${completedTasks}/${totalTasks} tasks`} />
        <StatCard label="Streak" value={`${data.streak || 0}`} sub={data.streak > 0 ? "days in a row" : "Start today"} />
        {momentum && <StatCard label="Momentum" value={`${momentum.score}%`} sub={`${momentum.label} · ${momentum.trend}`} />}
        {overdue && <StatCard label="Overdue" value={overdue.count} sub={overdue.severity + " pressure"} color={overdue.severity === "high" ? "#B85555" : undefined} />}
      </div>

      {/* Pattern insights */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--py-ink)", marginBottom: 12 }}>What ProYou noticed</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {drift?.detected && <InsightRow title="Drift detected" text={drift.message} accent />}
          {peak && <InsightRow title="Peak time" text={`You complete most tasks around ${peak.label} (${peak.period}).`} />}
          {trend && <InsightRow title="Trend" text={trend.message} />}
          {routine && <InsightRow title="Routine consistency" text={routine.message} />}
          {capacity && <InsightRow title="Energy patterns" text={capacity.message} />}
          {streak && <InsightRow title="Streak momentum" text={streak.message} />}
          {!drift && !peak && !trend && !routine && !capacity && !streak && (
            <div style={{ padding: 28, textAlign: "center", background: "rgba(255,255,255,0.5)", borderRadius: 22, border: "1px solid rgba(0,0,0,0.04)" }}>
              <img src={`${import.meta.env.BASE_URL}InsightsIcon.png`} alt="" style={{ width: 48, height: 48, opacity: 0.5, margin: "0 auto 12px", display: "block", objectFit: "contain" }} />
              <p style={{ fontSize: 14, color: "var(--py-ink-secondary)", margin: 0 }}>ProYou is learning your patterns.<br />Use the app for a few days and insights will appear here.</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: 12, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "var(--py-ink-muted)", margin: 0 }}>Based on your recent activity · Updates as ProYou learns</p>
      </div>
    </div>
  );
}

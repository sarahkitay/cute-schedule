import React, { useMemo } from "react";
import { GlassCard } from "./GlassCard";
import { InsightCard } from "./InsightCard";
import { NavIcons } from "./NavIcons";
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

export function InsightsPage({ data }) {
  const momentum = useMemo(() => computeMomentumScore(data.completionHistory), [data.completionHistory]);
  const drift = useMemo(() => detectDrift(data.completionHistory), [data.completionHistory]);
  const peak = useMemo(() => findPeakCompletionWindow(data.taskCompletions), [data.taskCompletions]);
  const trend = useMemo(() => computeCompletionTrend(data.completionHistory), [data.completionHistory]);
  const routine = useMemo(() => computeRoutineConsistency(data.routineLog), [data.routineLog]);
  const capacity = useMemo(() => computeCapacityPatterns(data.capacityLog), [data.capacityLog]);
  const streak = useMemo(() => computeStreakMomentum(data.streak), [data.streak]);
  const overdue = useMemo(() => computeOverduePressure(data.tasks), [data.tasks]);

  const hasInsights = momentum || drift || peak || trend || routine || capacity || streak || overdue;

  return (
    <div className="py-flex-col py-gap-5">
      <div className="py-section-header">
        <h2 className="py-section-header__title">Insights</h2>
      </div>

      {!hasInsights && (
        <GlassCard>
          <div className="py-text-center" style={{ padding: "var(--py-space-7) 0" }}>
            <NavIcons name="insights" size={40} />
            <p style={{ marginTop: "var(--py-space-4)", color: "var(--py-ink-secondary)", fontSize: "var(--py-text-body)" }}>
              ProYou is learning your patterns.<br />
              Use the app for a few days and insights will appear here.
            </p>
          </div>
        </GlassCard>
      )}

      {momentum && (
        <GlassCard featured={momentum.score >= 80}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "var(--py-text-caption)", fontWeight: 600, color: "var(--py-accent-deep)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Momentum
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "var(--py-ink)", marginTop: 4 }}>
                {momentum.score}%
              </div>
              <div style={{ fontSize: "var(--py-text-caption)", color: "var(--py-ink-tertiary)", marginTop: 2 }}>
                {momentum.label} · {momentum.trend}
              </div>
            </div>
            <div style={{ fontSize: 40, opacity: 0.8 }}>
              {momentum.score >= 80 ? "🔥" : momentum.score >= 50 ? "📈" : "🌱"}
            </div>
          </div>
        </GlassCard>
      )}

      {streak && (
        <GlassCard>
          <div className="py-streak">
            <div className="py-streak__flame">🔥</div>
            <div>
              <div className="py-streak__count">{streak.days}</div>
              <div className="py-streak__label">{streak.label} streak</div>
            </div>
          </div>
          <p style={{ fontSize: "var(--py-text-caption)", color: "var(--py-ink-secondary)", margin: "var(--py-space-2) 0 0 var(--py-space-4)" }}>
            {streak.message}
          </p>
        </GlassCard>
      )}

      {drift?.detected && (
        <InsightCard
          icon="insights"
          title="Drift detected"
          text={drift.message}
          accent
        />
      )}

      {peak && (
        <InsightCard
          icon="timer"
          title="Peak completion time"
          text={`You complete most tasks around ${peak.label} (${peak.period}). Based on your recent entries, scheduling important work here might help.`}
        />
      )}

      {trend && (
        <InsightCard
          icon={trend.direction === "improving" ? "check" : "insights"}
          title="Completion trend"
          text={trend.message}
        />
      )}

      {routine && (
        <InsightCard
          icon="repeat"
          title="Routine consistency"
          text={routine.message}
        />
      )}

      {capacity && (
        <InsightCard
          icon="health"
          title="Energy patterns"
          text={capacity.message}
        />
      )}

      {overdue && (
        <InsightCard
          icon="list"
          title="Overdue pressure"
          text={overdue.message}
          accent={overdue.severity === "high"}
        />
      )}

      <GlassCard compact>
        <p style={{ fontSize: "var(--py-text-caption)", color: "var(--py-ink-muted)", textAlign: "center", margin: 0 }}>
          Insights are based on your recent activity. They update as ProYou learns your patterns.
        </p>
      </GlassCard>
    </div>
  );
}

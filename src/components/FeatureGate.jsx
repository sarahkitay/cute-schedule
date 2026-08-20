import React from "react";

/**
 * Feature wrapper. All features are free for now; keeps call sites stable.
 * @param {{ feature?: import('../subscription/features.js').FeatureId, children: React.ReactNode, fallback?: React.ReactNode, className?: string }} props
 */
export function FeatureGate({ children, className = "" }) {
  return <div className={["feature-gate-wrap", className].filter(Boolean).join(" ")}>{children}</div>;
}

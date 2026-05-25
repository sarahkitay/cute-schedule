import React from "react";
import { useSubscription } from "../subscription/SubscriptionContext.jsx";

/**
 * Soft paywall wrapper — shows children dimmed with upgrade overlay when feature unavailable.
 * @param {{ feature: import('../subscription/features.js').FeatureId, children: React.ReactNode, fallback?: React.ReactNode, className?: string }} props
 */
export function FeatureGate({ feature, children, fallback = null, className = "" }) {
  const { canUseFeature, openUpgrade } = useSubscription();
  const allowed = canUseFeature(feature);

  if (allowed) {
    return <div className={className}>{children}</div>;
  }

  if (fallback) {
    return <div className={className}>{fallback}</div>;
  }

  return (
    <div className={`pro-feature-gate ${className}`.trim()}>
      <div className="pro-feature-gate__content pro-feature-gate__content--dimmed" aria-hidden>
        {children}
      </div>
      <div className="pro-feature-gate__overlay">
        <div className="pro-feature-gate__card surface-glass">
          <p className="pro-feature-gate__badge">Pro</p>
          <p className="pro-feature-gate__title">Unlock with ProYou Pro</p>
          <p className="pro-feature-gate__body">
            {feature === "medications"
              ? "Medication tracking and reminders are included with Pro."
              : feature === "insights"
                ? "Pattern insights and analytics are included with Pro."
                : "This feature is included with ProYou Pro."}
          </p>
          <button type="button" className="btn btn-primary pro-feature-gate__cta" onClick={() => openUpgrade(feature)}>
            Try Pro free for 30 days
          </button>
        </div>
      </div>
    </div>
  );
}

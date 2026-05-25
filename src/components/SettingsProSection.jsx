import React from "react";
import { useSubscription } from "../subscription/SubscriptionContext.jsx";

/** Pro subscription card for Settings */
export function SettingsProSection() {
  const {
    isPro,
    trialActive,
    subscriptionExpired,
    promptsRemainingToday,
    openUpgrade,
    restorePurchases,
    loading,
  } = useSubscription();

  const statusLabel = loading
    ? "Checking subscription…"
    : isPro
      ? trialActive
        ? "Pro trial active"
        : subscriptionExpired
          ? "Subscription expired"
          : "Pro active"
      : Number.isFinite(promptsRemainingToday)
        ? `${promptsRemainingToday} coach prompt${promptsRemainingToday === 1 ? "" : "s"} left today`
        : "Free plan";

  return (
    <div className="settings-section pro-settings-card surface-glass">
      <p className="pro-settings-card__title">{isPro ? "ProYou Pro" : "Upgrade to Pro"}</p>
      <p className="pro-settings-card__meta">{statusLabel}</p>
      {!isPro ? (
        <>
          <p className="settings-hint" style={{ marginTop: 0, marginBottom: 10 }}>
            30-day free trial, then $4.99/month. Unlimited coach, meds, insights, cloud backup, and more.
          </p>
          <div className="settings-push-actions" style={{ flexWrap: "wrap", gap: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openUpgrade("cloud_sync")}>
              Start free trial
            </button>
            <button type="button" className="btn btn-sm" onClick={() => restorePurchases()}>
              Restore purchases
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="btn btn-sm" onClick={() => openUpgrade(null)}>
          Manage subscription
        </button>
      )}
    </div>
  );
}

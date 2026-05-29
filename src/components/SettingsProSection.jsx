import React from "react";
import { useSubscription } from "../subscription/SubscriptionContext.jsx";

/** Pro subscription card for Settings */
export function SettingsProSection() {
  const {
    isPro,
    trialActive,
    subscriptionExpired,
    promptsRemainingToday,
    appTrialActive,
    appTrialDaysLeft,
    appTrialEnded,
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
      : appTrialActive
        ? `${appTrialDaysLeft} day${appTrialDaysLeft === 1 ? "" : "s"} left: meds, fitness, insights, and alarms free`
        : appTrialEnded
          ? "30-day welcome access ended"
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
            {appTrialActive
              ? `Meds, fitness, insights, and alarms are free for your first 30 days (${appTrialDaysLeft} day${appTrialDaysLeft === 1 ? "" : "s"} left). After that, they are part of ProYou Pro at $4.99/mo after a 30-day Pro trial.`
              : appTrialEnded
                ? "Your first 30 days of meds, fitness, insights, and alarms have ended. ProYou Pro unlocks them again, plus unlimited coach and more."
                : "30-day free Pro trial, then $4.99/month. Unlimited coach, cloud backup, and more."}
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

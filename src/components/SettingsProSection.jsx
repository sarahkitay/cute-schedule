import React from "react";
import { useSubscription } from "../subscription/SubscriptionContext.jsx";
import { APP_TRIAL_DATA_RETENTION_HINT } from "../subscription/constants.js";

/** Pro subscription card for Settings */
export function SettingsProSection() {
  const {
    isPro,
    testPilotActive,
    adminActive,
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
    : testPilotActive
      ? "Test pilot: full Pro access"
      : adminActive
        ? "Admin: full Pro access"
        : isPro
      ? trialActive
        ? "Pro trial active"
        : subscriptionExpired
          ? "Subscription expired"
          : "Pro active"
      : appTrialActive
        ? `${appTrialDaysLeft} day${appTrialDaysLeft === 1 ? "" : "s"} left: unlimited coach, meds, fitness, insights, and alarms`
        : appTrialEnded
          ? "30-day welcome access ended"
          : Number.isFinite(promptsRemainingToday)
            ? `${promptsRemainingToday} coach prompt${promptsRemainingToday === 1 ? "" : "s"} left today`
            : "Free plan";

  return (
    <div className="settings-section pro-settings-card surface-glass">
      <p className="pro-settings-card__title">
        {adminActive ? "Admin" : testPilotActive ? "Test pilot" : isPro ? "ProYou Pro" : "Upgrade to Pro"}
      </p>
      <p className="pro-settings-card__meta">{statusLabel}</p>
      {adminActive ? (
        <p className="settings-hint" style={{ marginTop: 0, marginBottom: 10 }}>
          Signed in as admin with full ProYou Pro access. {APP_TRIAL_DATA_RETENTION_HINT}
        </p>
      ) : testPilotActive ? (
        <p className="settings-hint" style={{ marginTop: 0, marginBottom: 10 }}>
          You have full ProYou Pro access as a test pilot with no subscription required. {APP_TRIAL_DATA_RETENTION_HINT}
        </p>
      ) : !isPro ? (
        <>
          <p className="settings-hint" style={{ marginTop: 0, marginBottom: 10 }}>
            {appTrialActive
              ? `Unlimited coach, meds, fitness, finance, insights, and alarms are included for your first 30 days (${appTrialDaysLeft} day${appTrialDaysLeft === 1 ? "" : "s"} left). After that, subscribe to ProYou Pro ($4.99/mo) to keep them. ${APP_TRIAL_DATA_RETENTION_HINT}`
              : appTrialEnded
                ? `Your first 30 days of meds, fitness, finance, insights, and alarms have ended. ProYou Pro unlocks them again, plus unlimited coach and more. ${APP_TRIAL_DATA_RETENTION_HINT}`
                : "ProYou Pro is $4.99/month - unlimited coach, cloud backup, and more."}
          </p>
          <div className="settings-push-actions" style={{ flexWrap: "wrap", gap: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openUpgrade("cloud_sync")}>
              Subscribe now
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

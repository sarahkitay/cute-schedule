import React, { useState } from "react";
import { PRO_PRODUCT_ID } from "../subscription/constants.js";
import { useSubscription } from "../subscription/SubscriptionContext.jsx";

/**
 * Upgrade to Pro modal — 30-day trial, $4.99/mo, restore purchases.
 */
export function UpgradeProModal() {
  const {
    upgradeOpen,
    closeUpgrade,
    upgradeCopy,
    isPro,
    trialActive,
    purchasePro,
    restorePurchases,
    promptsRemainingToday,
  } = useSubscription();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!upgradeOpen) return null;

  async function run(action) {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (e) {
      const msg = e?.message || String(e);
      if (!/cancel/i.test(msg) && !/user cancelled/i.test(msg)) {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  const title = upgradeCopy?.title || "Upgrade to ProYou Pro";
  const body =
    upgradeCopy?.body ||
    "Unlock unlimited AI coaching, medication tracking, insights, cloud backup, and more.";

  return (
    <div className="pro-upgrade-backdrop" role="presentation" onClick={closeUpgrade}>
      <div
        className="pro-upgrade-modal surface-glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pro-upgrade-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="pro-upgrade-close btn-icon" aria-label="Close" onClick={closeUpgrade}>
          ×
        </button>

        <p className="pro-upgrade-eyebrow">ProYou Pro</p>
        <h2 id="pro-upgrade-title" className="pro-upgrade-title">
          {isPro ? "You're on Pro" : title}
        </h2>
        <p className="pro-upgrade-body">{isPro ? "Thanks for supporting ProYou." : body}</p>

        {!isPro ? (
          <>
            <ul className="pro-upgrade-list">
              <li>Unlimited AI Coach prompts</li>
              <li>Medication tracking &amp; reminders</li>
              <li>Insights &amp; trend analytics</li>
              <li>Cloud sync &amp; backup</li>
              <li>Advanced alarms &amp; smart reminders</li>
              <li>Unlimited routines &amp; modules</li>
            </ul>

            <div className="pro-upgrade-pricing">
              <span className="pro-upgrade-price">$4.99</span>
              <span className="pro-upgrade-period">/ month after trial</span>
            </div>
            <p className="pro-upgrade-trial">30-day free trial · Cancel anytime</p>
            <p className="pro-upgrade-product-id">{PRO_PRODUCT_ID}</p>

            {Number.isFinite(promptsRemainingToday) ? (
              <p className="pro-upgrade-free-hint">
                Free plan: {promptsRemainingToday} coach prompt{promptsRemainingToday === 1 ? "" : "s"} left today
              </p>
            ) : null}

            <button
              type="button"
              className="btn btn-primary pro-upgrade-primary"
              disabled={busy}
              onClick={() => run(purchasePro)}
            >
              {busy ? "Processing…" : "Start free trial"}
            </button>
            <button
              type="button"
              className="btn btn-ghost pro-upgrade-restore"
              disabled={busy}
              onClick={() => run(restorePurchases)}
            >
              Restore purchases
            </button>
          </>
        ) : (
          <p className="pro-upgrade-status">{trialActive ? "Trial active" : "Subscription active"}</p>
        )}

        {error ? (
          <p className="pro-upgrade-error" role="alert">
            {error}
          </p>
        ) : null}

        <p className="pro-upgrade-legal">
          Payment charged to your Apple ID. Subscription renews unless cancelled at least 24 hours before the period
          ends.
        </p>
      </div>
    </div>
  );
}

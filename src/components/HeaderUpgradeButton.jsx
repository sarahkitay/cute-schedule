import React from "react";
import { useSubscription } from "../subscription/SubscriptionContext.jsx";

/** Opens upgrade modal; shown beside Settings on Today when not Pro. */
export function HeaderUpgradeButton({ visible = true }) {
  const { isPro, testPilotActive, adminActive, openUpgrade } = useSubscription();

  if (!visible || isPro || testPilotActive || adminActive) return null;

  return (
    <button
      type="button"
      className="btn header-upgrade-btn"
      onClick={() => openUpgrade("cloud_sync")}
      aria-label="Upgrade to ProYou Pro"
    >
      Pro
    </button>
  );
}

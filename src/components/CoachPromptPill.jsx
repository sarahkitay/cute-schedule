import React from "react";
import { useSubscription } from "../subscription/SubscriptionContext.jsx";

/** Coach tab - daily prompt allowance; upgrade only when out of free prompts. */
export function CoachPromptPill() {
  const { isPro, appTrialActive, promptsRemainingToday, openUpgrade } = useSubscription();

  if (isPro) {
    return (
      <p className="pro-coach-prompts-pill" style={{ marginTop: 0 }}>
        Pro · Unlimited coach prompts
      </p>
    );
  }

  if (appTrialActive) {
    return (
      <p className="pro-coach-prompts-pill" style={{ marginTop: 0 }}>
        Free trial · Unlimited coach prompts
      </p>
    );
  }

  const remaining = Number.isFinite(promptsRemainingToday) ? promptsRemainingToday : 0;

  if (remaining <= 0) {
    return (
      <button
        type="button"
        className="pro-coach-prompts-pill pro-coach-prompts-pill--upgrade"
        style={{ marginTop: 0, cursor: "pointer", border: "none", font: "inherit" }}
        onClick={() => openUpgrade("coach_prompt")}
      >
        Daily limit reached · Upgrade for unlimited
      </button>
    );
  }

  return (
    <p className="pro-coach-prompts-pill pro-coach-prompts-pill--remaining" style={{ marginTop: 0 }}>
      {remaining} free coach prompt{remaining === 1 ? "" : "s"} left today
    </p>
  );
}

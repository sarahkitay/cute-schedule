import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FREE_COACH_PROMPTS_PER_DAY } from "./constants.js";
import {
  canUseFeature,
  coachPromptsRemaining,
  countOptionalEnabledModules,
  getFeatureGateCopy,
} from "./features.js";
import { getAppTrialStatus, initAppTrialStart } from "./appTrial.js";
import { getCoachPromptsUsedToday, consumeCoachPromptLocal } from "./promptUsage.js";
import {
  purchaseProMonthly,
  refreshSubscriptionState,
  restorePurchases,
} from "./revenueCatClient.js";
import { setSubscriptionSnapshot, subscribeSubscriptionSnapshot } from "./subscriptionStore.js";

/** @typedef {import('./features.js').FeatureId} FeatureId */

const SubscriptionContext = createContext(null);

/**
 * @param {{ children: React.ReactNode, firebaseUid?: string | null, enabledModules?: string[], routineTemplateCount?: number }} props
 */
export function SubscriptionProvider({
  children,
  firebaseUid = null,
  enabledModules = [],
  routineTemplateCount = 0,
}) {
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [trialActive, setTrialActive] = useState(false);
  const [expirationDate, setExpirationDate] = useState(/** @type {Date | null} */ (null));
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [promptsUsedToday, setPromptsUsedToday] = useState(() => getCoachPromptsUsedToday());
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState(/** @type {FeatureId | null} */ (null));
  const [appTrial, setAppTrial] = useState(() => getAppTrialStatus());

  useEffect(() => {
    initAppTrialStart();
    const refresh = () => setAppTrial(getAppTrialStatus());
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, []);

  const syncSubscription = useCallback(async () => {
    setLoading(true);
    try {
      const state = await refreshSubscriptionState(firebaseUid || undefined);
      setIsPro(state.isPro);
      setTrialActive(state.trialActive);
      setExpirationDate(state.expirationDate);
      setSubscriptionExpired(state.subscriptionExpired);
      setSubscriptionSnapshot({
        isPro: state.isPro,
        trialActive: state.trialActive,
      });
    } finally {
      setLoading(false);
    }
  }, [firebaseUid]);

  useEffect(() => {
    void syncSubscription();
  }, [syncSubscription]);

  useEffect(() => {
    setPromptsUsedToday(getCoachPromptsUsedToday());
    return subscribeSubscriptionSnapshot(() => {
      setPromptsUsedToday(getCoachPromptsUsedToday());
    });
  }, []);

  const promptsRemainingToday = coachPromptsRemaining(promptsUsedToday, isPro);

  const featureCtx = useMemo(
    () => ({
      isPro,
      appTrialActive: appTrial.active,
      appTrialDaysLeft: appTrial.daysLeft,
      appTrialEnded: appTrial.ended,
      promptsRemainingToday: isPro ? Infinity : promptsRemainingToday,
      routineTemplateCount,
      optionalModuleCount: countOptionalEnabledModules(enabledModules),
    }),
    [isPro, appTrial, promptsRemainingToday, routineTemplateCount, enabledModules]
  );

  const openUpgrade = useCallback((featureId = null) => {
    setUpgradeFeature(featureId);
    setUpgradeOpen(true);
  }, []);

  const closeUpgrade = useCallback(() => {
    setUpgradeOpen(false);
    setUpgradeFeature(null);
  }, []);

  const checkFeature = useCallback(
    (featureId) => canUseFeature(featureId, featureCtx),
    [featureCtx]
  );

  const consumeCoachPrompt = useCallback(() => {
    if (isPro) return true;
    if (promptsUsedToday >= FREE_COACH_PROMPTS_PER_DAY) return false;
    const next = consumeCoachPromptLocal();
    setPromptsUsedToday(next);
    return true;
  }, [isPro, promptsUsedToday]);

  const tryCoachPrompt = useCallback(() => {
    if (isPro) return true;
    if (promptsUsedToday >= FREE_COACH_PROMPTS_PER_DAY) {
      openUpgrade("coach_prompt");
      return false;
    }
    return true;
  }, [isPro, promptsUsedToday, openUpgrade]);

  const purchasePro = useCallback(async () => {
    const state = await purchaseProMonthly();
    setIsPro(state.isPro);
    setTrialActive(state.trialActive);
    setExpirationDate(state.expirationDate);
    setSubscriptionExpired(state.subscriptionExpired);
    setSubscriptionSnapshot({ isPro: state.isPro, trialActive: state.trialActive });
    if (state.isPro) closeUpgrade();
    return state;
  }, [closeUpgrade]);

  const restore = useCallback(async () => {
    const state = await restorePurchases();
    setIsPro(state.isPro);
    setTrialActive(state.trialActive);
    setExpirationDate(state.expirationDate);
    setSubscriptionExpired(state.subscriptionExpired);
    setSubscriptionSnapshot({ isPro: state.isPro, trialActive: state.trialActive });
    if (state.isPro) closeUpgrade();
    return state;
  }, [closeUpgrade]);

  const value = useMemo(
    () => ({
      loading,
      isPro,
      trialActive,
      expirationDate,
      subscriptionExpired,
      promptsRemainingToday: isPro ? Infinity : promptsRemainingToday,
      promptsUsedToday,
      canUseFeature: checkFeature,
      consumeCoachPrompt,
      tryCoachPrompt,
      openUpgrade,
      closeUpgrade,
      upgradeOpen,
      upgradeFeature,
      upgradeCopy: upgradeFeature ? getFeatureGateCopy(upgradeFeature, featureCtx) : null,
      appTrialActive: appTrial.active,
      appTrialDaysLeft: appTrial.daysLeft,
      appTrialEnded: appTrial.ended,
      getFeatureGateCopy: (featureId) => getFeatureGateCopy(featureId, featureCtx),
      purchasePro,
      restorePurchases: restore,
      refreshSubscription: syncSubscription,
    }),
    [
      loading,
      isPro,
      trialActive,
      expirationDate,
      subscriptionExpired,
      promptsRemainingToday,
      promptsUsedToday,
      checkFeature,
      consumeCoachPrompt,
      tryCoachPrompt,
      openUpgrade,
      closeUpgrade,
      upgradeOpen,
      upgradeFeature,
      appTrial.active,
      appTrial.daysLeft,
      appTrial.ended,
      featureCtx,
      purchasePro,
      restore,
      syncSubscription,
    ]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }
  return ctx;
}

/** Safe hook for components that may render outside provider during migration */
export function useSubscriptionOptional() {
  return useContext(SubscriptionContext);
}

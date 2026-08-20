import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FREE_COACH_PROMPTS_PER_DAY } from "./constants.js";
import {
  canUseFeature,
  coachPromptsRemaining,
  countOptionalEnabledModules,
  getFeatureGateCopy,
  hasUnlimitedCoachPrompts,
} from "./features.js";
import { getAppTrialStatus, initAppTrialStart } from "./appTrial.js";
import { getCoachPromptsUsedToday, consumeCoachPromptLocal, refreshCoachPromptUsageIfDayChanged } from "./promptUsage.js";
import {
  purchaseProMonthly,
  refreshSubscriptionState,
  restorePurchases,
} from "./revenueCatClient.js";
import { setSubscriptionSnapshot, subscribeSubscriptionSnapshot } from "./subscriptionStore.js";
import { mergeSubscriptionWithReferral, getReferralProGrant } from "../social/referralEntitlement.js";
import { mergeSubscriptionWithTestPilot, isTestPilotActive } from "./testPilot.js";
import { mergeSubscriptionWithAdminAccess, isAdminEmail } from "./proAdmin.js";

/** @typedef {import('./features.js').FeatureId} FeatureId */

const SubscriptionContext = createContext(null);

/**
 * @param {{ children: React.ReactNode, firebaseUid?: string | null, firebaseEmail?: string | null, enabledModules?: string[], routineTemplateCount?: number, profile?: object }} props
 */
export function SubscriptionProvider({
  children,
  firebaseUid = null,
  firebaseEmail = null,
  enabledModules = [],
  routineTemplateCount = 0,
  profile = null,
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
  const [referralProActive, setReferralProActive] = useState(() => getReferralProGrant().active);
  const [testPilotActive, setTestPilotActive] = useState(() => isTestPilotActive(firebaseUid, profile));
  const [adminActive, setAdminActive] = useState(() => isAdminEmail(firebaseEmail));

  useEffect(() => {
    setTestPilotActive(isTestPilotActive(firebaseUid, profile));
  }, [firebaseUid, profile?.testPilot]);

  useEffect(() => {
    setAdminActive(isAdminEmail(firebaseEmail));
  }, [firebaseEmail]);

  useEffect(() => {
    const onTestPilot = () => setTestPilotActive(isTestPilotActive(firebaseUid, profile));
    window.addEventListener("proyou:test-pilot-updated", onTestPilot);
    return () => window.removeEventListener("proyou:test-pilot-updated", onTestPilot);
  }, [firebaseUid, profile?.testPilot]);

  useEffect(() => {
    initAppTrialStart();
    const refresh = () => {
      refreshCoachPromptUsageIfDayChanged();
      setAppTrial(getAppTrialStatus());
      setPromptsUsedToday(getCoachPromptsUsedToday());
    };
    refresh();
    const id = setInterval(refresh, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const syncSubscription = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await refreshSubscriptionState(firebaseUid || undefined);
      let state = mergeSubscriptionWithReferral(raw);
      state = mergeSubscriptionWithTestPilot(state, firebaseUid, profile);
      state = mergeSubscriptionWithAdminAccess(state, firebaseEmail);
      const referral = getReferralProGrant();
      setReferralProActive(referral.active);
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
  }, [firebaseUid, firebaseEmail, profile?.testPilot]);

  useEffect(() => {
    void syncSubscription();
  }, [syncSubscription]);

  useEffect(() => {
    const onReferralPro = () => {
      const referral = getReferralProGrant();
      setReferralProActive(referral.active);
      void syncSubscription();
    };
    window.addEventListener("proyou:referral-pro-updated", onReferralPro);
    return () => window.removeEventListener("proyou:referral-pro-updated", onReferralPro);
  }, [syncSubscription]);

  useEffect(() => {
    const refreshPrompts = () => {
      refreshCoachPromptUsageIfDayChanged();
      setPromptsUsedToday(getCoachPromptsUsedToday());
    };
    refreshPrompts();
    return subscribeSubscriptionSnapshot(() => {
      refreshPrompts();
    });
  }, []);

  const unlimitedCoach = hasUnlimitedCoachPrompts({
    isPro,
    appTrialActive: appTrial.active,
    testPilotActive,
    adminActive,
  });
  const promptsRemainingToday = coachPromptsRemaining(
    promptsUsedToday,
    isPro,
    appTrial.active,
    testPilotActive || adminActive,
  );

  const featureCtx = useMemo(
    () => ({
      isPro,
      testPilotActive,
      adminActive,
      appTrialActive: appTrial.active,
      appTrialDaysLeft: appTrial.daysLeft,
      appTrialEnded: appTrial.ended,
      promptsRemainingToday: unlimitedCoach ? Infinity : promptsRemainingToday,
      routineTemplateCount,
      optionalModuleCount: countOptionalEnabledModules(enabledModules),
    }),
    [isPro, testPilotActive, adminActive, appTrial, unlimitedCoach, promptsRemainingToday, routineTemplateCount, enabledModules]
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
    if (unlimitedCoach) return true;
    if (promptsUsedToday >= FREE_COACH_PROMPTS_PER_DAY) return false;
    const next = consumeCoachPromptLocal();
    setPromptsUsedToday(next);
    return true;
  }, [unlimitedCoach, promptsUsedToday]);

  const tryCoachPrompt = useCallback(() => {
    if (unlimitedCoach) return true;
    if (promptsUsedToday >= FREE_COACH_PROMPTS_PER_DAY) {
      openUpgrade("coach_prompt");
      return false;
    }
    return true;
  }, [unlimitedCoach, promptsUsedToday, openUpgrade]);

  const purchasePro = useCallback(async () => {
    const raw = await purchaseProMonthly(firebaseUid || undefined);
    let state = mergeSubscriptionWithReferral(raw);
    state = mergeSubscriptionWithTestPilot(state, firebaseUid, profile);
    state = mergeSubscriptionWithAdminAccess(state, firebaseEmail);
    setIsPro(state.isPro);
    setTrialActive(state.trialActive);
    setExpirationDate(state.expirationDate);
    setSubscriptionExpired(state.subscriptionExpired);
    setSubscriptionSnapshot({ isPro: state.isPro, trialActive: state.trialActive });
    if (state.isPro) closeUpgrade();
    return state;
  }, [closeUpgrade, firebaseUid, firebaseEmail, profile]);

  const restore = useCallback(async () => {
    const raw = await restorePurchases(firebaseUid || undefined);
    let state = mergeSubscriptionWithReferral(raw);
    state = mergeSubscriptionWithTestPilot(state, firebaseUid, profile);
    state = mergeSubscriptionWithAdminAccess(state, firebaseEmail);
    setIsPro(state.isPro);
    setTrialActive(state.trialActive);
    setExpirationDate(state.expirationDate);
    setSubscriptionExpired(state.subscriptionExpired);
    setSubscriptionSnapshot({ isPro: state.isPro, trialActive: state.trialActive });
    if (state.isPro) closeUpgrade();
    return state;
  }, [closeUpgrade, firebaseUid, firebaseEmail, profile]);

  const value = useMemo(
    () => ({
      loading,
      isPro,
      testPilotActive,
      trialActive,
      expirationDate,
      subscriptionExpired,
      promptsRemainingToday: unlimitedCoach ? Infinity : promptsRemainingToday,
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
      referralProActive,
      referralProDaysLeft: getReferralProGrant().daysLeft,
      adminActive,
    }),
    [
      loading,
      isPro,
      testPilotActive,
      adminActive,
      referralProActive,
      trialActive,
      expirationDate,
      subscriptionExpired,
      unlimitedCoach,
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

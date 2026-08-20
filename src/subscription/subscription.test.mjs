import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { installMemoryLocalStorage } from "../../tests/helpers/memoryStorage.mjs";
import {
  canUseFeature,
  coachPromptsRemaining,
  hasUnlimitedCoachPrompts,
  countOptionalEnabledModules,
} from "./features.js";
import { FREE_COACH_PROMPTS_PER_DAY, APP_TRIAL_START_KEY, APP_TRIAL_DAYS } from "./constants.js";
import {
  getCoachPromptsUsedToday,
  consumeCoachPromptLocal,
  refreshCoachPromptUsageIfDayChanged,
  syncCoachPromptUsageFromServer,
  getCoachPromptQuotaLocal,
} from "./promptUsage.js";
import { getAppTrialStatus, isAppTrialGatedFeature } from "./appTrial.js";
import { isAdminEmail, mergeSubscriptionWithAdminAccess } from "./proAdmin.js";
import { isTestPilotActive, mergeSubscriptionWithTestPilot } from "./testPilot.js";

describe("subscription features", () => {
  it("unlocks everything for Pro, admin, and test pilot", () => {
    assert.equal(canUseFeature("health", { isPro: true }), true);
    assert.equal(canUseFeature("health", { adminActive: true }), true);
    assert.equal(canUseFeature("health", { testPilotActive: true }), true);
  });

  it("keeps all features free for now", () => {
    assert.equal(canUseFeature("health", { appTrialActive: true }), true);
    assert.equal(canUseFeature("advanced_alarms", { appTrialActive: true }), true);
    assert.equal(canUseFeature("advanced_alarms", { appTrialActive: false }), true);
    assert.equal(canUseFeature("health", { appTrialActive: false }), true);
  });

  it("allows unlimited coach prompts for everyone", () => {
    assert.equal(canUseFeature("coach_prompt", { promptsRemainingToday: 2 }), true);
    assert.equal(canUseFeature("coach_prompt", { promptsRemainingToday: 0 }), true);
    assert.equal(coachPromptsRemaining(0, false), Infinity);
    assert.equal(coachPromptsRemaining(2, false), Infinity);
    assert.equal(coachPromptsRemaining(9, true), Infinity);
    assert.equal(hasUnlimitedCoachPrompts({ appTrialActive: false }), true);
  });

  it("counts optional modules outside the free set", () => {
    assert.equal(countOptionalEnabledModules(["today", "health", "finance"]), 2);
  });
});

describe("coach prompt usage (local day reset)", () => {
  beforeEach(() => installMemoryLocalStorage());

  it("starts at zero and increments locally", () => {
    assert.equal(getCoachPromptsUsedToday(), 0);
    consumeCoachPromptLocal();
    consumeCoachPromptLocal();
    assert.equal(getCoachPromptsUsedToday(), 2);
    assert.equal(getCoachPromptQuotaLocal().remaining, 0);
  });

  it("resets when the stored day is not today", () => {
    localStorage.setItem("proyou_coach_prompt_usage_v1", JSON.stringify({ day: "2020-01-01", count: 5 }));
    assert.equal(refreshCoachPromptUsageIfDayChanged(), true);
    assert.equal(getCoachPromptsUsedToday(), 0);
  });

  it("syncs from the server for the same local day and ignores other days", () => {
    const today = getCoachPromptQuotaLocal().day;
    assert.equal(syncCoachPromptUsageFromServer({ used: 1, limit: 2, dayKey: today }), 1);
    assert.equal(getCoachPromptsUsedToday(), 1);
    syncCoachPromptUsageFromServer({ used: 2, dayKey: "1999-01-01" });
    assert.equal(getCoachPromptsUsedToday(), 1);
  });
});

describe("app trial + admin + pilot", () => {
  beforeEach(() => installMemoryLocalStorage());

  it("treats a fresh install as an active 30-day trial", () => {
    const status = getAppTrialStatus();
    assert.equal(status.active, true);
    assert.equal(status.ended, false);
    assert.equal(status.daysTotal, APP_TRIAL_DAYS);
    assert.ok(status.daysLeft >= 1);
    assert.equal(isAppTrialGatedFeature("health"), true);
    assert.equal(isAppTrialGatedFeature("cloud_sync"), false);
  });

  it("marks the trial ended after 30 days", () => {
    localStorage.setItem(APP_TRIAL_START_KEY, String(Date.now() - 31 * 86400000));
    const status = getAppTrialStatus();
    assert.equal(status.active, false);
    assert.equal(status.ended, true);
    assert.equal(status.daysLeft, 0);
  });

  it("grants Pro to the builtin admin email", () => {
    assert.equal(isAdminEmail("sdkitay605@gmail.com"), true);
    const merged = mergeSubscriptionWithAdminAccess({ isPro: false, trialActive: false }, "sdkitay605@gmail.com");
    assert.equal(merged.isPro, true);
    assert.equal(merged.adminActive, true);
  });

  it("grants Pro to profile test pilots", () => {
    assert.equal(isTestPilotActive(null, { testPilot: true }), true);
    const merged = mergeSubscriptionWithTestPilot({ isPro: false }, "uid", { testPilot: true });
    assert.equal(merged.isPro, true);
    assert.equal(merged.testPilotActive, true);
  });
});

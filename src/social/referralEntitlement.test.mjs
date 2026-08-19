import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  computeReferralProUntilIso,
  latestReferralProUntilIso,
  mergeSubscriptionWithReferral,
  setReferralProUntilIso,
} from "./referralEntitlement.ts";
import { generateReferralCode } from "./socialModel.ts";
import { installMemoryLocalStorage } from "../../tests/helpers/memoryStorage.mjs";

describe("referral entitlement", () => {
  const storage = installMemoryLocalStorage();
  afterEach(() => storage.clear());

  it("extends from now or from a still-active grant", () => {
    const fromNow = computeReferralProUntilIso("", 30);
    const fromNowMs = new Date(fromNow).getTime();
    assert.ok(fromNowMs > Date.now());
    const later = computeReferralProUntilIso(fromNow, 10);
    assert.ok(new Date(later).getTime() > fromNowMs);
  });

  it("picks the latest valid ISO among profile and reward rows", () => {
    const a = "2026-01-01T00:00:00.000Z";
    const b = "2027-06-01T00:00:00.000Z";
    assert.equal(latestReferralProUntilIso([a, b, "", null]), b);
    assert.equal(latestReferralProUntilIso(["nope", ""]), "");
  });

  it("does not grant Pro when no referral grant is stored", () => {
    const merged = mergeSubscriptionWithReferral({ isPro: false, trialActive: true });
    assert.equal(merged.isPro, false);
    assert.equal(merged.trialActive, true);
  });

  it("treats a stored future grant as Pro", () => {
    const until = new Date(Date.now() + 86400000).toISOString();
    setReferralProUntilIso(until);
    const merged = mergeSubscriptionWithReferral({ isPro: false, trialActive: true });
    assert.equal(merged.isPro, true);
    assert.equal(merged.referralProActive, true);
  });

  it("keeps invite codes namespaced to PY plus uid material", () => {
    assert.match(generateReferralCode("user_abc123"), /^PY/);
    assert.notEqual(generateReferralCode("a"), generateReferralCode("a"));
  });
});

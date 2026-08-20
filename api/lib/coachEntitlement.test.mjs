import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractIdToken,
  subjectKey,
  resolveQuotaDayKey,
  isAdminEmailServer,
  isUnlimitedCoachEntitlement,
  evaluateStoredCoachPromptCount,
  buildCoachQuotaPayload,
  consumeCoachPrompt,
} from "./coachEntitlement.js";

describe("coachEntitlement identity", () => {
  it("extracts Bearer token then body idToken", () => {
    assert.equal(extractIdToken({ headers: { authorization: "Bearer abc" } }, {}), "abc");
    assert.equal(extractIdToken({ headers: {} }, { idToken: "  xyz  " }), "xyz");
    assert.equal(extractIdToken({ headers: {} }, {}), null);
  });

  it("scopes quota by uid, then device, then IP", () => {
    assert.equal(subjectKey({ headers: {} }, {}, "user-1"), "uid:user-1");
    assert.equal(
      subjectKey({ headers: { "x-proyou-device-id": "  phone-9  " } }, {}, null),
      "dev:phone-9",
    );
    assert.equal(
      subjectKey({ headers: { "x-forwarded-for": "1.2.3.4, 9.9.9.9" } }, {}, null),
      "ip:1.2.3.4",
    );
    assert.equal(subjectKey({ headers: {} }, {}, null), "ip:unknown");
  });

  it("prefers the client's local calendar day for quota", () => {
    const now = new Date("2026-08-18T23:00:00.000Z");
    assert.equal(resolveQuotaDayKey({ subscription: { localDayKey: "2026-08-18" } }, now), "2026-08-18");
    assert.equal(resolveQuotaDayKey({}, now), "2026-08-18");
    assert.equal(resolveQuotaDayKey({ subscription: { localDayKey: "nope" } }, now), "2026-08-18");
  });
});

describe("coachEntitlement access", () => {
  it("recognizes builtin and env admin emails", () => {
    assert.equal(isAdminEmailServer("sdkitay605@gmail.com"), true);
    assert.equal(isAdminEmailServer(" SDKITAY605@gmail.com "), true);
    const prev = process.env.PROYOU_ADMIN_EMAILS;
    process.env.PROYOU_ADMIN_EMAILS = "ops@example.com";
    try {
      assert.equal(isAdminEmailServer("ops@example.com"), true);
    } finally {
      if (prev === undefined) delete process.env.PROYOU_ADMIN_EMAILS;
      else process.env.PROYOU_ADMIN_EMAILS = prev;
    }
    assert.equal(isAdminEmailServer("stranger@example.com"), false);
  });

  it("treats Pro, trial, pilot, and admin as unlimited", () => {
    assert.equal(isUnlimitedCoachEntitlement({ isPro: true }), true);
    assert.equal(isUnlimitedCoachEntitlement({ appTrialActive: true }), true);
    assert.equal(isUnlimitedCoachEntitlement({ testPilotActive: true }), true);
    assert.equal(isUnlimitedCoachEntitlement({ adminActive: true }), true);
    assert.equal(isUnlimitedCoachEntitlement({}), false);
  });
});

describe("coachEntitlement quota", () => {
  it("allows two free prompts then blocks", () => {
    assert.deepEqual(evaluateStoredCoachPromptCount(0), { ok: true, used: 0, limit: 2 });
    assert.deepEqual(evaluateStoredCoachPromptCount(1), { ok: true, used: 1, limit: 2 });
    const blocked = evaluateStoredCoachPromptCount(2);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "PROMPT_LIMIT");
    assert.equal(blocked.used, 2);
    assert.equal(blocked.limit, 2);
    assert.equal(evaluateStoredCoachPromptCount(5).ok, false);
  });

  it("omits quota payload for unlimited entitlements", () => {
    assert.equal(buildCoachQuotaPayload({ isPro: true, used: 9 }), null);
    assert.equal(buildCoachQuotaPayload({ appTrialActive: true }), null);
    assert.equal(buildCoachQuotaPayload({ testPilotActive: true }), null);
    assert.equal(buildCoachQuotaPayload({ adminActive: true }), null);
  });

  it("reports remaining prompts for free users", () => {
    assert.deepEqual(buildCoachQuotaPayload({ used: 1, quotaDay: "2026-08-18" }), {
      used: 1,
      limit: 2,
      remaining: 1,
      dayKey: "2026-08-18",
    });
    assert.equal(buildCoachQuotaPayload({ used: 2 }).remaining, 0);
  });

  it("does not consume when Redis key is missing or user is Pro", async () => {
    await consumeCoachPrompt(null);
    await consumeCoachPrompt({ isPro: true, key: "coach:prompts:uid:1:2026-08-18" });
    await consumeCoachPrompt({ ok: true, used: 0 });
  });
});

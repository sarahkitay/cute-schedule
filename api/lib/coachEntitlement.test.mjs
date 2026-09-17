import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractIdToken,
  subjectKey,
  resolveQuotaDayKey,
  isAdminEmailServer,
  isUnlimitedCoachEntitlement,
  trialStatusFromCreationTime,
  COACH_TRIAL_DAYS,
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

  it("prefers the client's local calendar day for legacy quota display", () => {
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

  it("uses a 30-day trial from server-trusted account creation time", () => {
    assert.equal(COACH_TRIAL_DAYS, 30);
    const created = "2026-09-01T12:00:00.000Z";
    const during = trialStatusFromCreationTime(created, Date.parse("2026-09-30T11:59:59.000Z"));
    assert.equal(during.active, true);
    assert.equal(during.daysLeft, 2);
    assert.equal(during.startedAt, created);
    assert.equal(during.endsAt, "2026-10-01T12:00:00.000Z");

    const expired = trialStatusFromCreationTime(created, Date.parse("2026-10-01T12:00:00.000Z"));
    assert.equal(expired.active, false);
    assert.equal(expired.daysLeft, 0);
  });

  it("rejects malformed account creation timestamps as a trial", () => {
    assert.deepEqual(trialStatusFromCreationTime("not-a-date", Date.now()), {
      active: false,
      daysLeft: 0,
      startedAt: null,
      endsAt: null,
    });
  });

  it("treats Pro, verified trial, pilot, and admin as unlimited", () => {
    assert.equal(isUnlimitedCoachEntitlement({ isPro: true }), true);
    assert.equal(isUnlimitedCoachEntitlement({ appTrialActive: true }), true);
    assert.equal(isUnlimitedCoachEntitlement({ testPilotActive: true }), true);
    assert.equal(isUnlimitedCoachEntitlement({ adminActive: true }), true);
    assert.equal(isUnlimitedCoachEntitlement({}), false);
  });
});

describe("coachEntitlement legacy quota helpers", () => {
  it("retains the old two-prompt helpers only for compatibility", () => {
    assert.deepEqual(evaluateStoredCoachPromptCount(0), { ok: true, used: 0, limit: 2 });
    assert.deepEqual(evaluateStoredCoachPromptCount(1), { ok: true, used: 1, limit: 2 });
    const blocked = evaluateStoredCoachPromptCount(2);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "PROMPT_LIMIT");
    assert.equal(blocked.used, 2);
    assert.equal(blocked.limit, 2);
  });

  it("omits quota payload for unlimited entitlements", () => {
    assert.equal(buildCoachQuotaPayload({ isPro: true, used: 9 }), null);
    assert.equal(buildCoachQuotaPayload({ appTrialActive: true }), null);
    assert.equal(buildCoachQuotaPayload({ testPilotActive: true }), null);
    assert.equal(buildCoachQuotaPayload({ adminActive: true }), null);
  });

  it("does not consume when Redis key is missing or user is unlimited", async () => {
    await consumeCoachPrompt(null);
    await consumeCoachPrompt({ isPro: true, key: "coach:prompts:uid:1:2026-08-18" });
    await consumeCoachPrompt({ appTrialActive: true, key: "coach:prompts:uid:1:2026-08-18" });
    await consumeCoachPrompt({ ok: true, used: 0 });
  });
});

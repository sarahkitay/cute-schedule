import assert from "node:assert/strict";
import { describe, it } from "node:test";
import handler, { mapCoachEntitlementFailure } from "./coach.js";

function mockReqRes({ method = "POST", body = {}, headers = {} } = {}) {
  const resHeaders = {};
  let statusCode = 200;
  let payload = null;
  const res = {
    setHeader(k, v) {
      resHeaders[k] = v;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(obj) {
      payload = obj;
      return this;
    },
    end() {
      return this;
    },
  };
  const req = { method, body, headers, socket: {} };
  return {
    req,
    res,
    result: () => ({ statusCode, payload, resHeaders }),
  };
}

describe("mapCoachEntitlementFailure", () => {
  it("maps AUTH_REQUIRED to 401 without a prompt-limit claim", () => {
    const denied = mapCoachEntitlementFailure({ ok: false, code: "AUTH_REQUIRED", status: 401 });
    assert.equal(denied.status, 401);
    assert.equal(denied.body.code, "AUTH_REQUIRED");
    assert.match(denied.body.error, /auth/i);
    assert.equal(denied.body.upgrade, undefined);
    assert.equal(denied.body.coachQuota, undefined);
    assert.doesNotMatch(JSON.stringify(denied.body), /daily|prompt limit|quota/i);
  });

  it("maps a bare 401 status to the same auth-required body", () => {
    const denied = mapCoachEntitlementFailure({ ok: false, status: 401 });
    assert.equal(denied.status, 401);
    assert.equal(denied.body.code, "AUTH_REQUIRED");
    assert.doesNotMatch(JSON.stringify(denied.body), /daily coach prompt limit/i);
  });

  it("keeps subscription and prompt-limit denials on 402", () => {
    const subscription = mapCoachEntitlementFailure({
      ok: false,
      code: "SUBSCRIPTION_REQUIRED",
      status: 402,
      uid: "user-1",
    });
    assert.equal(subscription.status, 402);
    assert.equal(subscription.body.error, "Daily coach prompt limit reached");
    assert.equal(subscription.body.code, "SUBSCRIPTION_REQUIRED");
    assert.equal(subscription.body.upgrade, true);

    const promptLimit = mapCoachEntitlementFailure({
      ok: false,
      code: "PROMPT_LIMIT",
      used: 2,
      limit: 2,
    });
    assert.equal(promptLimit.status, 402);
    assert.equal(promptLimit.body.error, "Daily coach prompt limit reached");
    assert.equal(promptLimit.body.code, "PROMPT_LIMIT");
    assert.equal(promptLimit.body.used, 2);
    assert.equal(promptLimit.body.limit, 2);
    assert.equal(promptLimit.body.upgrade, true);
  });

  it("uses a non-401 entitlement status when the denial is not auth", () => {
    const denied = mapCoachEntitlementFailure({
      ok: false,
      code: "SUBSCRIPTION_CHECK_UNAVAILABLE",
      status: 503,
    });
    assert.equal(denied.status, 503);
    assert.equal(denied.body.code, "SUBSCRIPTION_CHECK_UNAVAILABLE");
    assert.equal(denied.body.error, "Daily coach prompt limit reached");
  });
});

describe("POST /api/coach entitlement status", () => {
  it("returns 401 when the Firebase ID token is missing", async () => {
    const ctx = mockReqRes({ body: { dayKey: "2026-09-24" }, headers: {} });
    await handler(ctx.req, ctx.res);
    const { statusCode, payload } = ctx.result();
    assert.equal(statusCode, 401);
    assert.equal(payload.code, "AUTH_REQUIRED");
    assert.match(payload.error, /auth/i);
    assert.equal(payload.upgrade, undefined);
    assert.doesNotMatch(JSON.stringify(payload), /daily coach prompt limit/i);
  });

  it("returns 401 when the Firebase ID token cannot be verified", async () => {
    const ctx = mockReqRes({
      body: { dayKey: "2026-09-24" },
      headers: { authorization: "Bearer not-a-firebase-id-token" },
    });
    await handler(ctx.req, ctx.res);
    const { statusCode, payload } = ctx.result();
    assert.equal(statusCode, 401);
    assert.equal(payload.code, "AUTH_REQUIRED");
    assert.doesNotMatch(JSON.stringify(payload), /daily coach prompt limit/i);
  });
});

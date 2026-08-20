import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyApiCors } from "./cors.js";
import { clientSafeDetail } from "./safeJsonError.js";
import { getCoachRateLimitClientId } from "./coachRateLimit.js";
import { validateNutritionLabelPayload } from "./nutritionLabelRateLimit.js";
import { normalizeReminderPayload } from "./pushReminderNormalize.js";
import { getWebSubscriptionFromStored, getNativeTokenFromStored } from "./pushTarget.js";
import { normalizeCapacitorIosDeviceToken, isValidNormalizedIosDeviceToken } from "./nativeIosTokenNormalize.js";
import { normalizeFcmRegistrationToken, isValidFcmRegistrationToken } from "./fcmRegistrationToken.js";

function resBag() {
  const headers = {};
  return {
    headers,
    setHeader(k, v) {
      headers[k] = v;
    },
  };
}

describe("cors", () => {
  it("allows any origin when allowlist is unset", () => {
    const prev = process.env.API_ALLOWED_ORIGINS;
    delete process.env.API_ALLOWED_ORIGINS;
    const res = resBag();
    applyApiCors({ headers: { origin: "https://evil.example" } }, res);
    assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
    if (prev !== undefined) process.env.API_ALLOWED_ORIGINS = prev;
  });

  it("reflects only listed origins and Capacitor webviews", () => {
    const prev = process.env.API_ALLOWED_ORIGINS;
    process.env.API_ALLOWED_ORIGINS = "https://proyou.app,https://cute-schedule.vercel.app";
    try {
      const allowed = resBag();
      applyApiCors({ headers: { origin: "https://proyou.app" } }, allowed);
      assert.equal(allowed.headers["Access-Control-Allow-Origin"], "https://proyou.app");

      const blocked = resBag();
      applyApiCors({ headers: { origin: "https://evil.example" } }, blocked);
      assert.equal(blocked.headers["Access-Control-Allow-Origin"], undefined);

      const cap = resBag();
      applyApiCors({ headers: { origin: "capacitor://localhost" } }, cap);
      assert.equal(cap.headers["Access-Control-Allow-Origin"], "capacitor://localhost");
    } finally {
      if (prev === undefined) delete process.env.API_ALLOWED_ORIGINS;
      else process.env.API_ALLOWED_ORIGINS = prev;
    }
  });
});

describe("safeJsonError", () => {
  it("hides exception text in production", () => {
    assert.equal(clientSafeDetail(new Error("secret"), true), undefined);
    assert.match(String(clientSafeDetail(new Error("secret"), false)), /secret/);
  });
});

describe("rate-limit client id", () => {
  it("uses the first X-Forwarded-For hop", () => {
    assert.equal(
      getCoachRateLimitClientId({ headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" } }),
      "ip:10.0.0.1",
    );
    assert.equal(getCoachRateLimitClientId({ headers: { "x-real-ip": "8.8.8.8" } }), "ip:8.8.8.8");
    assert.equal(getCoachRateLimitClientId({ headers: {} }), "ip:unknown");
  });
});

describe("nutrition label payload", () => {
  it("accepts empty or modest payloads", () => {
    assert.equal(validateNutritionLabelPayload({}), null);
    assert.equal(validateNutritionLabelPayload({ text: "Calories 230" }), null);
  });

  it("rejects oversized OCR text and images", () => {
    assert.equal(validateNutritionLabelPayload({ text: "x".repeat(12_001) }), "OCR text is too long.");
    assert.equal(
      validateNutritionLabelPayload({ imageBase64: "a".repeat(6_000_001) }),
      "Image is too large. Try a closer photo or lower resolution.",
    );
  });
});

describe("push reminders", () => {
  it("drops reminders without title/time and far-future rows", () => {
    const now = Date.parse("2026-08-18T12:00:00.000Z");
    const max = 24 * 60 * 60 * 1000;
    const out = normalizeReminderPayload(
      [
        { title: "Meds", at: new Date(now + 60_000).toISOString() },
        { title: "Skip me" },
        { title: "Too far", at: new Date(now + 10 * max).toISOString() },
      ],
      now,
      max,
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].title, "Meds");
    assert.ok(out[0].tag);
  });
});

describe("push target storage", () => {
  it("reads web and native stored subscriptions", () => {
    assert.equal(getWebSubscriptionFromStored(null), null);
    const web = getWebSubscriptionFromStored({
      type: "web",
      subscription: { endpoint: "https://push.example/abc" },
    });
    assert.equal(web.endpoint, "https://push.example/abc");
    const legacy = getWebSubscriptionFromStored({ endpoint: "https://push.example/legacy" });
    assert.equal(legacy.endpoint, "https://push.example/legacy");

    const ios = getNativeTokenFromStored({ type: "ios", token: "fcm-token", pushProvider: "fcm" });
    assert.equal(ios.kind, "ios");
    assert.equal(ios.pushProvider, "fcm");
    assert.equal(getNativeTokenFromStored({ token: "short" }), null);
  });
});

describe("device tokens", () => {
  it("normalizes APNs hex and rejects invalid lengths", () => {
    const hex = "ab".repeat(32);
    assert.equal(normalizeCapacitorIosDeviceToken(`< ${hex.toUpperCase()} >`), hex);
    assert.equal(isValidNormalizedIosDeviceToken(hex), true);
    assert.equal(isValidNormalizedIosDeviceToken("zz"), false);
    assert.equal(isValidNormalizedIosDeviceToken("ab"), false);
  });

  it("validates FCM registration tokens by length", () => {
    assert.equal(normalizeFcmRegistrationToken("  tok  "), "tok");
    assert.equal(isValidFcmRegistrationToken("x".repeat(16)), false);
    assert.equal(isValidFcmRegistrationToken("x".repeat(32)), true);
  });
});

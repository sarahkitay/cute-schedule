import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { verifyRevenueCatPro } from "./revenueCatVerify.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.REVENUECAT_SECRET_KEY;
  delete process.env.REVENUECAT_PRO_ENTITLEMENT_ID;
});

describe("verifyRevenueCatPro", () => {
  it("falls back when secret or uid is missing", async () => {
    assert.deepEqual(await verifyRevenueCatPro("uid-1"), { verified: false, isPro: false });
    process.env.REVENUECAT_SECRET_KEY = "sk_test";
    assert.deepEqual(await verifyRevenueCatPro(""), { verified: false, isPro: false });
  });

  it("treats unknown subscribers as verified not-Pro", async () => {
    process.env.REVENUECAT_SECRET_KEY = "sk_test";
    globalThis.fetch = async () => ({ status: 404, ok: false, json: async () => ({}) });
    assert.deepEqual(await verifyRevenueCatPro("uid-1"), { verified: true, isPro: false });
  });

  it("reads an active Pro entitlement", async () => {
    process.env.REVENUECAT_SECRET_KEY = "sk_test";
    globalThis.fetch = async () => ({
      status: 200,
      ok: true,
      json: async () => ({
        subscriber: {
          entitlements: {
            pro: { expires_date: "2099-01-01T00:00:00Z" },
          },
        },
      }),
    });
    assert.deepEqual(await verifyRevenueCatPro("uid-1"), { verified: true, isPro: true });
  });

  it("treats expired entitlements as not Pro", async () => {
    process.env.REVENUECAT_SECRET_KEY = "sk_test";
    globalThis.fetch = async () => ({
      status: 200,
      ok: true,
      json: async () => ({
        subscriber: {
          entitlements: {
            pro: { expires_date: "2020-01-01T00:00:00Z" },
          },
        },
      }),
    });
    assert.deepEqual(await verifyRevenueCatPro("uid-1"), { verified: true, isPro: false });
  });

  it("falls back on API errors instead of trusting the client", async () => {
    process.env.REVENUECAT_SECRET_KEY = "sk_test";
    globalThis.fetch = async () => ({ status: 500, ok: false, json: async () => ({}) });
    assert.deepEqual(await verifyRevenueCatPro("uid-1"), { verified: false, isPro: false });
  });
});

import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { getVapidPublicKey, getVapidPrivateKey, getVapidSubject } from "./vapidEnv.js";

const KEYS = ["VAPID_PUBLIC_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"];
const snapshot = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
});

describe("vapidEnv", () => {
  it("prefers VAPID_PUBLIC_KEY over the mistaken Next name", () => {
    process.env.VAPID_PUBLIC_KEY = " pub ";
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "next";
    assert.equal(getVapidPublicKey(), "pub");
  });

  it("falls back to NEXT_PUBLIC_VAPID_PUBLIC_KEY", () => {
    delete process.env.VAPID_PUBLIC_KEY;
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "next-key";
    assert.equal(getVapidPublicKey(), "next-key");
  });

  it("never invents a private key and defaults the subject", () => {
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
    assert.equal(getVapidPrivateKey(), "");
    assert.equal(getVapidSubject(), "mailto:hello@proyou.app");
  });
});

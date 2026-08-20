import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLOUD_ACCOUNT_UNAVAILABLE,
  CLOUD_CONNECT_FAILED,
  sanitizeCloudUserError,
} from "./cloudUserMessages.js";

describe("sanitizeCloudUserError", () => {
  it("maps vendor SDK errors to product copy", () => {
    assert.equal(sanitizeCloudUserError(new Error("Firebase: Error (auth/network-request-failed).")), CLOUD_CONNECT_FAILED);
    assert.equal(sanitizeCloudUserError("Missing VITE_FIREBASE_API_KEY"), CLOUD_CONNECT_FAILED);
    assert.equal(sanitizeCloudUserError("Cloud sync is not configured"), CLOUD_ACCOUNT_UNAVAILABLE);
  });

  it("keeps safe user-facing messages", () => {
    assert.equal(sanitizeCloudUserError(new Error("Couldn't save your schedule. Try again.")), "Couldn't save your schedule. Try again.");
  });
});

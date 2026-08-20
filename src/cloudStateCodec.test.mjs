import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cloneForFirestore,
  encodeHoursMapKeys,
  decodeHoursMapKeys,
  encodeAppStateHourKeys,
  decodeAppStateHourKeys,
} from "./cloudStateCodec.js";

describe("cloudStateCodec", () => {
  it("drops undefined so Firestore payloads stay valid JSON", () => {
    assert.equal(cloneForFirestore(undefined), null);
    assert.deepEqual(cloneForFirestore({ a: 1, b: undefined }), { a: 1 });
    assert.equal(cloneForFirestore("ok"), "ok");
  });

  it("round-trips hour keys that contain colons", () => {
    const hours = { "09:00": { Work: [{ text: "Standup" }] } };
    const encoded = encodeHoursMapKeys(hours);
    assert.equal(encoded["09%3A00"].Work[0].text, "Standup");
    assert.equal(encoded["09:00"], undefined);
    const decoded = decodeHoursMapKeys(encoded);
    assert.equal(decoded["09:00"].Work[0].text, "Standup");
  });

  it("encodes and decodes nested appState day hours", () => {
    const appState = {
      days: {
        "2026-08-18": {
          hours: { "07:30": { Personal: [{ text: "Run", done: false }] } },
        },
      },
    };
    const encoded = encodeAppStateHourKeys(appState);
    assert.equal(encoded.days["2026-08-18"].hours["07%3A30"].Personal[0].text, "Run");
    const roundTrip = decodeAppStateHourKeys(encoded);
    assert.deepEqual(roundTrip, appState);
  });
});

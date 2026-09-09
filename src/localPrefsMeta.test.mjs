import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { installMemoryLocalStorage } from "../tests/helpers/memoryStorage.mjs";
import {
  LOCAL_PREFS_META_KEY,
  applyPinnedProfileFields,
  localPrefIsNewer,
  pinLocalUserName,
  readPinnedUserName,
  seedLocalPrefsMetaFromDisk,
  touchLocalPref,
} from "./localPrefsMeta.js";

installMemoryLocalStorage();

describe("localPrefsMeta", () => {
  beforeEach(() => {
    localStorage.removeItem(LOCAL_PREFS_META_KEY);
  });

  it("pins userName and always wins over cloud merge helper", () => {
    pinLocalUserName("Sarah");
    assert.equal(readPinnedUserName(), "Sarah");
    const merged = applyPinnedProfileFields({ userName: "Other" });
    assert.equal(merged.userName, "Sarah");
  });

  it("refuses to pin a blocklisted name", () => {
    pinLocalUserName("Christy Gilkin");
    assert.equal(readPinnedUserName(), "");
  });

  it("does not auto-pin blocklisted stale cloud names from disk", () => {
    seedLocalPrefsMetaFromDisk({ userName: "Christy Gilkin" }, { name: "Classic Pink" });
    assert.equal(readPinnedUserName(), "");
  });

  it("auto-pins legitimate on-disk names", () => {
    seedLocalPrefsMetaFromDisk({ userName: "Sarah Kitay" }, { name: "Classic Pink" });
    assert.equal(readPinnedUserName(), "Sarah Kitay");
  });

  it("localPrefIsNewer compares timestamps", () => {
    touchLocalPref("health");
    assert.equal(localPrefIsNewer("health", new Date(Date.now() - 60_000).toISOString()), true);
    assert.equal(localPrefIsNewer("health", new Date(Date.now() + 60_000).toISOString()), false);
  });
});

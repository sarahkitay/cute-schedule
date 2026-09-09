import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { installMemoryLocalStorage } from "../tests/helpers/memoryStorage.mjs";
import { pinLocalUserName, readPinnedUserName } from "./localPrefsMeta.js";
import {
  buildCloudSavePayload,
  formatAccountStatusLabel,
  isBlocklistedUserName,
  sanitizeProfileForPersist,
  shouldRepairCloudAfterLoad,
} from "./cloudPersist.js";

installMemoryLocalStorage();

describe("cloudPersist", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("strips blocklisted names from persisted profile", () => {
    const out = sanitizeProfileForPersist({ userName: "Christy Gilkin" });
    assert.equal(out.userName, "");
  });

  it("clears a blocklisted pin instead of keeping it", () => {
    localStorage.setItem(
      "cute_schedule_local_prefs_meta_v1",
      JSON.stringify({ pinnedUserName: "Christy Gilkin", userName: Date.now() })
    );
    assert.equal(readPinnedUserName(), "");
    const out = sanitizeProfileForPersist({ userName: "Christy Gilkin" });
    assert.equal(out.userName, "");
  });

  it("keeps pinned name in cloud payload", () => {
    pinLocalUserName("Sarah");
    const payload = buildCloudSavePayload({
      profile: { userName: "Christy Gilkin" },
      health: { programs: [] },
      theme: { name: "Classic Pink" },
    });
    assert.equal(payload.profile.userName, "Sarah");
  });

  it("merges disk programs into cloud payload so empty memory cannot wipe them", () => {
    const payload = buildCloudSavePayload(
      {
        profile: { userName: "Sarah" },
        health: { programs: [] },
        theme: { name: "Classic Pink" },
      },
      {
        diskHealth: {
          programs: [{ id: "p1", name: "Legs", exercises: [{ name: "Squat", setsReps: "3x8" }] }],
        },
      }
    );
    assert.equal(payload.health.programs.length, 1);
    assert.equal(payload.health.programs[0].id, "p1");
  });

  it("refuses to upload fewer programs than last known cloud health", () => {
    const payload = buildCloudSavePayload(
      {
        profile: { userName: "Sarah" },
        health: { programs: [] },
        theme: { name: "Classic Pink" },
      },
      {
        cloudHealth: {
          programs: [{ id: "p2", name: "Push", exercises: [{ name: "Bench", setsReps: "3x8" }] }],
        },
      }
    );
    assert.equal(payload.health.programs.length, 1);
    assert.equal(payload.health.programs[0].id, "p2");
  });

  it("requests cloud repair when local programs are richer", () => {
    const repair = shouldRepairCloudAfterLoad({
      cloudUpdatedAt: new Date().toISOString(),
      cloudProfile: { userName: "Sarah" },
      cloudHealth: { programs: [] },
      localProfile: { userName: "Sarah" },
      localHealth: {
        programs: [{ id: "p1", name: "Legs", exercises: [{ name: "Squat", setsReps: "3x8" }] }],
      },
    });
    assert.equal(repair, true);
  });

  it("does not repair solely because health timestamp is newer with empty programs", async () => {
    const { touchLocalPref } = await import("./localPrefsMeta.js");
    touchLocalPref("health");
    const repair = shouldRepairCloudAfterLoad({
      cloudUpdatedAt: new Date(Date.now() - 60_000).toISOString(),
      cloudProfile: { userName: "Sarah" },
      cloudHealth: {
        programs: [{ id: "p2", name: "Push", exercises: [{ name: "Bench", setsReps: "3x8" }] }],
      },
      localProfile: { userName: "Sarah" },
      localHealth: { programs: [] },
    });
    assert.equal(repair, false);
  });

  it("flags blocklisted cloud profile names for repair", () => {
    assert.equal(isBlocklistedUserName("Christy Gilkin"), true);
    const repair = shouldRepairCloudAfterLoad({
      cloudUpdatedAt: new Date().toISOString(),
      cloudProfile: { userName: "Christy Gilkin" },
      cloudHealth: { programs: [] },
      localProfile: { userName: "" },
      localHealth: { programs: [] },
    });
    assert.equal(repair, true);
  });

  it("hides blocklisted Auth display names in account status", () => {
    const acct = formatAccountStatusLabel({
      authDisplayName: "Christy Gilkin",
      profileName: "Sarah",
    });
    assert.equal(acct.kind, "profile");
    assert.equal(acct.text, "Sarah");
  });
});

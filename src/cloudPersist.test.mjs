import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { installMemoryLocalStorage } from "../tests/helpers/memoryStorage.mjs";
import { pinLocalUserName } from "./localPrefsMeta.js";
import {
  buildCloudSavePayload,
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

  it("keeps pinned name in cloud payload", () => {
    pinLocalUserName("Sarah");
    const payload = buildCloudSavePayload({
      profile: { userName: "Christy Gilkin" },
      health: { programs: [] },
      theme: { name: "Classic Pink" },
    });
    assert.equal(payload.profile.userName, "Sarah");
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
});

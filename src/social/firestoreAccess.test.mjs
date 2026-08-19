import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  canCreateFriendship,
  canCreateReferral,
  canCreateReferralReward,
  canCreateSharedTask,
  canDeleteFriendship,
  canListUserProfiles,
  canMutateFriendshipMembers,
  canReadUserProfile,
  canUpdateSharedTaskMembers,
  friendshipDocId,
  listAddedOnly,
  listRemovedOnly,
} from "./firestoreAccess.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const rules = readFileSync(join(root, "firestore.rules"), "utf8");

describe("firestore.rules file", () => {
  it("does not allow any signed-in user to read all user_profiles", () => {
    assert.doesNotMatch(rules, /match \/user_profiles\/\{uid\}[\s\S]{0,240}allow read: if isSignedIn\(\);/);
    assert.match(rules, /allow list: if false;/);
    assert.match(rules, /match \/invite_codes\/\{code\}/);
  });

  it("does not allow friendship writes from merely listing yourself in memberUids", () => {
    assert.doesNotMatch(
      rules,
      /match \/friendships\/\{friendshipId\}[\s\S]{0,200}allow create, update, delete: if isSignedIn\(\)\s+&& request\.auth\.uid in request\.resource\.data\.memberUids;/,
    );
    assert.match(rules, /hasIncomingAcceptableRequest/);
    assert.match(rules, /invite_codes\/\$\(request\.resource\.data\.inviteCode\)/);
  });

  it("requires an existing referral before a referral reward can be created", () => {
    assert.match(rules, /match \/referral_rewards\/\{rewardId\}/);
    assert.match(rules, /exists\(\/databases\/\$\(database\)\/documents\/referrals\/\$\(request\.resource\.data\.referralId\)\)/);
    assert.match(rules, /allow update: if false;/);
  });

  it("freezes shared-task membership except self-accept", () => {
    assert.match(rules, /listAddedOnlySelf\(resource\.data\.get\('memberUids'/);
    assert.match(rules, /memberUids\.size\(\) == 1/);
  });
});

describe("profile read policy", () => {
  it("lets the owner and friends get a profile, not strangers or anonymous", () => {
    assert.equal(canReadUserProfile("alice", "alice", []), true);
    assert.equal(canReadUserProfile("bob", "alice", ["bob"]), true);
    assert.equal(canReadUserProfile("eve", "alice", ["bob"]), false);
    assert.equal(canReadUserProfile(null, "alice", ["eve"]), false);
    assert.equal(canListUserProfiles(), false);
  });
});

describe("friendship create policy", () => {
  const alice = "alice";
  const bob = "bob";
  const id = friendshipDocId(alice, bob);

  it("rejects adding someone just because the caller is in memberUids", () => {
    assert.equal(
      canCreateFriendship({
        authUid: alice,
        friendshipId: id,
        memberUids: [alice, bob],
      }),
      false,
    );
  });

  it("allows the recipient of a pending request to create the friendship", () => {
    assert.equal(
      canCreateFriendship({
        authUid: bob,
        friendshipId: id,
        memberUids: [alice, bob],
        incomingRequest: { fromUid: alice, toUid: bob, status: "pending" },
      }),
      true,
    );
  });

  it("allows a caller who presents the other person's invite code", () => {
    assert.equal(
      canCreateFriendship({
        authUid: alice,
        friendshipId: id,
        memberUids: [alice, bob],
        inviteCode: "PYBOBCODE",
        inviteCodeDoc: { uid: bob, allowFriendRequests: true },
      }),
      true,
    );
  });

  it("rejects a mismatched or closed invite code and blocked callers", () => {
    assert.equal(
      canCreateFriendship({
        authUid: alice,
        friendshipId: id,
        memberUids: [alice, bob],
        inviteCode: "PYBOBCODE",
        inviteCodeDoc: { uid: "carol", allowFriendRequests: true },
      }),
      false,
    );
    assert.equal(
      canCreateFriendship({
        authUid: alice,
        friendshipId: id,
        memberUids: [alice, bob],
        inviteCode: "PYBOBCODE",
        inviteCodeDoc: { uid: bob, allowFriendRequests: false },
      }),
      false,
    );
    assert.equal(
      canCreateFriendship({
        authUid: alice,
        friendshipId: id,
        memberUids: [alice, bob],
        inviteCode: "PYBOBCODE",
        inviteCodeDoc: { uid: bob, allowFriendRequests: true },
        otherBlockedCaller: true,
      }),
      false,
    );
  });

  it("rejects forged friendship ids and self-pairs", () => {
    assert.equal(
      canCreateFriendship({
        authUid: alice,
        friendshipId: "alice_eve",
        memberUids: [alice, bob],
        incomingRequest: { fromUid: bob, toUid: alice, status: "pending" },
      }),
      false,
    );
    assert.equal(
      canCreateFriendship({
        authUid: alice,
        friendshipId: friendshipDocId(alice, alice),
        memberUids: [alice, alice],
        inviteCode: "X",
        inviteCodeDoc: { uid: alice },
      }),
      false,
    );
  });

  it("does not let members rewrite membership arrays later", () => {
    assert.equal(canMutateFriendshipMembers([alice, bob], [alice, bob]), true);
    assert.equal(canMutateFriendshipMembers([alice, bob], [alice, bob, "eve"]), false);
    assert.equal(canDeleteFriendship(alice, [alice, bob]), true);
    assert.equal(canDeleteFriendship("eve", [alice, bob]), false);
  });
});

describe("membership array diffs", () => {
  it("accepts adding or removing only self", () => {
    assert.equal(listAddedOnly(["a"], ["a", "me"], "me"), true);
    assert.equal(listAddedOnly(["a"], ["a", "me", "eve"], "me"), false);
    assert.equal(listAddedOnly(["a", "me"], ["a", "me"], "me"), false);
    assert.equal(listRemovedOnly(["a", "me"], ["a"], "me"), true);
    assert.equal(listRemovedOnly(["a", "me"], [], "me"), false);
  });
});

describe("referral reward policy", () => {
  it("lets a referee record a signup only against the invite-code owner", () => {
    assert.equal(
      canCreateReferral({
        authUid: "bob",
        referrerUid: "alice",
        refereeUid: "bob",
        referralCode: "PYALICE",
        inviteCodeDoc: { uid: "alice" },
      }),
      true,
    );
    assert.equal(
      canCreateReferral({
        authUid: "bob",
        referrerUid: "bob",
        refereeUid: "bob",
        referralCode: "PYBOB",
        inviteCodeDoc: { uid: "bob" },
      }),
      false,
    );
    assert.equal(
      canCreateReferral({
        authUid: "bob",
        referrerUid: "alice",
        refereeUid: "bob",
        referralCode: "PYALICE",
        inviteCodeDoc: { uid: "carol" },
      }),
      false,
    );
  });

  it("does not let the purported beneficiary mint a reward without a referral they own as referrer", () => {
    assert.equal(
      canCreateReferralReward({
        authUid: "bob",
        referrerUid: "alice",
        refereeUid: "bob",
        referralId: "ref_alice_bob",
        referral: { referrerUid: "alice", refereeUid: "bob", status: "pending" },
      }),
      false,
    );
    assert.equal(
      canCreateReferralReward({
        authUid: "alice",
        referrerUid: "alice",
        refereeUid: "alice",
        referralId: "ref_alice_alice",
        referral: { referrerUid: "alice", refereeUid: "alice", status: "pending" },
      }),
      false,
    );
    assert.equal(
      canCreateReferralReward({
        authUid: "alice",
        referrerUid: "alice",
        refereeUid: "bob",
        referralId: "ref_alice_bob",
        referral: { referrerUid: "alice", refereeUid: "bob", status: "pending" },
      }),
      true,
    );
  });
});

describe("shared task membership", () => {
  it("creates tasks with only the creator as a member", () => {
    assert.equal(
      canCreateSharedTask({
        authUid: "alice",
        createdBy: "alice",
        memberUids: ["alice"],
        inviteeUid: "bob",
        creatorFriendUids: ["bob"],
      }),
      true,
    );
    assert.equal(
      canCreateSharedTask({
        authUid: "alice",
        createdBy: "alice",
        memberUids: ["alice", "bob"],
        inviteeUid: "bob",
        creatorFriendUids: ["bob"],
      }),
      false,
    );
    assert.equal(
      canCreateSharedTask({
        authUid: "alice",
        createdBy: "alice",
        memberUids: ["alice"],
        inviteeUid: "eve",
        creatorFriendUids: ["bob"],
      }),
      false,
    );
  });

  it("lets the invitee add only themselves on accept", () => {
    const existing = { memberUids: ["alice"], inviteeUid: "bob", status: "pending", createdBy: "alice" };
    assert.equal(
      canUpdateSharedTaskMembers({
        authUid: "bob",
        existing,
        next: { memberUids: ["alice", "bob"], inviteeUid: "bob", status: "active", createdBy: "alice" },
      }),
      true,
    );
    assert.equal(
      canUpdateSharedTaskMembers({
        authUid: "bob",
        existing,
        next: { memberUids: ["alice", "bob", "eve"], inviteeUid: "bob", status: "active", createdBy: "alice" },
      }),
      false,
    );
    assert.equal(
      canUpdateSharedTaskMembers({
        authUid: "alice",
        existing: { ...existing, memberUids: ["alice", "bob"], status: "active" },
        next: {
          memberUids: ["alice", "bob", "eve"],
          inviteeUid: "bob",
          status: "active",
          createdBy: "alice",
        },
      }),
      false,
    );
  });
});

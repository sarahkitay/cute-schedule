import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthApp, initFirebase } from "../firebase.js";
import { isBlocklistedUserName } from "../cloudPersist.js";
import {
  defaultSocialPrivacy,
  friendshipDocId,
  generateReferralCode,
  normalizeFriendVisibility,
  normalizeSocialPrivacy,
} from "./socialModel.js";
import { computeReferralProUntilIso, latestReferralProUntilIso, setReferralProUntilIso } from "./referralEntitlement.js";
import {
  CLOUD_ACCOUNT_UNAVAILABLE,
  CLOUD_CONNECT_FAILED,
  sanitizeCloudUserError,
} from "../cloudUserMessages.js";

function db() {
  const { db: firestore } = initFirebase();
  return firestore;
}

function requireDb() {
  const d = db();
  if (!d) throw new Error(CLOUD_ACCOUNT_UNAVAILABLE);
  return d;
}

function inviteCodeRef(firestore, code) {
  return doc(firestore, "invite_codes", String(code || "").trim().toUpperCase());
}

async function syncInviteCodeDoc(firestore, uid, { referralCode, displayName = "", allowFriendRequests = true } = {}) {
  const code = String(referralCode || "").trim().toUpperCase();
  if (!uid || !code) return;
  await setDoc(inviteCodeRef(firestore, code), {
    uid,
    displayName: String(displayName || "").slice(0, 80),
    allowFriendRequests: allowFriendRequests !== false,
    updatedAt: serverTimestamp(),
  });
}

function mapFirestoreError(err) {
  const code = err?.code || "";
  if (code === "permission-denied") {
    return new Error(
      "Couldn't connect to friends. Sign in with your cloud account, then try again. If this keeps happening, cloud rules may need updating.",
    );
  }
  return new Error(sanitizeCloudUserError(err, CLOUD_CONNECT_FAILED));
}

/** Wait for Firebase Auth so Firestore requests include request.auth. */
export async function requireAuthUid(hintUid = null) {
  const auth = getAuthApp();
  if (!auth) throw new Error(CLOUD_ACCOUNT_UNAVAILABLE);
  if (auth.currentUser?.uid) {
    const uid = auth.currentUser.uid;
    if (hintUid && hintUid !== uid) {
      console.warn("[social] using auth uid", uid, "not hint", hintUid);
    }
    return uid;
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub();
      reject(new Error("Still signing in to cloud. Wait a moment, then try again."));
    }, 12000);
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user?.uid) return;
      clearTimeout(timeout);
      unsub();
      resolve(user.uid);
    });
  });
}

// --- User profiles ---

export async function ensureUserProfile(uid, { displayName = "" } = {}) {
  const ownerUid = await requireAuthUid(uid);
  const firestore = requireDb();
  const ref = doc(firestore, "user_profiles", ownerUid);
  const safeDisplayName = isBlocklistedUserName(displayName) ? "" : String(displayName || "").trim();
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const patch = {};
      const existingName = String(data.displayName || "").trim();
      if (safeDisplayName && (!existingName || isBlocklistedUserName(existingName))) {
        patch.displayName = safeDisplayName;
      }
      if (!data.referralCode) patch.referralCode = generateReferralCode(ownerUid);
      if (Object.keys(patch).length) {
        patch.updatedAt = serverTimestamp();
        await updateDoc(ref, patch);
      }
      const merged = { id: ownerUid, ...data, ...patch };
      const privacy = normalizeSocialPrivacy(merged.privacy);
      await syncInviteCodeDoc(firestore, ownerUid, {
        referralCode: merged.referralCode,
        displayName: merged.displayName,
        allowFriendRequests: privacy.allowFriendRequests,
      });
      return merged;
    }
    const referralCode = generateReferralCode(ownerUid);
    const profile = {
      displayName: safeDisplayName || "ProYou member",
      referralCode,
      friendUids: [],
      blockedUids: [],
      privacy: defaultSocialPrivacy(),
      friendVisibility: {},
      referralProUntilIso: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, profile);
    await syncInviteCodeDoc(firestore, ownerUid, {
      referralCode,
      displayName: profile.displayName,
      allowFriendRequests: true,
    });
    return { id: ownerUid, ...profile };
  } catch (e) {
    throw mapFirestoreError(e);
  }
}

export async function loadUserProfile(uid) {
  if (!uid) return null;
  const firestore = requireDb();
  const snap = await getDoc(doc(firestore, "user_profiles", uid));
  if (!snap.exists()) return null;
  return { id: uid, ...snap.data() };
}

export async function updateUserProfile(uid, patch) {
  if (!uid) return;
  const ownerUid = await requireAuthUid(uid);
  const firestore = requireDb();
  const next = { ...patch };
  delete next.referralProUntilIso;
  delete next.friendUids;
  await updateDoc(doc(firestore, "user_profiles", ownerUid), { ...next, updatedAt: serverTimestamp() });
  if (next.displayName != null || next.privacy || next.referralCode) {
    const snap = await getDoc(doc(firestore, "user_profiles", ownerUid));
    const data = snap.data() || {};
    const privacy = normalizeSocialPrivacy(data.privacy);
    await syncInviteCodeDoc(firestore, ownerUid, {
      referralCode: data.referralCode,
      displayName: data.displayName,
      allowFriendRequests: privacy.allowFriendRequests,
    });
  }
}

export async function findUserByReferralCode(code) {
  await requireAuthUid();
  const c = (code || "").trim().toUpperCase();
  if (!c) return null;
  const firestore = requireDb();
  try {
    const snap = await getDoc(inviteCodeRef(firestore, c));
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    if (!data.uid) return null;
    return {
      id: data.uid,
      displayName: data.displayName || "ProYou member",
      referralCode: c,
      privacy: { allowFriendRequests: data.allowFriendRequests !== false },
    };
  } catch (e) {
    throw mapFirestoreError(e);
  }
}

// --- Friend requests ---

/** Enter a PY code → instant friends (no request flow). */
export async function addFriendByCode(authUid, code) {
  const uid = await requireAuthUid(authUid);
  const target = await findUserByReferralCode(code);
  if (!target) throw new Error("No user found with that code.");
  if (target.id === uid) throw new Error("That is your own code.");
  const myProfile = (await loadUserProfile(uid)) || {};
  const theirPrivacy = normalizeSocialPrivacy(target.privacy);
  if (!theirPrivacy.allowFriendRequests) {
    throw new Error("This user is not accepting new friends right now.");
  }
  if ((myProfile.blockedUids || []).includes(target.id)) throw new Error("User is blocked.");
  if ((target.blockedUids || []).includes(uid)) throw new Error("Could not add this friend.");
  if ((myProfile.friendUids || []).includes(target.id)) throw new Error("You're already friends.");

  const firestore = requireDb();
  for (const id of [`${uid}_${target.id}`, `${target.id}_${uid}`]) {
    try {
      const ref = doc(firestore, "friend_requests", id);
      const snap = await getDoc(ref);
      if (snap.exists()) await deleteDoc(ref);
    } catch {
      /* ignore cleanup */
    }
  }
  await createFriendship(uid, target.id, { inviteCode: String(code).trim().toUpperCase() });
  return target;
}

export async function sendFriendRequest(fromUid, toUid) {
  const authUid = await requireAuthUid(fromUid);
  if (!authUid || !toUid || authUid === toUid) throw new Error("Invalid friend request.");
  const firestore = requireDb();
  const id = `${authUid}_${toUid}`;
  try {
    const existing = await getDoc(doc(firestore, "friend_requests", id));
    if (existing.exists() && existing.data()?.status === "pending") {
      throw new Error("Request already sent.");
    }
    await setDoc(doc(firestore, "friend_requests", id), {
      fromUid: authUid,
      toUid,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    if (e?.message === "Request already sent.") throw e;
    throw mapFirestoreError(e);
  }
}

export async function listIncomingFriendRequests(uid) {
  const firestore = requireDb();
  const q = query(
    collection(firestore, "friend_requests"),
    where("toUid", "==", uid),
    where("status", "==", "pending"),
  );
  const res = await getDocs(q);
  return res.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listOutgoingFriendRequests(uid) {
  const firestore = requireDb();
  const q = query(
    collection(firestore, "friend_requests"),
    where("fromUid", "==", uid),
    where("status", "==", "pending"),
  );
  const res = await getDocs(q);
  return res.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function respondFriendRequest(requestId, accept) {
  const authUid = await requireAuthUid();
  const firestore = requireDb();
  const ref = doc(firestore, "friend_requests", requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Request not found.");
  const data = snap.data();
  if (data.toUid !== authUid) throw new Error("Only the recipient can respond.");
  const status = accept ? "accepted" : "declined";
  await updateDoc(ref, { status, updatedAt: serverTimestamp() });
  if (accept && data.fromUid && data.toUid) {
    await createFriendship(data.fromUid, data.toUid);
  }
}

async function createFriendship(uidA, uidB, { inviteCode } = {}) {
  const firestore = requireDb();
  const id = friendshipDocId(uidA, uidB);
  const payload = {
    memberUids: [uidA, uidB].sort(),
    createdAt: serverTimestamp(),
  };
  if (inviteCode) payload.inviteCode = String(inviteCode).trim().toUpperCase();
  await setDoc(doc(firestore, "friendships", id), payload);
  await updateDoc(doc(firestore, "user_profiles", uidA), {
    friendUids: arrayUnion(uidB),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(firestore, "user_profiles", uidB), {
    friendUids: arrayUnion(uidA),
    updatedAt: serverTimestamp(),
  });
}

export async function removeFriendship(myUid, friendUid) {
  const firestore = requireDb();
  const id = friendshipDocId(myUid, friendUid);
  await deleteDoc(doc(firestore, "friendships", id));
  await updateDoc(doc(firestore, "user_profiles", myUid), {
    friendUids: arrayRemove(friendUid),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(firestore, "user_profiles", friendUid), {
    friendUids: arrayRemove(myUid),
    updatedAt: serverTimestamp(),
  });
}

export async function blockUser(myUid, targetUid) {
  await removeFriendship(myUid, targetUid);
  await updateDoc(doc(requireDb(), "user_profiles", myUid), {
    blockedUids: arrayUnion(targetUid),
    updatedAt: serverTimestamp(),
  });
}

export async function setFriendVisibility(myUid, friendUid, visibility) {
  const norm = normalizeFriendVisibility(visibility);
  await updateDoc(doc(requireDb(), "user_profiles", myUid), {
    [`friendVisibility.${friendUid}`]: norm,
    updatedAt: serverTimestamp(),
  });
}

// --- Share snapshots ---

export async function publishShareSnapshot(uid, snapshot) {
  if (!uid) return;
  const firestore = requireDb();
  if (!snapshot) {
    await deleteDoc(doc(firestore, "share_snapshots", uid)).catch(() => {});
    return;
  }
  await setDoc(doc(firestore, "share_snapshots", uid), {
    ...snapshot,
    ownerUid: uid,
    updatedAt: serverTimestamp(),
  });
}

export async function loadFriendShareSnapshot(friendUid) {
  const firestore = requireDb();
  const snap = await getDoc(doc(firestore, "share_snapshots", friendUid));
  if (!snap.exists()) return null;
  return snap.data();
}

// --- Shared tasks ---

export async function createSharedTask(creatorUid, task) {
  const uid = await requireAuthUid(creatorUid);
  const firestore = requireDb();
  const rawInvitee = task.inviteeUid || (task.memberUids || []).find((id) => id && id !== uid) || null;
  const inviteeUid = rawInvitee && rawInvitee !== uid ? rawInvitee : null;

  if (inviteeUid) {
    const myProfile = await loadUserProfile(uid);
    if (!(myProfile?.friendUids || []).includes(inviteeUid)) {
      throw new Error("You can only share tasks with friends.");
    }
    const target = await loadUserProfile(inviteeUid);
    const priv = normalizeSocialPrivacy(target?.privacy);
    if (!priv.allowSharedTaskInvites) {
      throw new Error("This friend is not accepting shared task invites.");
    }
  }

  const id = `st_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const members = [uid];
  const status = inviteeUid ? "pending" : "active";
  const docData = {
    title: (task.title || "").trim().slice(0, 200),
    dueAt: task.dueAt || null,
    remindAt: task.remindAt || null,
    assignees: inviteeUid ? [uid, inviteeUid] : task.assignees || members,
    memberUids: members,
    inviteeUid: inviteeUid || null,
    status,
    scheduleOnAccept: task.scheduleOnAccept !== false,
    creatorDisplayName: (task.creatorDisplayName || "").trim().slice(0, 80) || null,
    createdBy: uid,
    recurrence: task.recurrence || null,
    completions: {},
    comments: [],
    reactions: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(firestore, "shared_tasks", id), docData);
  return { id, ...docData };
}

export async function listSharedTasksForUser(uid) {
  const firestore = requireDb();
  const [asMember, asInvitee] = await Promise.all([
    getDocs(query(collection(firestore, "shared_tasks"), where("memberUids", "array-contains", uid))),
    getDocs(query(collection(firestore, "shared_tasks"), where("inviteeUid", "==", uid))),
  ]);
  const byId = new Map();
  for (const d of [...asMember.docs, ...asInvitee.docs]) {
    byId.set(d.id, { id: d.id, ...d.data() });
  }
  return [...byId.values()];
}

export async function respondSharedTaskInvite(taskId, uid, accept) {
  const authUid = await requireAuthUid(uid);
  const firestore = requireDb();
  const ref = doc(firestore, "shared_tasks", taskId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Task invite not found.");
  const data = snap.data();
  if (data.inviteeUid !== authUid || data.status !== "pending") {
    throw new Error("This invite is no longer available.");
  }
  if (accept) {
    await updateDoc(ref, {
      status: "active",
      memberUids: arrayUnion(authUid),
      updatedAt: serverTimestamp(),
    });
    return { id: taskId, ...data, status: "active", accepted: true };
  }
  await updateDoc(ref, { status: "declined", updatedAt: serverTimestamp() });
  return { id: taskId, ...data, status: "declined", accepted: false };
}

export async function updateSharedTask(taskId, patch) {
  await updateDoc(doc(requireDb(), "shared_tasks", taskId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function toggleSharedTaskComplete(taskId, uid, done) {
  const firestore = requireDb();
  const ref = doc(firestore, "shared_tasks", taskId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Task not found.");
  const completions = { ...(snap.data().completions || {}), [uid]: !!done };
  await updateDoc(ref, { completions, updatedAt: serverTimestamp() });
}

export async function addSharedTaskComment(taskId, uid, text, displayName) {
  const firestore = requireDb();
  const ref = doc(firestore, "shared_tasks", taskId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Task not found.");
  const comments = [...(snap.data().comments || [])];
  comments.push({
    id: `c_${Date.now()}`,
    uid,
    displayName: displayName || "Friend",
    text: (text || "").trim().slice(0, 280),
    at: new Date().toISOString(),
  });
  await updateDoc(ref, { comments: comments.slice(-50), updatedAt: serverTimestamp() });
}

export async function addSharedTaskReaction(taskId, uid, emoji) {
  const firestore = requireDb();
  const ref = doc(firestore, "shared_tasks", taskId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Task not found.");
  const reactions = { ...(snap.data().reactions || {}) };
  reactions[uid] = emoji;
  await updateDoc(ref, { reactions, updatedAt: serverTimestamp() });
}

// --- Referrals ---

export async function recordReferralSignup(refereeUid, referralCode) {
  const referrer = await findUserByReferralCode(referralCode);
  if (!referrer || referrer.id === refereeUid) return null;
  const firestore = requireDb();
  const id = `ref_${referrer.id}_${refereeUid}`;
  const existing = await getDoc(doc(firestore, "referrals", id));
  if (existing.exists()) return { id, ...existing.data() };
  const data = {
    referrerUid: referrer.id,
    refereeUid,
    referralCode: referralCode.toUpperCase(),
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(firestore, "referrals", id), data);
  return { id, ...data };
}

/** Grant referral rewards only when signed in as the referrer (Firestore rules). */
export async function processPendingReferralRewardsForReferrer(referrerUid) {
  const uid = await requireAuthUid(referrerUid);
  if (uid !== referrerUid) return;
  const refs = await listReferralsForUser(uid);
  for (const r of refs) {
    if (r.status === "pending" && r.refereeUid) {
      await grantReferralReward(uid, r.id, r.refereeUid);
    }
  }
}

export async function listReferralsForUser(referrerUid) {
  const firestore = requireDb();
  const q = query(collection(firestore, "referrals"), where("referrerUid", "==", referrerUid));
  const res = await getDocs(q);
  return res.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listReferralsAsReferee(refereeUid) {
  const firestore = requireDb();
  const q = query(collection(firestore, "referrals"), where("refereeUid", "==", refereeUid));
  const res = await getDocs(q);
  return res.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function qualifyReferral(referralId, { refereeBecamePro = false } = {}) {
  const firestore = requireDb();
  const ref = doc(firestore, "referrals", referralId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if (data.status === "rewarded") return;
  await updateDoc(ref, {
    status: refereeBecamePro ? "qualified" : "pending",
    qualifiedAt: refereeBecamePro ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
  if (refereeBecamePro && data.referrerUid) {
    await grantReferralReward(data.referrerUid, referralId, data.refereeUid);
  }
}

async function grantReferralReward(referrerUid, referralId, refereeUid) {
  const authUid = getAuthApp()?.currentUser?.uid;
  if (!authUid || authUid !== referrerUid) return;
  const firestore = requireDb();
  const rewardRef = doc(firestore, "referral_rewards", `${referralId}_reward`);
  const existingReward = await getDoc(rewardRef);
  if (existingReward.exists()) return;

  const referrerProfile = await loadUserProfile(referrerUid);
  const untilIso = computeReferralProUntilIso(referrerProfile?.referralProUntilIso);

  await setDoc(rewardRef, {
    referrerUid,
    refereeUid,
    referralId,
    rewardType: "pro_month_internal",
    status: "granted",
    proUntilIso: untilIso,
    note: "Internal 30-day Pro access for successful invite signup.",
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(firestore, "referrals", referralId), {
    status: "rewarded",
    qualifiedAt: serverTimestamp(),
    rewardedAt: serverTimestamp(),
  });
}

export async function listReferralRewards(referrerUid) {
  const firestore = requireDb();
  const q = query(collection(firestore, "referral_rewards"), where("referrerUid", "==", referrerUid));
  const res = await getDocs(q);
  return res.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function syncReferralProFromProfile(uid) {
  const [profile, rewards] = await Promise.all([
    loadUserProfile(uid).catch(() => null),
    listReferralRewards(uid).catch(() => []),
  ]);
  const until = latestReferralProUntilIso([
    profile?.referralProUntilIso,
    ...(rewards || []).map((r) => r.proUntilIso),
  ]);
  if (until) setReferralProUntilIso(until);
}

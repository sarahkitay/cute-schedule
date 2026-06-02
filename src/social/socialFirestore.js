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
import {
  defaultSocialPrivacy,
  friendshipDocId,
  generateReferralCode,
  normalizeFriendVisibility,
  normalizeSocialPrivacy,
} from "./socialModel.js";
import { computeReferralProUntilIso, setReferralProUntilIso } from "./referralEntitlement.js";

function db() {
  const { db: firestore } = initFirebase();
  return firestore;
}

function requireDb() {
  const d = db();
  if (!d) throw new Error("Cloud sync is not configured.");
  return d;
}

function mapFirestoreError(err) {
  const code = err?.code || "";
  if (code === "permission-denied") {
    return new Error(
      "Cloud permission denied. Deploy Firestore rules for friends and invites (firebase deploy --only firestore). See docs/SOCIAL_FIRESTORE_DEPLOY.md.",
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}

/** Wait for Firebase Auth so Firestore requests include request.auth. */
export async function requireAuthUid(hintUid = null) {
  const auth = getAuthApp();
  if (!auth) throw new Error("Cloud sync is not configured.");
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
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const patch = {};
      if (displayName && !data.displayName) patch.displayName = displayName;
      if (!data.referralCode) patch.referralCode = generateReferralCode(ownerUid);
      if (Object.keys(patch).length) {
        patch.updatedAt = serverTimestamp();
        await updateDoc(ref, patch);
        return { id: ownerUid, ...data, ...patch };
      }
      return { id: ownerUid, ...data };
    }
    const referralCode = generateReferralCode(ownerUid);
    const profile = {
      displayName: displayName || "ProYou member",
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
  const firestore = requireDb();
  await updateDoc(doc(firestore, "user_profiles", uid), { ...patch, updatedAt: serverTimestamp() });
}

export async function findUserByReferralCode(code) {
  const c = (code || "").trim().toUpperCase();
  if (!c) return null;
  const firestore = requireDb();
  const q = query(collection(firestore, "user_profiles"), where("referralCode", "==", c));
  const res = await getDocs(q);
  if (res.empty) return null;
  const d = res.docs[0];
  return { id: d.id, ...d.data() };
}

// --- Friend requests ---

export async function sendFriendRequest(fromUid, toUid) {
  if (!fromUid || !toUid || fromUid === toUid) throw new Error("Invalid friend request.");
  const firestore = requireDb();
  const id = `${fromUid}_${toUid}`;
  const existing = await getDoc(doc(firestore, "friend_requests", id));
  if (existing.exists() && existing.data()?.status === "pending") {
    throw new Error("Request already sent.");
  }
  await setDoc(doc(firestore, "friend_requests", id), {
    fromUid,
    toUid,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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
  const firestore = requireDb();
  const ref = doc(firestore, "friend_requests", requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Request not found.");
  const data = snap.data();
  const status = accept ? "accepted" : "declined";
  await updateDoc(ref, { status, updatedAt: serverTimestamp() });
  if (accept && data.fromUid && data.toUid) {
    await createFriendship(data.fromUid, data.toUid);
  }
}

async function createFriendship(uidA, uidB) {
  const firestore = requireDb();
  const id = friendshipDocId(uidA, uidB);
  await setDoc(doc(firestore, "friendships", id), {
    memberUids: [uidA, uidB].sort(),
    createdAt: serverTimestamp(),
  });
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
  const firestore = requireDb();
  const id = `st_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const members = [...new Set([creatorUid, ...(task.memberUids || [])])].filter(Boolean);
  const docData = {
    title: (task.title || "").trim().slice(0, 200),
    dueAt: task.dueAt || null,
    remindAt: task.remindAt || null,
    assignees: task.assignees || members,
    memberUids: members,
    createdBy: creatorUid,
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
  const q = query(collection(firestore, "shared_tasks"), where("memberUids", "array-contains", uid));
  const res = await getDocs(q);
  return res.docs.map((d) => ({ id: d.id, ...d.data() }));
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
  await updateDoc(doc(firestore, "user_profiles", referrerUid), {
    referralProUntilIso: untilIso,
    updatedAt: serverTimestamp(),
  });
}

export async function listReferralRewards(referrerUid) {
  const firestore = requireDb();
  const q = query(collection(firestore, "referral_rewards"), where("referrerUid", "==", referrerUid));
  const res = await getDocs(q);
  return res.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function syncReferralProFromProfile(uid) {
  const profile = await loadUserProfile(uid);
  if (profile?.referralProUntilIso) {
    setReferralProUntilIso(profile.referralProUntilIso);
  }
}

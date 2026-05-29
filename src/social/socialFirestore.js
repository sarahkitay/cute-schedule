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
import { initFirebase } from "../firebase.js";
import {
  defaultSocialPrivacy,
  friendshipDocId,
  generateReferralCode,
  normalizeFriendVisibility,
  normalizeSocialPrivacy,
} from "./socialModel.js";
import { grantReferralProDays, setReferralProUntilIso } from "./referralEntitlement.js";

function db() {
  const { db: firestore } = initFirebase();
  return firestore;
}

function requireDb() {
  const d = db();
  if (!d) throw new Error("Cloud sync is not configured.");
  return d;
}

// ——— User profiles ———

export async function ensureUserProfile(uid, { displayName = "" } = {}) {
  if (!uid) return null;
  const firestore = requireDb();
  const ref = doc(firestore, "user_profiles", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    if (displayName && !data.displayName) {
      await updateDoc(ref, { displayName, updatedAt: serverTimestamp() });
    }
    return { id: uid, ...data };
  }
  const referralCode = generateReferralCode(uid);
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
  return { id: uid, ...profile };
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

// ——— Friend requests ———

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

// ——— Share snapshots ———

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

// ——— Shared tasks ———

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

// ——— Referrals ———

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
  const until = grantReferralProDays();
  const firestore = requireDb();
  await setDoc(doc(firestore, "referral_rewards", `${referralId}_reward`), {
    referrerUid,
    refereeUid,
    referralId,
    rewardType: "pro_month_internal",
    status: "granted",
    proUntilIso: until.toISOString(),
    note: "Fulfill via App Store offer code when available. Internal 30-day Pro access granted.",
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(firestore, "referrals", referralId), {
    status: "rewarded",
    rewardedAt: serverTimestamp(),
  });
  await updateDoc(doc(firestore, "user_profiles", referrerUid), {
    referralProUntilIso: until.toISOString(),
    updatedAt: serverTimestamp(),
  });
  setReferralProUntilIso(until.toISOString());
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

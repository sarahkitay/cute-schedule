import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isFirebaseEnabled } from "../firebase.js";
import {
  clearPendingReferralCode,
  defaultSocialPrivacy,
  filterSnapshotForFriend,
  getPendingReferralCode,
  normalizeSocialPrivacy,
} from "./socialModel.js";
import { getReferralProGrant, grantReferralProDays } from "./referralEntitlement.js";
import { buildShareSnapshot } from "./socialSnapshot.js";
import * as sf from "./socialFirestore.js";

const SocialContext = createContext(null);

/**
 * @param {{
 *   children: React.ReactNode,
 *   firebaseUid?: string | null,
 *   displayName?: string,
 *   isPro?: boolean,
 *   getShareSnapshotInput?: () => object | null,
 * }} props
 */
export function SocialProvider({
  children,
  firebaseUid = null,
  displayName = "",
  isPro = false,
  getShareSnapshotInput = null,
}) {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [sharedTasks, setSharedTasks] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [referralRewards, setReferralRewards] = useState([]);
  const [error, setError] = useState("");

  const cloudOn = isFirebaseEnabled() && Boolean(firebaseUid);

  const refresh = useCallback(async () => {
    if (!cloudOn) {
      setProfile(null);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setSharedTasks([]);
      setReferrals([]);
      setReferralRewards([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const p = await sf.ensureUserProfile(firebaseUid, { displayName });
      setProfile(p);
      await sf.syncReferralProFromProfile(firebaseUid);
      const [inc, out, tasks, refsAsReferrer, refsAsReferee, rewards] = await Promise.all([
        sf.listIncomingFriendRequests(firebaseUid),
        sf.listOutgoingFriendRequests(firebaseUid),
        sf.listSharedTasksForUser(firebaseUid),
        sf.listReferralsForUser(firebaseUid),
        sf.listReferralsAsReferee(firebaseUid),
        sf.listReferralRewards(firebaseUid),
      ]);
      const refs = [...refsAsReferrer, ...refsAsReferee.filter((r) => !refsAsReferrer.some((x) => x.id === r.id))];
      setIncomingRequests(inc);
      setOutgoingRequests(out);
      setSharedTasks(tasks);
      setReferrals(refs);
      setReferralRewards(rewards);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [cloudOn, firebaseUid, displayName]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!cloudOn) return;
    const code = getPendingReferralCode();
    if (!code) return;
    void (async () => {
      try {
        const recorded = await sf.recordReferralSignup(firebaseUid, code);
        if (recorded) grantReferralProDays();
        clearPendingReferralCode();
        await refresh();
      } catch {
        /* ignore duplicate */
      }
    })();
  }, [cloudOn, firebaseUid, refresh]);

  useEffect(() => {
    if (!cloudOn || !getShareSnapshotInput) return;
    const publish = async () => {
      try {
        const input = getShareSnapshotInput();
        if (!input) {
          await sf.publishShareSnapshot(firebaseUid, null);
          return;
        }
        const privacy = normalizeSocialPrivacy(profile?.privacy || defaultSocialPrivacy());
        const snapshot = buildShareSnapshot({
          ...input,
          sharePermissions: privacy.sharePermissions,
        });
        await sf.publishShareSnapshot(firebaseUid, snapshot);
      } catch {
        /* non-fatal */
      }
    };
    void publish();
    const id = setInterval(() => void publish(), 5 * 60_000);
    return () => clearInterval(id);
  }, [cloudOn, firebaseUid, getShareSnapshotInput, profile?.privacy]);

  useEffect(() => {
    if (!cloudOn || !isPro) return;
    void (async () => {
      const pendingAsReferee = referrals.filter(
        (r) => r.status === "pending" && r.refereeUid === firebaseUid,
      );
      for (const r of pendingAsReferee) {
        try {
          await sf.qualifyReferral(r.id, { refereeBecamePro: true });
        } catch {
          /* ignore */
        }
      }
      if (pendingAsReferee.length) await refresh();
    })();
  }, [cloudOn, isPro, referrals, refresh, firebaseUid]);

  const inviteLink = useMemo(() => {
    const code = profile?.referralCode || "";
    if (!code) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const base = import.meta.env.BASE_URL || "/";
    const path = base.endsWith("/") ? base : `${base}/`;
    return `${origin}${path}?ref=${encodeURIComponent(code)}`;
  }, [profile?.referralCode]);

  const friendProfiles = useMemo(() => {
    const uids = (profile?.friendUids || []).filter((id) => !(profile?.blockedUids || []).includes(id));
    return uids;
  }, [profile]);

  const sendFriendRequestByCode = useCallback(
    async (code) => {
      const target = await sf.findUserByReferralCode(code);
      if (!target) throw new Error("No user found with that code.");
      if (target.id === firebaseUid) throw new Error("That is your own code.");
      if ((profile?.blockedUids || []).includes(target.id)) throw new Error("User is blocked.");
      await sf.sendFriendRequest(firebaseUid, target.id);
      await refresh();
    },
    [firebaseUid, profile, refresh],
  );

  const respondRequest = useCallback(
    async (requestId, accept) => {
      await sf.respondFriendRequest(requestId, accept);
      await refresh();
    },
    [refresh],
  );

  const removeFriend = useCallback(
    async (friendUid) => {
      await sf.removeFriendship(firebaseUid, friendUid);
      await refresh();
    },
    [firebaseUid, refresh],
  );

  const blockFriend = useCallback(
    async (friendUid) => {
      await sf.blockUser(firebaseUid, friendUid);
      await refresh();
    },
    [firebaseUid, refresh],
  );

  const updatePrivacy = useCallback(
    async (privacy) => {
      await sf.updateUserProfile(firebaseUid, { privacy: normalizeSocialPrivacy(privacy) });
      await refresh();
    },
    [firebaseUid, refresh],
  );

  const setFriendVisibilityFor = useCallback(
    async (friendUid, visibility) => {
      await sf.setFriendVisibility(firebaseUid, friendUid, visibility);
      await refresh();
    },
    [firebaseUid, refresh],
  );

  const loadFriendProgress = useCallback(
    async (friendUid) => {
      const raw = await sf.loadFriendShareSnapshot(friendUid);
      const vis = profile?.friendVisibility?.[friendUid];
      const seeAll = {
        scheduleToday: true,
        habitStreaks: true,
        completedTasks: true,
        monthlyGoals: true,
        fitness: true,
        finance: true,
      };
      return filterSnapshotForFriend(raw, seeAll, vis);
    },
    [profile],
  );

  const createSharedTask = useCallback(
    async (task) => {
      const created = await sf.createSharedTask(firebaseUid, task);
      await refresh();
      return created;
    },
    [firebaseUid, refresh],
  );

  const completeSharedTask = useCallback(
    async (taskId, done) => {
      await sf.toggleSharedTaskComplete(taskId, firebaseUid, done);
      await refresh();
    },
    [firebaseUid, refresh],
  );

  const commentSharedTask = useCallback(
    async (taskId, text) => {
      await sf.addSharedTaskComment(taskId, firebaseUid, text, displayName);
      await refresh();
    },
    [firebaseUid, displayName, refresh],
  );

  const reactSharedTask = useCallback(
    async (taskId, emoji) => {
      await sf.addSharedTaskReaction(taskId, firebaseUid, emoji);
      await refresh();
    },
    [firebaseUid, refresh],
  );

  const referralGrant = getReferralProGrant();

  const value = {
    cloudOn,
    loading,
    error,
    profile,
    incomingRequests,
    outgoingRequests,
    sharedTasks,
    referrals,
    referralRewards,
    inviteLink,
    referralCode: profile?.referralCode || "",
    friendUids: friendProfiles,
    referralGrant,
    refresh,
    sendFriendRequestByCode,
    respondRequest,
    removeFriend,
    blockFriend,
    updatePrivacy,
    setFriendVisibilityFor,
    loadFriendProgress,
    loadUserProfile: sf.loadUserProfile,
    createSharedTask,
    completeSharedTask,
    commentSharedTask,
    reactSharedTask,
  };

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) {
    return {
      cloudOn: false,
      loading: false,
      profile: null,
      incomingRequests: [],
      outgoingRequests: [],
      sharedTasks: [],
      referrals: [],
      referralRewards: [],
      inviteLink: "",
      referralCode: "",
      friendUids: [],
      referralGrant: { active: false, until: null, daysLeft: 0 },
      error: "",
      refresh: () => {},
      sendFriendRequestByCode: async () => {},
      respondRequest: async () => {},
      removeFriend: async () => {},
      blockFriend: async () => {},
      updatePrivacy: async () => {},
      setFriendVisibilityFor: async () => {},
      loadFriendProgress: async () => null,
      loadUserProfile: async () => null,
      createSharedTask: async () => {},
      completeSharedTask: async () => {},
      commentSharedTask: async () => {},
      reactSharedTask: async () => {},
    };
  }
  return ctx;
}

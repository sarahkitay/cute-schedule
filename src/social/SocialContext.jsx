import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAuthApp, isFirebaseEnabled } from "../firebase.js";
import {
  clearPendingReferralCode,
  defaultSocialPrivacy,
  filterSnapshotForFriend,
  getPendingReferralCode,
  normalizeSocialPrivacy,
} from "./socialModel.js";
import { getReferralProGrant, grantReferralProDays, setReferralProUntilIso } from "./referralEntitlement.js";
import { buildReferralSharePayload } from "./referralLinks.js";
import { loadCachedReferralCode, saveCachedReferralCode } from "./referralCodeCache.js";
import { buildShareSnapshot } from "./socialSnapshot.js";
import * as sf from "./socialFirestore.js";

function resolveFirebaseUid(propUid) {
  return getAuthApp()?.currentUser?.uid || propUid || null;
}

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

  const resolvedUid = resolveFirebaseUid(firebaseUid);
  const cloudOn = isFirebaseEnabled() && Boolean(resolvedUid);

  const refresh = useCallback(async () => {
    if (!cloudOn) {
      setProfile(null);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setSharedTasks([]);
      setReferrals([]);
      setReferralRewards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const p = await sf.ensureUserProfile(resolvedUid, { displayName });
      setProfile(p);
      const profileUid = p?.id || resolvedUid;
      if (p?.referralCode && profileUid) saveCachedReferralCode(profileUid, p.referralCode);
      await sf.processPendingReferralRewardsForReferrer(profileUid);
      await sf.syncReferralProFromProfile(profileUid);
      const synced = await sf.loadUserProfile(profileUid);
      if (synced?.referralProUntilIso) {
        setReferralProUntilIso(synced.referralProUntilIso);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("proyou:referral-pro-updated"));
        }
      }
      const [inc, out, tasks, refsAsReferrer, refsAsReferee, rewards] = await Promise.all([
        sf.listIncomingFriendRequests(resolvedUid),
        sf.listOutgoingFriendRequests(resolvedUid),
        sf.listSharedTasksForUser(resolvedUid),
        sf.listReferralsForUser(resolvedUid),
        sf.listReferralsAsReferee(resolvedUid),
        sf.listReferralRewards(resolvedUid),
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
  }, [cloudOn, resolvedUid, displayName]);

  const ensureReferralCodeReady = useCallback(async () => {
    if (!cloudOn || !resolvedUid) {
      throw new Error("Sign in with cloud sync to get an invite code.");
    }
    setError("");
    setLoading(true);
    try {
      const p = await sf.ensureUserProfile(resolvedUid, { displayName });
      if (!p?.referralCode) {
        throw new Error("Could not create your invite code. Try again in a moment.");
      }
      setProfile(p);
      const profileUid = p.id || resolvedUid;
      if (profileUid) saveCachedReferralCode(profileUid, p.referralCode);
      return p.referralCode;
    } catch (e) {
      const msg = e?.message || String(e);
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [cloudOn, resolvedUid, displayName]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!cloudOn) return;
    const code = getPendingReferralCode();
    if (!code) return;
    void (async () => {
      try {
        const recorded = await sf.recordReferralSignup(resolvedUid, code);
        if (recorded) grantReferralProDays();
        clearPendingReferralCode();
        await refresh();
      } catch {
        /* ignore duplicate */
      }
    })();
  }, [cloudOn, resolvedUid, refresh]);

  useEffect(() => {
    if (!cloudOn || !getShareSnapshotInput) return;
    const publish = async () => {
      try {
        const input = getShareSnapshotInput();
        if (!input) {
          await sf.publishShareSnapshot(resolvedUid, null);
          return;
        }
        const privacy = normalizeSocialPrivacy(profile?.privacy || defaultSocialPrivacy());
        const snapshot = buildShareSnapshot({
          ...input,
          sharePermissions: privacy.sharePermissions,
        });
        await sf.publishShareSnapshot(resolvedUid, snapshot);
      } catch {
        /* non-fatal */
      }
    };
    void publish();
    const id = setInterval(() => void publish(), 5 * 60_000);
    return () => clearInterval(id);
  }, [cloudOn, resolvedUid, getShareSnapshotInput, profile?.privacy]);

  useEffect(() => {
    if (!cloudOn || !isPro) return;
    void (async () => {
      const pendingAsReferee = referrals.filter(
        (r) => r.status === "pending" && r.refereeUid === resolvedUid,
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
  }, [cloudOn, isPro, referrals, refresh, resolvedUid]);

  const referralCode =
    profile?.referralCode || loadCachedReferralCode(resolvedUid) || "";

  const inviteShare = useMemo(() => {
    if (!referralCode) {
      return { webLink: "", appStoreUrl: "", shareText: "", shareUrl: "" };
    }
    return buildReferralSharePayload(referralCode);
  }, [referralCode]);

  const inviteLink = inviteShare.appStoreUrl || inviteShare.shareUrl;

  const friendProfiles = useMemo(() => {
    const uids = (profile?.friendUids || []).filter((id) => !(profile?.blockedUids || []).includes(id));
    return uids;
  }, [profile]);

  const sendFriendRequestByCode = useCallback(
    async (code) => {
      const target = await sf.findUserByReferralCode(code);
      if (!target) throw new Error("No user found with that code.");
      if (target.id === resolvedUid) throw new Error("That is your own code.");
      if ((profile?.blockedUids || []).includes(target.id)) throw new Error("User is blocked.");
      await sf.sendFriendRequest(resolvedUid, target.id);
      await refresh();
    },
    [resolvedUid, profile, refresh],
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
      await sf.removeFriendship(resolvedUid, friendUid);
      await refresh();
    },
    [resolvedUid, refresh],
  );

  const blockFriend = useCallback(
    async (friendUid) => {
      await sf.blockUser(resolvedUid, friendUid);
      await refresh();
    },
    [resolvedUid, refresh],
  );

  const updatePrivacy = useCallback(
    async (privacy) => {
      await sf.updateUserProfile(resolvedUid, { privacy: normalizeSocialPrivacy(privacy) });
      await refresh();
    },
    [resolvedUid, refresh],
  );

  const setFriendVisibilityFor = useCallback(
    async (friendUid, visibility) => {
      await sf.setFriendVisibility(resolvedUid, friendUid, visibility);
      await refresh();
    },
    [resolvedUid, refresh],
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
      const created = await sf.createSharedTask(resolvedUid, task);
      await refresh();
      return created;
    },
    [resolvedUid, refresh],
  );

  const completeSharedTask = useCallback(
    async (taskId, done) => {
      await sf.toggleSharedTaskComplete(taskId, resolvedUid, done);
      await refresh();
    },
    [resolvedUid, refresh],
  );

  const commentSharedTask = useCallback(
    async (taskId, text) => {
      await sf.addSharedTaskComment(taskId, resolvedUid, text, displayName);
      await refresh();
    },
    [resolvedUid, displayName, refresh],
  );

  const reactSharedTask = useCallback(
    async (taskId, emoji) => {
      await sf.addSharedTaskReaction(taskId, resolvedUid, emoji);
      await refresh();
    },
    [resolvedUid, refresh],
  );

  const referralGrant = getReferralProGrant();

  const value = {
    cloudOn,
    firebaseUid: resolvedUid,
    loading,
    error,
    profile,
    incomingRequests,
    outgoingRequests,
    sharedTasks,
    referrals,
    referralRewards,
    inviteLink,
    inviteShare,
    referralCode,
    friendUids: friendProfiles,
    referralGrant,
    refresh,
    ensureReferralCodeReady,
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
      inviteShare: { webLink: "", appStoreUrl: "", shareText: "", shareUrl: "" },
      referralCode: "",
      firebaseUid: null,
      friendUids: [],
      referralGrant: { active: false, until: null, daysLeft: 0 },
      error: "",
      refresh: () => {},
      ensureReferralCodeReady: async () => {
        throw new Error("Sign in to generate an invite code.");
      },
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

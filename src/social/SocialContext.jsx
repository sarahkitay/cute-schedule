import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAuthApp, isFirebaseEnabled } from "../firebase.js";
import {
  clearPendingReferralCode,
  defaultSocialPrivacy,
  filterSnapshotForFriend,
  getPendingReferralCode,
  normalizeSocialPrivacy,
} from "./socialModel.js";
import { getReferralProGrant, latestReferralProUntilIso, setReferralProUntilIso } from "./referralEntitlement.js";
import { buildReferralSharePayload } from "./referralLinks.js";
import { loadCachedReferralCode, saveCachedReferralCode } from "./referralCodeCache.js";
import { buildShareSnapshot } from "./socialSnapshot.js";
import * as sf from "./socialFirestore.js";
import { sanitizeCloudUserError } from "../cloudUserMessages.js";

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
  const [friendNames, setFriendNames] = useState({});
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
      const [synced, rewardRows] = await Promise.all([
        sf.loadUserProfile(profileUid),
        sf.listReferralRewards(profileUid).catch(() => []),
      ]);
      const until = latestReferralProUntilIso([
        synced?.referralProUntilIso,
        ...(rewardRows || []).map((r) => r.proUntilIso),
      ]);
      if (until) {
        setReferralProUntilIso(until);
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
      const uids = [...new Set(p?.friendUids || [])].filter(
        (id) => !(p?.blockedUids || []).includes(id),
      );
      const namePairs = await Promise.all(
        uids.map(async (fid) => {
          const fp = await sf.loadUserProfile(fid);
          return [fid, (fp?.displayName || "").trim() || "Friend"];
        }),
      );
      setFriendNames(Object.fromEntries(namePairs));
    } catch (e) {
      setError(sanitizeCloudUserError(e));
    } finally {
      setLoading(false);
    }
  }, [cloudOn, resolvedUid, displayName]);

  const ensureReferralCodeReady = useCallback(async () => {
    if (!cloudOn || !resolvedUid) {
      throw new Error("Sign in with your cloud account to get an invite code.");
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
      const msg = sanitizeCloudUserError(e);
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
        if (recorded) {
          /* Referrer gets Pro when they open Accountability (processPendingReferralRewardsForReferrer). */
        }
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

  const addFriendByCode = useCallback(
    async (code) => {
      await sf.ensureUserProfile(resolvedUid, { displayName });
      const target = await sf.addFriendByCode(resolvedUid, code);
      await refresh();
      return target;
    },
    [resolvedUid, displayName, refresh],
  );

  /** @deprecated Use addFriendByCode - kept for older call sites. */
  const sendFriendRequestByCode = addFriendByCode;

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
      const [raw, friendProfile] = await Promise.all([
        sf.loadFriendShareSnapshot(friendUid),
        sf.loadUserProfile(friendUid),
      ]);
      const vis = profile?.friendVisibility?.[friendUid];
      const globalPerms = normalizeSocialPrivacy(friendProfile?.privacy || defaultSocialPrivacy()).sharePermissions;
      return filterSnapshotForFriend(raw, globalPerms, vis);
    },
    [profile],
  );

  const createSharedTask = useCallback(
    async (task) => {
      const created = await sf.createSharedTask(resolvedUid, {
        ...task,
        creatorDisplayName: displayName,
      });
      await refresh();
      return created;
    },
    [resolvedUid, displayName, refresh],
  );

  const respondSharedTaskInvite = useCallback(
    async (taskId, accept) => {
      const result = await sf.respondSharedTaskInvite(taskId, resolvedUid, accept);
      await refresh();
      if (accept && result?.scheduleOnAccept !== false && typeof window !== "undefined") {
        const sharedWithName =
          (result.creatorDisplayName || "").trim() ||
          friendNames[result.createdBy] ||
          "Friend";
        window.dispatchEvent(
          new CustomEvent("proyou:shared-task-accepted", {
            detail: {
              task: { ...result, sharedWithName },
            },
          }),
        );
      }
      return result;
    },
    [resolvedUid, refresh, friendNames],
  );

  const pendingSharedTaskInvites = useMemo(
    () =>
      sharedTasks.filter(
        (t) => t.status === "pending" && t.inviteeUid === resolvedUid,
      ),
    [sharedTasks, resolvedUid],
  );

  const activeSharedTasks = useMemo(
    () =>
      sharedTasks.filter((t) => {
        if (t.status === "declined") return false;
        if (t.status === "pending" && t.inviteeUid === resolvedUid) return false;
        return true;
      }),
    [sharedTasks, resolvedUid],
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
    friendNames,
    pendingSharedTaskInvites,
    activeSharedTasks,
    referralGrant,
    refresh,
    ensureReferralCodeReady,
    addFriendByCode,
    sendFriendRequestByCode,
    respondRequest,
    removeFriend,
    blockFriend,
    updatePrivacy,
    setFriendVisibilityFor,
    loadFriendProgress,
    loadUserProfile: sf.loadUserProfile,
    createSharedTask,
    respondSharedTaskInvite,
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
      friendNames: {},
      pendingSharedTaskInvites: [],
      activeSharedTasks: [],
      referralGrant: { active: false, until: null, daysLeft: 0 },
      error: "",
      refresh: () => {},
      ensureReferralCodeReady: async () => {
        throw new Error("Sign in to generate an invite code.");
      },
      addFriendByCode: async () => {},
      sendFriendRequestByCode: async () => {},
      respondRequest: async () => {},
      removeFriend: async () => {},
      blockFriend: async () => {},
      updatePrivacy: async () => {},
      setFriendVisibilityFor: async () => {},
      loadFriendProgress: async () => null,
      loadUserProfile: async () => null,
      createSharedTask: async () => {},
      respondSharedTaskInvite: async () => {},
      completeSharedTask: async () => {},
      commentSharedTask: async () => {},
      reactSharedTask: async () => {},
    };
  }
  return ctx;
}

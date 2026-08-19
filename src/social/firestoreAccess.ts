/**
 * Client-testable mirror of firestore.rules social authorization.
 * Rules remain the enforcement layer; these helpers are the safety net.
 */

export function friendshipDocId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join("_");
}

export function otherMember(authUid: string, memberUids: string[]): string | null {
  if (!Array.isArray(memberUids) || memberUids.length !== 2) return null;
  if (memberUids[0] === authUid) return memberUids[1];
  if (memberUids[1] === authUid) return memberUids[0];
  return null;
}

export function listAddedOnly(before: string[], after: string[], added: string): boolean {
  const prev = Array.isArray(before) ? before : [];
  const next = Array.isArray(after) ? after : [];
  if (next.length !== prev.length + 1) return false;
  if (prev.includes(added) || !next.includes(added)) return false;
  return prev.every((id) => next.includes(id));
}

export function listRemovedOnly(before: string[], after: string[], removed: string): boolean {
  const prev = Array.isArray(before) ? before : [];
  const next = Array.isArray(after) ? after : [];
  if (prev.length !== next.length + 1) return false;
  if (!prev.includes(removed) || next.includes(removed)) return false;
  return next.every((id) => prev.includes(id));
}

export function canReadUserProfile(authUid: string | null, profileUid: string, friendUids: string[] = []): boolean {
  if (!authUid) return false;
  if (authUid === profileUid) return true;
  return Array.isArray(friendUids) && friendUids.includes(authUid);
}

export function canListUserProfiles(): boolean {
  return false;
}

export function canCreateFriendship(opts: {
  authUid: string | null;
  friendshipId: string;
  memberUids: string[];
  inviteCode?: string;
  inviteCodeDoc?: { uid: string; allowFriendRequests?: boolean } | null;
  incomingRequest?: { fromUid: string; toUid: string; status: string } | null;
  otherBlockedCaller?: boolean;
}): boolean {
  const { authUid, friendshipId, memberUids } = opts;
  if (!authUid) return false;
  if (!Array.isArray(memberUids) || memberUids.length !== 2) return false;
  if (memberUids[0] === memberUids[1]) return false;
  if (!memberUids.includes(authUid)) return false;
  if (friendshipId !== friendshipDocId(memberUids[0], memberUids[1])) return false;
  const other = otherMember(authUid, memberUids);
  if (!other) return false;
  if (opts.otherBlockedCaller) return false;

  const req = opts.incomingRequest;
  if (req && req.toUid === authUid && req.fromUid === other && (req.status === "pending" || req.status === "accepted")) {
    return true;
  }

  const code = String(opts.inviteCode || "").trim().toUpperCase();
  const doc = opts.inviteCodeDoc;
  if (code && doc && doc.uid === other && doc.allowFriendRequests !== false) return true;
  return false;
}

export function canMutateFriendshipMembers(existingMembers: string[], nextMembers: string[]): boolean {
  if (!Array.isArray(existingMembers) || !Array.isArray(nextMembers)) return false;
  if (existingMembers.length !== nextMembers.length) return false;
  return existingMembers.every((id) => nextMembers.includes(id)) && nextMembers.every((id) => existingMembers.includes(id));
}

export function canDeleteFriendship(authUid: string | null, memberUids: string[]): boolean {
  return Boolean(authUid && Array.isArray(memberUids) && memberUids.includes(authUid));
}

export function canCreateReferral(opts: {
  authUid: string | null;
  referrerUid: string;
  refereeUid: string;
  referralCode: string;
  inviteCodeDoc?: { uid: string } | null;
}): boolean {
  const { authUid, referrerUid, refereeUid, referralCode, inviteCodeDoc } = opts;
  if (!authUid || authUid !== refereeUid) return false;
  if (!referrerUid || referrerUid === refereeUid) return false;
  const code = String(referralCode || "").trim().toUpperCase();
  if (!code) return false;
  return Boolean(inviteCodeDoc && inviteCodeDoc.uid === referrerUid);
}

export function canCreateReferralReward(opts: {
  authUid: string | null;
  referrerUid: string;
  refereeUid: string;
  referralId: string;
  referral?: { referrerUid: string; refereeUid: string; status: string } | null;
}): boolean {
  const { authUid, referrerUid, refereeUid, referral } = opts;
  if (!authUid || authUid !== referrerUid) return false;
  if (referrerUid === refereeUid) return false;
  if (!referral) return false;
  if (referral.referrerUid !== referrerUid || referral.refereeUid !== refereeUid) return false;
  return referral.status === "pending" || referral.status === "qualified";
}

export function canUpdateSharedTaskMembers(opts: {
  authUid: string | null;
  existing: { memberUids: string[]; inviteeUid?: string | null; status?: string; createdBy?: string };
  next: { memberUids: string[]; inviteeUid?: string | null; status?: string; createdBy?: string };
}): boolean {
  const { authUid, existing, next } = opts;
  if (!authUid) return false;
  if (existing.createdBy && next.createdBy && existing.createdBy !== next.createdBy) return false;
  if ((existing.inviteeUid || null) !== (next.inviteeUid || null)) return false;

  const wasMember = (existing.memberUids || []).includes(authUid);
  if (wasMember) {
    return canMutateFriendshipMembers(existing.memberUids || [], next.memberUids || []);
  }

  const isInvitee = existing.inviteeUid === authUid && existing.status === "pending";
  if (!isInvitee) return false;
  if (next.status === "declined") {
    return canMutateFriendshipMembers(existing.memberUids || [], next.memberUids || []);
  }
  if (next.status === "active") {
    return listAddedOnly(existing.memberUids || [], next.memberUids || [], authUid);
  }
  return false;
}

export function canCreateSharedTask(opts: {
  authUid: string | null;
  createdBy: string;
  memberUids: string[];
  inviteeUid?: string | null;
  creatorFriendUids?: string[];
}): boolean {
  const { authUid, createdBy, memberUids, inviteeUid, creatorFriendUids } = opts;
  if (!authUid || authUid !== createdBy) return false;
  if (!Array.isArray(memberUids) || memberUids.length !== 1 || memberUids[0] !== authUid) return false;
  if (!inviteeUid) return true;
  if (inviteeUid === authUid) return false;
  return Array.isArray(creatorFriendUids) && creatorFriendUids.includes(inviteeUid);
}

import React from "react";
import { SubscriptionProvider } from "./SubscriptionContext.jsx";
import { SocialBridge } from "../social/SocialBridge.jsx";

/**
 * Bridges App state into subscription and social context.
 * @param {{
 *   firebaseUid?: string | null,
 *   enabledModules?: string[],
 *   routineTemplateCount?: number,
 *   socialDisplayName?: string,
 *   getShareSnapshotInput?: () => object | null,
 *   firebaseEmail?: string | null,
 *   profile?: object,
 *   children: React.ReactNode,
 * }} props
 */
export function SubscriptionBridge({
  firebaseUid,
  firebaseEmail = null,
  enabledModules,
  routineTemplateCount = 0,
  socialDisplayName = "",
  getShareSnapshotInput = null,
  profile = null,
  children,
}) {
  return (
    <SubscriptionProvider
      firebaseUid={firebaseUid}
      firebaseEmail={firebaseEmail}
      enabledModules={enabledModules}
      routineTemplateCount={routineTemplateCount}
      profile={profile}
    >
      <SocialBridge
        firebaseUid={firebaseUid}
        displayName={socialDisplayName}
        getShareSnapshotInput={getShareSnapshotInput}
      >
        {children}
      </SocialBridge>
    </SubscriptionProvider>
  );
}

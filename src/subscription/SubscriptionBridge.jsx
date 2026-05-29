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
 *   children: React.ReactNode,
 * }} props
 */
export function SubscriptionBridge({
  firebaseUid,
  enabledModules,
  routineTemplateCount = 0,
  socialDisplayName = "",
  getShareSnapshotInput = null,
  children,
}) {
  return (
    <SubscriptionProvider
      firebaseUid={firebaseUid}
      enabledModules={enabledModules}
      routineTemplateCount={routineTemplateCount}
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

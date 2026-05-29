import React from "react";
import { SocialProvider } from "./SocialContext.jsx";
import { useSubscriptionOptional } from "../subscription/SubscriptionContext.jsx";

/**
 * @param {{
 *   firebaseUid?: string | null,
 *   displayName?: string,
 *   getShareSnapshotInput?: () => object | null,
 *   children: React.ReactNode,
 * }} props
 */
export function SocialBridge({ firebaseUid, displayName, getShareSnapshotInput, children }) {
  const sub = useSubscriptionOptional();
  return (
    <SocialProvider
      firebaseUid={firebaseUid}
      displayName={displayName}
      isPro={Boolean(sub?.isPro)}
      getShareSnapshotInput={getShareSnapshotInput}
    >
      {children}
    </SocialProvider>
  );
}

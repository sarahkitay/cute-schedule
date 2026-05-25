import React from "react";
import { SubscriptionProvider } from "./SubscriptionContext.jsx";

/**
 * Bridges App state into subscription context.
 * @param {{ firebaseUid?: string | null, enabledModules?: string[], routineTemplateCount?: number, children: React.ReactNode }} props
 */
export function SubscriptionBridge({ firebaseUid, enabledModules, routineTemplateCount = 0, children }) {
  return (
    <SubscriptionProvider
      firebaseUid={firebaseUid}
      enabledModules={enabledModules}
      routineTemplateCount={routineTemplateCount}
    >
      {children}
    </SubscriptionProvider>
  );
}

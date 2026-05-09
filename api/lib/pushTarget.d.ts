/** Shape accepted by `web-push` `sendNotification` (serialized from the client). */
export type WebPushSubscription = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
  expirationTime?: number | null;
};

/**
 * One row in KV for push delivery.
 * - `web`: Web Push subscription
 * - `ios`: APNs device token (Capacitor iOS)
 * - `android`: FCM registration token (Capacitor Android)
 */
export type PushTarget =
  | { type: "web"; subscription: WebPushSubscription; updatedAt?: number }
  | { type: "ios"; token: string; updatedAt?: number; firebaseUid?: string }
  | { type: "android"; token: string; updatedAt?: number; firebaseUid?: string };

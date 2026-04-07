/* global self */
/**
 * Service worker - required for Web Push (Push API delivers to SW; SW shows the notification).
 * Registered from the client as /sw.js (see notifications.js and index.html).
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const defaultPayload = {
  title: "PROYOU",
  body: "",
  url: "/",
  tag: "proyou-push",
  icon: undefined,
  badge: undefined,
  requireInteraction: false,
};

async function parsePushPayload(pushData) {
  if (!pushData) return { ...defaultPayload };
  const raw = await pushData.arrayBuffer();
  const text = new TextDecoder("utf-8").decode(raw);
  if (!text.trim()) return { ...defaultPayload };
  try {
    const j = JSON.parse(text);
    return {
      title: j.title || defaultPayload.title,
      body: j.body || "",
      url: j.url || defaultPayload.url,
      tag: j.tag || defaultPayload.tag,
      icon: j.icon,
      badge: j.badge,
      requireInteraction: Boolean(j.requireInteraction),
    };
  } catch (_) {
    return { ...defaultPayload, body: text };
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const data = await parsePushPayload(event.data);
      const options = {
        body: data.body,
        icon: data.icon || "/pwa-192.png",
        badge: data.badge || "/pwa-192.png",
        data: { url: data.url },
        tag: data.tag,
        requireInteraction: data.requireInteraction,
      };
      await self.registration.showNotification(data.title, options);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";
  const fullUrl = new URL(url, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          if ("navigate" in client && typeof client.navigate === "function") {
            client.navigate(fullUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(fullUrl);
    })
  );
});

// Service Worker for Push Notifications
const CACHE_NAME = 'cute-schedule-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Schedule Notification';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: data.tag || 'schedule-notification',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Service for Task Reminders and Completions + PWA Web Push

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

class NotificationService {
  constructor() {
    this.permission = null;
    // Defer checkPermission to first use so we don't run async code at import time (avoids init-order/TDZ issues in prod bundle)
    this._checkPromise = null;
  }

  _lazyCheck() {
    if (this._checkPromise == null) this._checkPromise = this.checkPermission();
    return this._checkPromise;
  }

  async enablePush() {
    if (!("serviceWorker" in navigator)) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return false;
      const res = await fetch("/api/push/vapid");
      const { publicKey } = await res.json();
      if (!publicKey) return false;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub }),
      });
      this.permission = "granted";
      return true;
    } catch (e) {
      console.warn("Push subscribe failed", e);
      return false;
    }
  }

  async checkPermission() {
    if (!('Notification' in window)) {
      return false;
    }
    
    if (Notification.permission === 'granted') {
      this.permission = 'granted';
      return true;
    }
    
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    }
    
    return false;
  }

  async requestPermission() {
    if (!('Notification' in window)) {
      return false;
    }
    
    const permission = await Notification.requestPermission();
    this.permission = permission;
    return permission === 'granted';
  }

  showNotification(title, options = {}) {
    if (!('Notification' in window) || this.permission !== 'granted') {
      return null;
    }

    const defaultOptions = {
      icon: '/vite.svg',
      badge: '/vite.svg',
      tag: `task-${Date.now()}`,
      requireInteraction: false,
      ...options
    };

    try {
      return new Notification(title, defaultOptions);
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }

  scheduleTaskReminder(task, hour, category) {
    try {
      const now = new Date();
      const [hours, minutes] = hour.split(':').map(Number);
      const reminderTime = new Date(now);
      reminderTime.setHours(hours, minutes, 0, 0);
      
      // If time has passed today, schedule for tomorrow
      if (reminderTime < now) {
        reminderTime.setDate(reminderTime.getDate() + 1);
      }
      
      const delay = reminderTime.getTime() - now.getTime();
      
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) { // Only schedule if within 24 hours
        setTimeout(() => {
          // Use gentle anchor reminder tone
          const currentHour = new Date().getHours();
          let reminderText;
          if (currentHour >= 5 && currentHour < 12) {
            reminderText = "When you're ready, here's what you planned.";
          } else if (currentHour >= 17 && currentHour < 22) {
            reminderText = "Anything you want to wrap up, or are we closing the day?";
          } else if (currentHour >= 22) {
            reminderText = "You don't need to finish anything tonight.";
          } else {
            reminderText = "Quick check-in. Do you want to keep going or slow it down?";
          }
          
          this.showNotification(
            reminderText,
            {
              body: `${task.text} (${category})`,
              tag: `reminder-${task.id}`,
              requireInteraction: false
            }
          );
        }, delay);
        
        return reminderTime;
      }
    } catch (error) {
      console.error('Error scheduling reminder:', error);
    }
    return null;
  }

  notifyTaskComplete(task, category) {
    // Use gentle, calm notification tone
    this.showNotification(
      'Done.',
      {
        body: `${task.text}`,
        tag: `complete-${task.id}`,
        requireInteraction: false
      }
    );
  }

  scheduleTaskTransition(currentTask, nextTask, hour, category) {
    try {
      const now = new Date();
      const [hours, minutes] = hour.split(':').map(Number);
      const taskTime = new Date(now);
      taskTime.setHours(hours, minutes, 0, 0);
      
      // Skip if time has passed
      if (taskTime < now) {
        return null;
      }

      // Schedule "wrap up" notification 10 minutes before task time
      const wrapUpTime = new Date(taskTime.getTime() - 10 * 60 * 1000);
      const wrapUpDelay = wrapUpTime.getTime() - now.getTime();
      
      if (wrapUpDelay > 0 && wrapUpDelay < 24 * 60 * 60 * 1000) {
        setTimeout(() => {
          let wrapUpMessage = "Time to wrap up.";
          let wrapUpBody = currentTask ? `Finishing up: ${currentTask.text}` : "Wrapping up current task";
          
          if (nextTask) {
            wrapUpBody += `\nNext: ${nextTask.text} at ${hour}`;
          }
          
          this.showNotification(wrapUpMessage, {
            body: wrapUpBody,
            tag: `wrapup-${currentTask?.id || Date.now()}`,
            requireInteraction: false
          });
        }, wrapUpDelay);
      }

      // Schedule "next task" notification at task time
      const nextTaskDelay = taskTime.getTime() - now.getTime();
      if (nextTaskDelay > 0 && nextTaskDelay < 24 * 60 * 60 * 1000) {
        setTimeout(() => {
          this.showNotification(
            "Next task starting",
            {
              body: `${nextTask.text} (${category})`,
              tag: `next-${nextTask.id}`,
              requireInteraction: false
            }
          );
        }, nextTaskDelay);
      }
      
      return { wrapUpTime, taskTime };
    } catch (error) {
      console.error('Error scheduling task transition:', error);
      return null;
    }
  }
}

const _notificationService = new NotificationService();
export const notificationService = {
  get permission() {
    return _notificationService.permission;
  },
  enablePush() {
    return _notificationService.enablePush();
  },
  checkPermission() {
    return _notificationService._lazyCheck();
  },
  requestPermission() {
    return _notificationService.requestPermission();
  },
  showNotification(title, options) {
    return _notificationService.showNotification(title, options);
  },
  scheduleTaskReminder(task, hour, category) {
    return _notificationService.scheduleTaskReminder(task, hour, category);
  },
  notifyTaskComplete(task, category) {
    return _notificationService.notifyTaskComplete(task, category);
  },
  scheduleTaskTransition(currentTask, nextTask, hour, category) {
    return _notificationService.scheduleTaskTransition(currentTask, nextTask, hour, category);
  },
};

// Notification Service for Task Reminders and Completions

class NotificationService {
  constructor() {
    this.permission = null;
    this.checkPermission();
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
}

export const notificationService = new NotificationService();

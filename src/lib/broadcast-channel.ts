
// src/lib/broadcast-channel.ts

const canUseBroadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window;

/**
 * Notifies other tabs/windows that announcement data has changed.
 */
export function broadcastAnnouncementUpdate() {
  if (canUseBroadcastChannel) {
    const channel = new BroadcastChannel('announcement_updates');
    channel.postMessage('update');
    channel.close();
  }
}

/**
 * Notifies other tabs/windows that gallery data has changed.
 */
export function broadcastGalleryUpdate() {
  if (canUseBroadcastChannel) {
    const channel = new BroadcastChannel('gallery_updates');
    channel.postMessage('update');
    channel.close();
  }
}

/**
 * Notifies other tabs/windows that contact message data has changed.
 */
export function broadcastContactUpdate() {
  if (canUseBroadcastChannel) {
    const channel = new BroadcastChannel('contact_updates');
    channel.postMessage('update');
    channel.close();
  }
}

/**
 * Notifies other tabs/windows that user notification data has changed.
 */
export function broadcastNotificationUpdate() {
  if (canUseBroadcastChannel) {
    const channel = new BroadcastChannel('notification_updates');
    channel.postMessage('update');
    channel.close();
  }
}

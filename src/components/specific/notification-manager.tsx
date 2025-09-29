
"use client";

import { useEffect } from 'react';
import { useSettings } from '@/contexts/settings-context';

export function NotificationManager() {
  const { setDirectMessage } = useSettings();

  const handleDirectMessage = (notificationPayload: any) => {
    const customData = notificationPayload?.additionalData;
    if (customData && customData.type === 'direct_message') {
      console.log('[NotificationManager] Direct message received. Opening modal.', customData);
      setDirectMessage({
        title: customData.title || 'Yöneticiden Mesaj',
        body: customData.body || 'Bir mesajınız var.',
      });
      return true; // Indicate that the notification was handled
    }
    return false;
  };

  useEffect(() => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(function(OneSignal) {
      
      // Listener for when a notification is clicked by the user
      const clickListener = (event: any) => {
        console.log('[NotificationManager] Notification clicked:', event);
        const handled = handleDirectMessage(event.notification);
        if (handled) {
          event.preventDefault(); // Prevent default browser action if we opened a modal
        }
      };

      // Listener for when a notification is received while the user is on the site
      const foregroundWillDisplayListener = (event: any) => {
        console.log('[NotificationManager] Notification received in foreground:', event);
        const handled = handleDirectMessage(event.notification);
        if (handled) {
          // Prevent the SDK from displaying its own notification, since we are showing a modal
          event.preventDefault(); 
        }
      };
      
      OneSignal.Notifications.addEventListener('click', clickListener);
      OneSignal.Notifications.addEventListener('foregroundWillDisplay', foregroundWillDisplayListener);

      // Cleanup function to remove listeners when the component unmounts
      return () => {
        console.log('[NotificationManager] Cleaning up listeners.');
        OneSignal.Notifications.removeEventListener('click', clickListener);
        OneSignal.Notifications.removeEventListener('foregroundWillDisplay', foregroundWillDisplayListener);
      };

    });
  }, [setDirectMessage]);

  return null; // This component does not render anything
}

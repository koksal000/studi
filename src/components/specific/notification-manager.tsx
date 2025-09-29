
"use client";

import { useEffect } from 'react';
import { useSettings } from '@/contexts/settings-context';
import { useOneSignal } from '@/contexts/onesignal-context'; // Assuming useOneSignal provides access to the SDK

export function NotificationManager() {
  const { setDirectMessage } = useSettings();

  useEffect(() => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(function(OneSignal) {
      OneSignal.Notifications.addEventListener('click', function(event) {
        console.log('[NotificationManager] Notification clicked:', event);
        
        const customData = event.notification.additionalData;
        if (customData && customData.type === 'direct_message') {
          // Prevent the default URL navigation
          event.preventDefault();

          console.log('[NotificationManager] Direct message notification clicked. Opening modal.');
          // Use the data from the notification to set the modal content
          setDirectMessage({
            title: customData.title || 'Yöneticiden Mesaj',
            body: customData.body || 'Bir mesajınız var.',
          });
        }
        // For other notification types, the default behavior (opening web_url) will proceed
      });
    });
  }, [setDirectMessage]);

  return null; // This component does not render anything
}

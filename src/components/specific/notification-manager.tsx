"use client";

import { useEffect } from 'react';
import { useFirebaseMessaging } from '@/contexts/firebase-messaging-context';
import { NotificationPermissionDialog } from '@/components/specific/notification-permission-dialog';

/**
 * This component manages the lifecycle of the notification permission dialog.
 * It determines if the dialog should be shown to the user based on their
 * current permission status and whether they've seen the dialog before.
 */
export function NotificationManager() {
  const { 
    permissionStatus, 
    hasModalBeenShown, 
    showPermissionModal, 
    setShowPermissionModal, 
    userPreference 
  } = useFirebaseMessaging();
  
  useEffect(() => {
    // Show the modal only if:
    // 1. The user hasn't made a choice before ('unset').
    // 2. The browser permission is at its default state (not granted or denied).
    // 3. We haven't already shown them the modal in this session/browser.
    if (userPreference === 'unset' && permissionStatus === 'default' && !hasModalBeenShown) {
      setShowPermissionModal(true);
    }
  }, [permissionStatus, hasModalBeenShown, userPreference, setShowPermissionModal]);

  return <NotificationPermissionDialog isOpen={showPermissionModal} onOpenChange={setShowPermissionModal} />;
}

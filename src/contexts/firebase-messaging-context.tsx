
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { initializeFirebaseApp, requestNotificationPermissionAndToken, onForegroundMessage } from '@/lib/firebase-config';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/user-context';

export type FcmPermissionStatus = 'granted' | 'denied' | 'default' | 'not_supported';
export type UserPreference = 'enabled' | 'disabled' | 'unset';

interface FirebaseMessagingContextType {
  fcmToken: string | null;
  permissionStatus: FcmPermissionStatus;
  userPreference: UserPreference;
  updateNotificationPreference: (enabled: boolean) => void;
  requestPermission: () => Promise<void>;
  isFcmLoading: boolean;
  showPermissionModal: boolean; 
  setShowPermissionModal: (show: boolean) => void; 
  hasModalBeenShown: boolean;
  setHasModalBeenShown: (shown: boolean) => void;
}

const FirebaseMessagingContext = createContext<FirebaseMessagingContextType | undefined>(undefined);

const FCM_MODAL_SHOWN_KEY = 'fcmPermissionModalShown_v3';
const FCM_USER_PREFERENCE_KEY = 'fcmUserPreference_v3';

export const FirebaseMessagingProvider = ({ children }: { children: ReactNode }) => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<FcmPermissionStatus>('default');
  const [userPreference, setUserPreferenceState] = useState<UserPreference>('unset');
  const [isFcmLoading, setIsFcmLoading] = useState(true);
  const [showPermissionModal, setShowPermissionModal] = useState(false); 
  const [hasModalBeenShown, setHasModalBeenShownState] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();

  const sendTokenToServer = useCallback(async (token: string) => {
    if (!user || !user.email) {
      console.log('[FCM Context] User not logged in. Token will be sent when user logs in.');
      return;
    }
    try {
      // Always use lowercase for the userId to ensure consistency
      const userId = user.email.toLowerCase();
      await fetch('/api/fcm/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, userId }),
      });
      console.log(`[FCM Context] Token successfully sent to server for user: ${userId}`);
    } catch (apiError) {
      console.error('[FCM Context] Failed to send FCM token to server:', apiError);
    }
  }, [user]);

  const requestPermission = useCallback(async () => {
    console.log('[FCM Context] Requesting notification permission...');
    const currentToken = await requestNotificationPermissionAndToken();
    const newPermissionStatus = Notification.permission as FcmPermissionStatus;
    setPermissionStatus(newPermissionStatus);

    if (newPermissionStatus === 'granted' && currentToken) {
      setFcmToken(currentToken);
      await sendTokenToServer(currentToken);
    } else {
      setFcmToken(null);
    }
    return;
  }, [sendTokenToServer]);

  // Effect to initialize state and check for existing permissions/tokens on mount.
  useEffect(() => {
    setIsFcmLoading(true);
    initializeFirebaseApp();
    
    // Load preferences from localStorage
    const modalShown = localStorage.getItem(FCM_MODAL_SHOWN_KEY) === 'true';
    setHasModalBeenShownState(modalShown);
    const storedUserPref = (localStorage.getItem(FCM_USER_PREFERENCE_KEY) as UserPreference) || 'unset';
    setUserPreferenceState(storedUserPref);
    
    // Check initial browser permission
    const initialPermission = Notification.permission as FcmPermissionStatus;
    setPermissionStatus(initialPermission);

    // If permission is already granted and user wants notifications, get and send the token.
    if (initialPermission === 'granted' && storedUserPref !== 'disabled') {
      requestPermission();
    }
    
    setIsFcmLoading(false);
    
    // Listen for foreground messages
    const unsubscribeOnMessage = onForegroundMessage((payload) => {
      console.log('[FCM Context] Foreground message received.', payload);
      toast({
        title: payload.notification?.title || "Yeni Bildirim",
        description: payload.notification?.body || "Yeni bir mesajınız var.",
      });
    });

    return () => {
      unsubscribeOnMessage();
    };
  }, [requestPermission, toast]);

  // This effect ensures that if a user logs in, we re-run the token registration.
  useEffect(() => {
    if (user && fcmToken) {
        console.log("[FCM Context] User changed/loaded, re-sending token to server.");
        sendTokenToServer(fcmToken);
    }
  }, [user, fcmToken, sendTokenToServer]);
  
  const setHasModalBeenShown = (shown: boolean) => {
    localStorage.setItem(FCM_MODAL_SHOWN_KEY, String(shown));
    setHasModalBeenShownState(shown);
  };
  
  const updateNotificationPreference = useCallback(async (enabled: boolean) => {
      const newPreference: UserPreference = enabled ? 'enabled' : 'disabled';
      setUserPreferenceState(newPreference);
      localStorage.setItem(FCM_USER_PREFERENCE_KEY, newPreference);

      if (enabled) {
          console.log('[FCM Context] User enabled notifications. Checking permission...');
          await requestPermission();
      } else {
          console.log('[FCM Context] User disabled notifications.');
          setFcmToken(null);
          // Optional: Add logic here to unregister token from server if desired.
      }
  }, [requestPermission]);
  
  return (
    <FirebaseMessagingContext.Provider value={{
      fcmToken,
      permissionStatus,
      userPreference,
      updateNotificationPreference,
      requestPermission,
      isFcmLoading,
      showPermissionModal, 
      setShowPermissionModal, 
      hasModalBeenShown,
      setHasModalBeenShown,
    }}>
      {children}
    </FirebaseMessagingContext.Provider>
  );
};

export const useFirebaseMessaging = (): FirebaseMessagingContextType => {
  const context = useContext(FirebaseMessagingContext);
  if (context === undefined) {
    throw new Error('useFirebaseMessaging must be used within a FirebaseMessagingProvider');
  }
  return context;
};

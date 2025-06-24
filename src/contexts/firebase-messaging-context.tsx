
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { initializeFirebaseApp, requestNotificationPermissionAndToken, onForegroundMessage } from '@/lib/firebase-config';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/user-context';

export type FcmPermissionStatus = 'granted' | 'denied' | 'default' | 'prompted_declined' | 'not_supported';

interface FirebaseMessagingContextType {
  fcmToken: string | null;
  permissionStatus: FcmPermissionStatus;
  requestPermission: () => Promise<{ token: string | null; permission: FcmPermissionStatus }>;
  isFcmLoading: boolean;
  showPermissionModal: boolean; 
  setShowPermissionModal: (show: boolean) => void; 
  hasModalBeenShown: boolean;
  setHasModalBeenShown: (shown: boolean) => void;
  userPreference: 'enabled' | 'disabled' | 'unset';
  setUserPreference: (preference: 'enabled' | 'disabled') => void;
}

interface FCMTokenResponse {
  token: string | null;
  permission: FcmPermissionStatus;
}

const FirebaseMessagingContext = createContext<FirebaseMessagingContextType | undefined>(undefined);

const FCM_PERMISSION_BROWSER_STATUS_KEY = 'fcmActualBrowserPermissionStatus_v2';
const FCM_MODAL_SHOWN_KEY = 'fcmPermissionModalShown_v2';
const FCM_USER_PREFERENCE_KEY = 'fcmUserPreference_v2';

export const FirebaseMessagingProvider = ({ children }: { children: ReactNode }) => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<FcmPermissionStatus>('default');
  const [isFcmLoading, setIsFcmLoading] = useState(true);
  const [_showPermissionModal, _setShowPermissionModal] = useState(false); 
  const [hasModalBeenShown, setHasModalBeenShownState] = useState(false);
  const [userPreference, setUserPreferenceState] = useState<'enabled' | 'disabled' | 'unset'>('unset');
  const { toast } = useToast();
  const { user } = useUser();

  const sendTokenToServer = useCallback(async (token: string) => {
    if (!user || !user.email) {
      console.log('[FCM Context] User not logged in, cannot associate token with user.');
      return;
    }
    try {
      await fetch('/api/fcm/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, userId: user.email }),
      });
      console.log('[FCM Context] Token sent to server for user:', user.email);
    } catch (apiError) {
      console.error('[FCM Context] Failed to send FCM token to server:', apiError);
    }
  }, [user]);

  const updateUserPreferenceAndToken = useCallback(async (newBrowserPermission: FcmPermissionStatus, currentToken: string | null) => {
    setPermissionStatus(newBrowserPermission);
    localStorage.setItem(FCM_PERMISSION_BROWSER_STATUS_KEY, newBrowserPermission);
    setFcmToken(currentToken);

    if (newBrowserPermission === 'granted') {
      setUserPreferenceState('enabled');
      localStorage.setItem(FCM_USER_PREFERENCE_KEY, 'enabled');
      if (currentToken) {
        await sendTokenToServer(currentToken);
      }
    } else if (newBrowserPermission === 'denied') {
      setUserPreferenceState('disabled');
      localStorage.setItem(FCM_USER_PREFERENCE_KEY, 'disabled');
    }
  }, [sendTokenToServer]);


  useEffect(() => {
    initializeFirebaseApp();
    setIsFcmLoading(true);

    const modalShown = localStorage.getItem(FCM_MODAL_SHOWN_KEY) === 'true';
    setHasModalBeenShownState(modalShown);

    let storedUserPref = localStorage.getItem(FCM_USER_PREFERENCE_KEY) as 'enabled' | 'disabled' | 'unset' | null;
    if (storedUserPref === null) storedUserPref = 'unset';
    setUserPreferenceState(storedUserPref);
    
    let browserPerm: FcmPermissionStatus = 'default';
    if (typeof Notification !== 'undefined') {
      if (!('permission' in Notification)) {
        browserPerm = 'not_supported';
      } else {
        browserPerm = Notification.permission as FcmPermissionStatus;
      }
    } else {
      browserPerm = 'not_supported';
    }
    
    setPermissionStatus(browserPerm);
    localStorage.setItem(FCM_PERMISSION_BROWSER_STATUS_KEY, browserPerm);

    if (browserPerm === 'granted' && (storedUserPref === 'enabled' || storedUserPref === 'unset')) {
      requestNotificationPermissionAndToken().then(token => {
        if (token) {
          setFcmToken(token);
          sendTokenToServer(token);
          if (storedUserPref === 'unset') { 
              setUserPreferenceState('enabled');
              localStorage.setItem(FCM_USER_PREFERENCE_KEY, 'enabled');
          }
        }
      }).finally(() => setIsFcmLoading(false));
    } else if (browserPerm === 'denied' && storedUserPref !== 'disabled') {
      setUserPreferenceState('disabled');
      localStorage.setItem(FCM_USER_PREFERENCE_KEY, 'disabled');
      setIsFcmLoading(false);
    }
    else {
      setIsFcmLoading(false);
    }

    const unsubscribeOnMessage = onForegroundMessage((payload) => {
      console.log('[FCM Context] Foreground message received. ', payload);
      toast({
        title: payload.notification?.title || "Yeni Bildirim",
        description: payload.notification?.body || "Yeni bir mesajınız var.",
      });
    });

    return () => {
      unsubscribeOnMessage();
    };
  }, [toast, user, sendTokenToServer]);


  const setHasModalBeenShown = (shown: boolean) => {
    localStorage.setItem(FCM_MODAL_SHOWN_KEY, shown.toString());
    setHasModalBeenShownState(shown);
  };

  const setUserPreference = (preference: 'enabled' | 'disabled') => {
    localStorage.setItem(FCM_USER_PREFERENCE_KEY, preference);
    setUserPreferenceState(preference);
  };

  const requestPermission = useCallback(async (): Promise<FCMTokenResponse> => {
    setIsFcmLoading(true);
    console.log('[FCM Context] requestPermission called.');
    const receivedToken = await requestNotificationPermissionAndToken(); 
    
    let newBrowserPermission: FcmPermissionStatus = 'default';
     if (typeof Notification !== 'undefined') {
      if (!('permission' in Notification)) {
        newBrowserPermission = 'not_supported';
      } else {
        newBrowserPermission = Notification.permission as FcmPermissionStatus;
      }
    } else {
      newBrowserPermission = 'not_supported';
    }
    console.log('[FCM Context] Browser permission after prompt/check:', newBrowserPermission, "Token:", receivedToken ? "Exists" : "Null");
    
    await updateUserPreferenceAndToken(newBrowserPermission, receivedToken);

    setIsFcmLoading(false);
    return { token: receivedToken, permission: newBrowserPermission };
  }, [updateUserPreferenceAndToken]);


  return (
    <FirebaseMessagingContext.Provider value={{
      fcmToken,
      permissionStatus,
      requestPermission,
      isFcmLoading,
      showPermissionModal: _showPermissionModal, 
      setShowPermissionModal: _setShowPermissionModal, 
      hasModalBeenShown,
      setHasModalBeenShown,
      userPreference,
      setUserPreference
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

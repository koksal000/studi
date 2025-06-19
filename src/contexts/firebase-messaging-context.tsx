
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { initializeFirebaseApp, requestNotificationPermissionAndToken, onForegroundMessage } from '@/lib/firebase-config';
import { useToast } from '@/hooks/use-toast';

export type FcmPermissionStatus = 'granted' | 'denied' | 'default' | 'prompted_declined' | 'not_supported';

interface FirebaseMessagingContextType {
  fcmToken: string | null;
  permissionStatus: FcmPermissionStatus;
  requestPermission: () => Promise<{ token: string | null; permission: FcmPermissionStatus }>;
  isFcmLoading: boolean;
  showPermissionModal: boolean; // This context doesn't directly control the modal visibility
  setShowPermissionModal: (show: boolean) => void; // This context doesn't directly control the modal visibility
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
  const [_showPermissionModal, _setShowPermissionModal] = useState(false); // Internal, not for direct control from outside
  const [hasModalBeenShown, setHasModalBeenShownState] = useState(false);
  const [userPreference, setUserPreferenceState] = useState<'enabled' | 'disabled' | 'unset'>('unset');
  const { toast } = useToast();

  const updateUserPreferenceAndToken = useCallback(async (newBrowserPermission: FcmPermissionStatus, currentToken: string | null) => {
    setPermissionStatus(newBrowserPermission);
    localStorage.setItem(FCM_PERMISSION_BROWSER_STATUS_KEY, newBrowserPermission);
    setFcmToken(currentToken);

    if (newBrowserPermission === 'granted') {
      setUserPreferenceState('enabled');
      localStorage.setItem(FCM_USER_PREFERENCE_KEY, 'enabled');
    } else if (newBrowserPermission === 'denied') {
      setUserPreferenceState('disabled');
      localStorage.setItem(FCM_USER_PREFERENCE_KEY, 'disabled');
    } else { // 'default' or other, don't override existing preference if it's not 'unset'
      const storedPref = localStorage.getItem(FCM_USER_PREFERENCE_KEY) as 'enabled' | 'disabled' | 'unset' | null;
      if (storedPref === 'unset' || storedPref === null) {
         // If still 'default' and no strong user preference, keep it 'unset' or reflect 'default'
         // This branch is less likely to be hit if requestPermission is called and resolves
      }
    }
  }, []);


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

    // If browser permission is already granted and user preference is 'enabled' or 'unset', try to get token
    if (browserPerm === 'granted' && (storedUserPref === 'enabled' || storedUserPref === 'unset')) {
      requestNotificationPermissionAndToken().then(token => {
        setFcmToken(token);
        if (token && storedUserPref === 'unset') { // First time granted, set preference to enabled
            setUserPreferenceState('enabled');
            localStorage.setItem(FCM_USER_PREFERENCE_KEY, 'enabled');
        }
      }).finally(() => setIsFcmLoading(false));
    } else if (browserPerm === 'denied' && storedUserPref !== 'disabled') {
      // If browser permission is denied, force user preference to disabled
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
  }, [toast]);


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
    const receivedToken = await requestNotificationPermissionAndToken(); // This internally calls Notification.requestPermission()
    
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
      showPermissionModal: _showPermissionModal, // Not for external control
      setShowPermissionModal: _setShowPermissionModal, // Not for external control
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


"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { initializeFirebaseApp, requestNotificationPermissionAndToken, onForegroundMessage } from '@/lib/firebase-config';
import { useToast } from '@/hooks/use-toast';

type FcmPermissionStatus = 'granted' | 'denied' | 'default' | 'prompted_declined' | 'not_supported';

interface FirebaseMessagingContextType {
  fcmToken: string | null;
  permissionStatus: FcmPermissionStatus;
  requestPermission: () => Promise<FCMTokenResponse>;
  isFcmLoading: boolean;
  showPermissionModal: boolean;
  setShowPermissionModal: (show: boolean) => void;
  hasModalBeenShown: boolean;
  setHasModalBeenShown: (shown: boolean) => void;
  userPreference: 'enabled' | 'disabled' | 'unset';
  setUserPreference: (preference: 'enabled' | 'disabled') => void; // Only for direct user preference changes
}

interface FCMTokenResponse {
  token: string | null;
  permission: FcmPermissionStatus;
}

const FirebaseMessagingContext = createContext<FirebaseMessagingContextType | undefined>(undefined);

const FCM_PERMISSION_STATUS_KEY = 'fcmActualBrowserPermissionStatus'; // Stores Notification.permission
const FCM_MODAL_SHOWN_KEY = 'fcmPermissionModalShown';
const FCM_USER_PREFERENCE_KEY = 'fcmUserPreference'; // 'enabled' or 'disabled' by user in settings

export const FirebaseMessagingProvider = ({ children }: { children: ReactNode }) => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<FcmPermissionStatus>('default');
  const [isFcmLoading, setIsFcmLoading] = useState(true);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [hasModalBeenShown, setHasModalBeenShownState] = useState(false);
  const [userPreference, setUserPreferenceState] = useState<'enabled' | 'disabled' | 'unset'>('unset');
  const { toast } = useToast();

  const updateFcmToken = useCallback(async () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const currentToken = await requestNotificationPermissionAndToken(); // This function already handles sending token to backend
      setFcmToken(currentToken);
      return currentToken;
    }
    setFcmToken(null);
    return null;
  }, []);

  const syncUserPreferenceWithBrowserPermission = useCallback((browserPerm: FcmPermissionStatus, currentPref: 'enabled' | 'disabled' | 'unset') => {
    let newPref = currentPref;
    if (browserPerm === 'denied') {
      if (currentPref !== 'disabled') {
        console.log("[FCMContext] Browser permission denied, forcing user preference to 'disabled'.");
        newPref = 'disabled';
      }
    } else if (browserPerm === 'granted' && currentPref === 'unset') {
      // If permission is granted and user hasn't set a preference, default to enabled
      newPref = 'enabled';
    }
    // If no change needed or preference is already aligned
    if (newPref !== currentPref) {
      setUserPreferenceState(newPref);
      localStorage.setItem(FCM_USER_PREFERENCE_KEY, newPref);
    } else {
        setUserPreferenceState(currentPref === null || currentPref === undefined ? 'unset' : currentPref);
    }
  }, []);


  useEffect(() => {
    initializeFirebaseApp();
    setIsFcmLoading(true);

    const modalShown = localStorage.getItem(FCM_MODAL_SHOWN_KEY) === 'true';
    setHasModalBeenShownState(modalShown);

    let storedUserPref = localStorage.getItem(FCM_USER_PREFERENCE_KEY) as 'enabled' | 'disabled' | 'unset' | null;
    if (storedUserPref === null) storedUserPref = 'unset'; // Ensure it's 'unset' not null

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
    localStorage.setItem(FCM_PERMISSION_STATUS_KEY, browserPerm);

    syncUserPreferenceWithBrowserPermission(browserPerm, storedUserPref);
    
    // Initial token fetch if conditions are met
    if (storedUserPref === 'enabled' && browserPerm === 'granted') {
      updateFcmToken().finally(() => setIsFcmLoading(false));
    } else {
      setIsFcmLoading(false);
    }

    const unsubscribeOnMessage = onForegroundMessage((payload) => {
      console.log('Foreground message received. ', payload);
      toast({
        title: payload.notification?.title || "Yeni Bildirim",
        description: payload.notification?.body || "Yeni bir mesajınız var.",
      });
    });

    return () => {
      unsubscribeOnMessage();
    };
  }, [toast, updateFcmToken, syncUserPreferenceWithBrowserPermission]);


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
    // requestNotificationPermissionAndToken internally calls Notification.requestPermission()
    // and then tries to get the token if granted.
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

    setPermissionStatus(newBrowserPermission);
    localStorage.setItem(FCM_PERMISSION_STATUS_KEY, newBrowserPermission);
    setFcmToken(receivedToken);

    if (newBrowserPermission === 'granted') {
      setUserPreference('enabled'); // User explicitly granted, so preference is enabled
    } else if (newBrowserPermission === 'denied') {
      setUserPreference('disabled'); // User explicitly denied, so preference is disabled
    } else { // 'default' or 'prompted_declined' (which we treat as 'default' here for re-prompt logic)
      // Don't change user preference here if it was 'default'. Let it remain 'unset' or as is
      // until user makes a choice in settings or initial dialog.
      // If they declined the modal, that sets it to 'disabled'.
    }

    setIsFcmLoading(false);
    return { token: receivedToken, permission: newBrowserPermission };
  }, [setUserPreference]);


  return (
    <FirebaseMessagingContext.Provider value={{
      fcmToken,
      permissionStatus,
      requestPermission,
      isFcmLoading,
      showPermissionModal,
      setShowPermissionModal,
      hasModalBeenShown,
      setHasModalBeenShown,
      userPreference,
      setUserPreference // Expose this for direct preference changes from settings
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

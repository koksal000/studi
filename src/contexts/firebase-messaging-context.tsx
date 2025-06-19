
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
  setUserPreference: (preference: 'enabled' | 'disabled') => void;
}

interface FCMTokenResponse {
  token: string | null;
  permission: FcmPermissionStatus;
}

const FirebaseMessagingContext = createContext<FirebaseMessagingContextType | undefined>(undefined);

const FCM_PERMISSION_STATUS_KEY = 'fcmPermissionStatus'; // For Notification.permission
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

  useEffect(() => {
    initializeFirebaseApp(); // Initialize Firebase on mount

    // Load states from localStorage
    const storedModalShown = localStorage.getItem(FCM_MODAL_SHOWN_KEY);
    const storedPreference = localStorage.getItem(FCM_USER_PREFERENCE_KEY) as 'enabled' | 'disabled' | null;
    const storedPermission = localStorage.getItem(FCM_PERMISSION_STATUS_KEY) as FcmPermissionStatus | null;

    if (storedModalShown === 'true') {
      setHasModalBeenShownState(true);
    }
    if (storedPreference) {
      setUserPreferenceState(storedPreference);
    }
    if (storedPermission) {
      setPermissionStatus(storedPermission);
    } else if (typeof Notification !== 'undefined') {
      setPermissionStatus(Notification.permission as FcmPermissionStatus);
    }


    // If preference is enabled and permission granted, try to get token silently
    if (storedPreference === 'enabled' && (storedPermission === 'granted' || (typeof Notification !== 'undefined' && Notification.permission === 'granted'))) {
      requestNotificationPermissionAndToken().then(response => {
        if (response) {
            setFcmToken(response);
            setPermissionStatus('granted');
            localStorage.setItem(FCM_PERMISSION_STATUS_KEY, 'granted');
        } else {
            // This might happen if token retrieval fails but permission was granted
            setPermissionStatus(Notification.permission as FcmPermissionStatus);
            localStorage.setItem(FCM_PERMISSION_STATUS_KEY, Notification.permission);
        }
      }).catch(err => console.error("Error getting token on initial load:", err))
      .finally(() => setIsFcmLoading(false));
    } else {
        setIsFcmLoading(false);
    }

    // Set up foreground message listener
    const unsubscribe = onForegroundMessage((payload) => {
      console.log('Foreground message received. ', payload);
      toast({
        title: payload.notification?.title || "Yeni Bildirim",
        description: payload.notification?.body || "Yeni bir mesajınız var.",
      });
    });

    return () => {
      unsubscribe(); // Clean up listener
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
    const currentToken = await requestNotificationPermissionAndToken();
    const newPermission = typeof Notification !== 'undefined' ? Notification.permission as FcmPermissionStatus : 'default';
    
    setFcmToken(currentToken);
    setPermissionStatus(newPermission);
    localStorage.setItem(FCM_PERMISSION_STATUS_KEY, newPermission);

    if (newPermission === 'granted' && currentToken) {
      setUserPreference('enabled'); // If granted, user preference is 'enabled'
    } else if (newPermission === 'denied') {
      setUserPreference('disabled'); // If denied, user preference is 'disabled'
    }
    // If 'default', preference remains as is (or 'unset' if not changed yet)

    setIsFcmLoading(false);
    return {token: currentToken, permission: newPermission};
  }, []);


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

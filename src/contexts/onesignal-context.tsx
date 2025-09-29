
"use client";

import React, { createContext, useContext, useEffect, ReactNode, useCallback } from 'react';

interface OneSignalContextType {
  loginOneSignal: (externalId: string, email?: string | null) => void;
  logoutOneSignal: () => void;
  promptForNotifications: () => Promise<void>;
}

const OneSignalContext = createContext<OneSignalContextType | undefined>(undefined);

export const OneSignalProvider = ({ children }: { children: ReactNode }) => {

  useEffect(() => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      console.log('[OneSignal Context] OneSignal SDK is ready.');
    });
  }, []);

  const promptForNotifications = useCallback(async () => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    await new Promise<void>(resolve => {
        window.OneSignalDeferred.push(async function(OneSignal) {
            console.log('[OneSignal] Prompting for notifications.');
            try {
                await OneSignal.Notifications.requestPermission();
            } catch(e) {
                console.error("OneSignal notification permission request error:", e);
            }
            resolve();
        });
    });
  }, []);

  const loginOneSignal = useCallback((externalId: string, email?: string | null) => {
    if (!externalId) {
      console.warn('[OneSignal] Attempted to login with a null or empty externalId. Aborting.');
      return;
    }
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      console.log('[OneSignal] Logging in with external ID:', externalId);
      // Wait for the SDK to be fully ready by checking subscription status before logging in.
      // This prevents the "Cannot read properties of undefined (reading 'tt')" error.
      await OneSignal.User.isSubscribed(); 
      OneSignal.login(externalId).then(() => {
          if (email) {
              console.log('[OneSignal] Setting email for user:', email);
              OneSignal.User.addEmail(email);
          } else {
              console.log('[OneSignal] No email provided, skipping email set.');
          }
      }).catch((e: any) => console.error("OneSignal login/email set error:", e));
    });
  }, []);

  const logoutOneSignal = useCallback(() => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(function(OneSignal) {
      console.log('[OneSignal] Logging out.');
      OneSignal.logout().catch((e: any) => console.error("OneSignal logout error:", e));
    });
  }, []);

  return (
    <OneSignalContext.Provider value={{ loginOneSignal, logoutOneSignal, promptForNotifications }}>
      {children}
    </OneSignalContext.Provider>
  );
};

export const useOneSignal = (): OneSignalContextType => {
  const context = useContext(OneSignalContext);
  if (context === undefined) {
    throw new Error('useOneSignal must be used within a OneSignalProvider');
  }
  return context;
};

// Augment the Window interface
declare global {
  interface Window {
    OneSignalDeferred: any[];
  }
}


"use client";

import React, { createContext, useContext, useEffect, ReactNode, useCallback } from 'react';

interface OneSignalContextType {
  loginOneSignal: (externalId: string) => void;
  logoutOneSignal: () => void;
}

const OneSignalContext = createContext<OneSignalContextType | undefined>(undefined);

export const OneSignalProvider = ({ children }: { children: ReactNode }) => {

  useEffect(() => {
    // This ensures that the OneSignal SDK script is loaded and initialized.
    // The script is included in the layout.tsx file.
    // We are attaching our init logic to the deferred array.
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      // The init logic is now in layout.tsx to ensure it runs as early as possible.
      // This context will handle interactions with the already-initialized SDK.
      console.log('[OneSignal Context] OneSignal SDK is ready.');
    });
  }, []);

  const loginOneSignal = useCallback((externalId: string) => {
    if (!externalId) {
      console.warn('[OneSignal] Attempted to login with a null or empty externalId. Aborting.');
      return;
    }
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(function(OneSignal) {
      console.log('[OneSignal] Logging in with external ID:', externalId.toLowerCase());
      OneSignal.login(externalId.toLowerCase()).catch((e: any) => console.error("OneSignal login error:", e));
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
    <OneSignalContext.Provider value={{ loginOneSignal, logoutOneSignal }}>
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

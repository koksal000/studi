
"use client";

import React, { createContext, useContext, useEffect, ReactNode, useCallback } from 'react';

interface OneSignalContextType {
  loginOneSignal: (externalId: string) => void;
  logoutOneSignal: () => void;
}

const OneSignalContext = createContext<OneSignalContextType | undefined>(undefined);

export const OneSignalProvider = ({ children }: { children: ReactNode }) => {

  useEffect(() => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        await OneSignal.init({
          appId: "af7c8099-b2c1-4376-be91-afb88be83161",
        });
      } catch (error) {
        console.error("OneSignal Init Error:", error);
        // This error is expected if the current domain is not configured in the OneSignal dashboard.
        // We catch it to prevent the app from crashing during development.
        // To enable OneSignal, add this development URL to your app's list of allowed domains on the OneSignal dashboard.
      }
    });
  }, []);

  const loginOneSignal = useCallback((externalId: string) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(function(OneSignal) {
      console.log('[OneSignal] Logging in with external ID:', externalId.toLowerCase());
      OneSignal.login(externalId.toLowerCase());
    });
  }, []);

  const logoutOneSignal = useCallback(() => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(function(OneSignal) {
      console.log('[OneSignal] Logging out.');
      OneSignal.logout();
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

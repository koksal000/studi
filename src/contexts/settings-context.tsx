
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTheme } from 'next-themes';

interface SettingsContextType {
  currentTheme: string | undefined;
  setAppTheme: (theme: string) => void;
  siteNotificationsPreference: boolean;
  setSiteNotificationsPreference: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SITE_NOTIFICATIONS_KEY = 'camlicaKoyuSiteNotificationsEnabled';

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { theme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(true); // Remains true until theme AND preference loaded
  const [siteNotificationsPreference, setSiteNotificationsPreferenceState] = useState(true);

  useEffect(() => {
    setIsLoading(true); // Start loading
    // Load site notifications preference from localStorage
    const storedPreference = localStorage.getItem(SITE_NOTIFICATIONS_KEY);
    if (storedPreference !== null) {
      setSiteNotificationsPreferenceState(storedPreference === 'true');
    } else {
      // If not set, default to true and save it
      localStorage.setItem(SITE_NOTIFICATIONS_KEY, 'true');
      setSiteNotificationsPreferenceState(true);
    }
    // Note: Theme loading is handled by next-themes internally.
    // We set isLoading to false once our localStorage access is done.
    // A more robust solution might wait for next-themes to report its status if needed.
    setIsLoading(false); 
  }, []); 

  const setAppTheme = (newTheme: string) => {
    setTheme(newTheme);
  };

  const setSiteNotificationsPreference = (enabled: boolean) => {
    localStorage.setItem(SITE_NOTIFICATIONS_KEY, enabled.toString());
    setSiteNotificationsPreferenceState(enabled);
    if (enabled && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          console.log("Site notification permission granted by user.");
        } else {
          console.log("Site notification permission denied by user.");
        }
      });
    }
  };

  if (isLoading && typeof window !== 'undefined') { 
     // Only show loader on client-side if still loading; theme is client-side.
     // This helps prevent layout shifts or unstyled content during initial load.
     return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
   if (typeof window === 'undefined' && isLoading) {
    // On the server, if still "loading" (though localStorage won't be accessed), return null or basic structure to avoid errors.
    // This case might not be hit often if isLoading is quickly set to false on client.
    return null;
  }


  return (
    <SettingsContext.Provider value={{ 
      currentTheme: theme, 
      setAppTheme,
      siteNotificationsPreference, 
      setSiteNotificationsPreference 
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

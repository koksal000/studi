
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTheme } from 'next-themes';
// Toast importu kaldırıldı, çünkü bildirim tercihleri kaldırıldı.

interface SettingsContextType {
  currentTheme: string | undefined;
  setAppTheme: (theme: string) => void;
  siteNotificationsPreference: boolean; // Yeni eklendi
  setSiteNotificationsPreference: (enabled: boolean) => void; // Yeni eklendi
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SITE_NOTIFICATIONS_KEY = 'camlicaKoyuSiteNotificationsEnabled'; // Yeni key

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { theme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [siteNotificationsPreference, setSiteNotificationsPreferenceState] = useState(true); // Default true

  useEffect(() => {
    setIsLoading(true);
    // Load site notifications preference
    const storedPreference = localStorage.getItem(SITE_NOTIFICATIONS_KEY);
    if (storedPreference !== null) {
      setSiteNotificationsPreferenceState(storedPreference === 'true');
    } else {
      // If not set, default to true and save it
      localStorage.setItem(SITE_NOTIFICATIONS_KEY, 'true');
      setSiteNotificationsPreferenceState(true);
    }

    // Request notification permission on load if not already set and preference is true
    // This has been moved to useAnnouncements hook to be triggered when the hook is actually used
    // to avoid permission prompt on every page load if user hasn't visited announcements or similar.

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
          // Optionally inform user that notifications won't work if denied
        }
      });
    }
  };


  if (isLoading) { // Bu, tema ve bildirim tercihi yüklenene kadar bekler
     return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
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


"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTheme } from 'next-themes';

interface SettingsContextType {
  currentTheme: string | undefined;
  setAppTheme: (theme: string) => void;
  siteNotificationsPreference: boolean; 
  setSiteNotificationsPreference: (enabled: boolean) => void;
  // emailNotificationPreference ve setEmailNotificationPreference kaldırıldı
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SITE_NOTIFICATIONS_KEY = 'camlicaKoyuSiteNotificationsEnabled';
// EMAIL_NOTIFICATIONS_PREFERENCE_KEY kaldırıldı

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { theme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [siteNotificationsPreference, setSiteNotificationsPreferenceState] = useState(true);
  // emailNotificationPreference state'i kaldırıldı

  useEffect(() => {
    setIsLoading(true); 
    
    const storedSiteNotificationsPref = localStorage.getItem(SITE_NOTIFICATIONS_KEY);
    if (storedSiteNotificationsPref !== null) {
      setSiteNotificationsPreferenceState(storedSiteNotificationsPref === 'true');
    } else {
      localStorage.setItem(SITE_NOTIFICATIONS_KEY, 'true'); // Default to true
      setSiteNotificationsPreferenceState(true);
    }

    // emailNotificationPreference ile ilgili localStorage okuma/yazma işlemleri kaldırıldı
    
    setIsLoading(false); 
  }, []); 

  const setAppTheme = (newTheme: string) => {
    setTheme(newTheme);
  };

  const handleSetSiteNotificationsPreference = (enabled: boolean) => {
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

  // handleSetEmailNotificationPreference kaldırıldı

  if (isLoading && typeof window !== 'undefined') { 
     return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
   if (typeof window === 'undefined' && isLoading) {
    return null;
  }

  return (
    <SettingsContext.Provider value={{ 
      currentTheme: theme, 
      setAppTheme,
      siteNotificationsPreference, 
      setSiteNotificationsPreference: handleSetSiteNotificationsPreference,
      // emailNotificationPreference ve setEmailNotificationPreference context değerinden kaldırıldı
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

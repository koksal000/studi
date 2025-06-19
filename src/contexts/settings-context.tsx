
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTheme } from 'next-themes';

interface SettingsContextType {
  currentTheme: string | undefined;
  setAppTheme: (theme: string) => void;
  siteNotificationsPreference: boolean; // This was for local browser notifications, can be kept or removed.
  setSiteNotificationsPreference: (enabled: boolean) => void;
  emailNotificationPreference: boolean;
  setEmailNotificationPreference: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SITE_NOTIFICATIONS_KEY = 'camlicaKoyuSiteNotificationsEnabled';
const EMAIL_NOTIFICATIONS_PREFERENCE_KEY = 'camlicaKoyuEmailNotificationPreference';

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { theme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [siteNotificationsPreference, setSiteNotificationsPreferenceState] = useState(true);
  const [emailNotificationPreference, setEmailNotificationPreferenceState] = useState(true);

  useEffect(() => {
    setIsLoading(true); 
    
    const storedSiteNotificationsPref = localStorage.getItem(SITE_NOTIFICATIONS_KEY);
    if (storedSiteNotificationsPref !== null) {
      setSiteNotificationsPreferenceState(storedSiteNotificationsPref === 'true');
    } else {
      localStorage.setItem(SITE_NOTIFICATIONS_KEY, 'true');
      setSiteNotificationsPreferenceState(true);
    }

    const storedEmailNotificationsPref = localStorage.getItem(EMAIL_NOTIFICATIONS_PREFERENCE_KEY);
    if (storedEmailNotificationsPref !== null) {
      setEmailNotificationPreferenceState(storedEmailNotificationsPref === 'true');
    } else {
      // Default email notifications to true
      localStorage.setItem(EMAIL_NOTIFICATIONS_PREFERENCE_KEY, 'true');
      setEmailNotificationPreferenceState(true);
    }
    
    setIsLoading(false); 
  }, []); 

  const setAppTheme = (newTheme: string) => {
    setTheme(newTheme);
  };

  const handleSetSiteNotificationsPreference = (enabled: boolean) => {
    localStorage.setItem(SITE_NOTIFICATIONS_KEY, enabled.toString());
    setSiteNotificationsPreferenceState(enabled);
    // Existing logic for browser notifications if any, can remain or be adjusted.
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

  const handleSetEmailNotificationPreference = (enabled: boolean) => {
    localStorage.setItem(EMAIL_NOTIFICATIONS_PREFERENCE_KEY, enabled.toString());
    setEmailNotificationPreferenceState(enabled);
  };

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
      emailNotificationPreference,
      setEmailNotificationPreference: handleSetEmailNotificationPreference
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

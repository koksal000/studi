
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTheme } from 'next-themes';

interface SettingsContextType {
  notificationsEnabled: boolean;
  setNotificationsPreference: (enabled: boolean) => void; // Changed from toggleNotifications
  currentTheme: string | undefined;
  setAppTheme: (theme: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const NOTIFICATIONS_ENABLED_KEY = 'camlicaKoyuNotificationsEnabled';

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false); // Default to false until checked
  const { theme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedNotifications = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    if (storedNotifications !== null) {
      // Only set to true if browser permission is also granted
      if (JSON.parse(storedNotifications) && typeof window !== 'undefined' && window.Notification && Notification.permission === 'granted') {
        setNotificationsEnabledState(true);
      } else {
        setNotificationsEnabledState(false);
        // If preference was true but permission not granted, update localStorage to false
        if (JSON.parse(storedNotifications)) {
            localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, JSON.stringify(false));
        }
      }
    } else {
        // If no stored preference, default to false
        localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, JSON.stringify(false));
        setNotificationsEnabledState(false);
    }
    setIsLoading(false);
  }, []);

  const setNotificationsPreference = (enabled: boolean) => {
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, JSON.stringify(enabled));
    setNotificationsEnabledState(enabled);
  };

  const setAppTheme = (newTheme: string) => {
    setTheme(newTheme);
  };

  if (isLoading) {
     return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SettingsContext.Provider value={{ notificationsEnabled, setNotificationsPreference, currentTheme: theme, setAppTheme }}>
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

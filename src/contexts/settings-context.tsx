"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTheme } from 'next-themes';

interface SettingsContextType {
  notificationsEnabled: boolean;
  toggleNotifications: () => void;
  currentTheme: string | undefined;
  setAppTheme: (theme: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const NOTIFICATIONS_ENABLED_KEY = 'camlicaKoyuNotificationsEnabled';

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const { theme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedNotifications = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    if (storedNotifications !== null) {
      setNotificationsEnabled(JSON.parse(storedNotifications));
    }
    setIsLoading(false);
  }, []);

  const toggleNotifications = () => {
    setNotificationsEnabled(prev => {
      const newState = !prev;
      localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, JSON.stringify(newState));
      return newState;
    });
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
    <SettingsContext.Provider value={{ notificationsEnabled, toggleNotifications, currentTheme: theme, setAppTheme }}>
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
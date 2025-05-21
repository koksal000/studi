
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { useToast } from '@/hooks/use-toast'; 

interface SettingsContextType {
  notificationsEnabled: boolean;
  setNotificationsPreference: (enabled: boolean) => void;
  currentTheme: string | undefined;
  setAppTheme: (theme: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const NOTIFICATIONS_ENABLED_KEY = 'camlicaKoyuNotificationsEnabled';

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const { theme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast(); 

  useEffect(() => {
    const initializeNotificationSettings = async () => {
      console.log('[SettingsProvider] Initializing notification settings...');
      if (typeof window !== 'undefined' && window.Notification) {
        let currentPreference = false;
        const storedPreferenceJSON = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
        console.log('[SettingsProvider] Browser Notification.permission:', Notification.permission);
        console.log('[SettingsProvider] Stored preference JSON:', storedPreferenceJSON);


        if (Notification.permission === 'default') {
          console.log('[SettingsProvider] Notification permission is default. Requesting permission...');
          try {
            const permission = await Notification.requestPermission();
            console.log('[SettingsProvider] Permission request result:', permission);
            if (permission === 'granted') {
              currentPreference = true;
              toast({ title: "Bildirimler Etkinleştirildi", description: "Yeni duyurular için bildirim alacaksınız." });
            } else {
              currentPreference = false;
              if (permission === 'denied') {
                toast({ title: "Bildirimler Reddedildi", description: "Bildirimlere izin vermediniz. Ayarlardan değiştirebilirsiniz.", variant: 'default', duration: 7000 });
              }
            }
          } catch (error) {
            console.error("[SettingsProvider] Error requesting notification permission:", error);
            currentPreference = storedPreferenceJSON ? JSON.parse(storedPreferenceJSON) : false;
          }
        } else if (Notification.permission === 'granted') {
          console.log('[SettingsProvider] Notification permission already granted.');
          currentPreference = storedPreferenceJSON !== null ? JSON.parse(storedPreferenceJSON) : true;
        } else { // Notification.permission === 'denied'
          console.log('[SettingsProvider] Notification permission already denied.');
          currentPreference = false;
        }
        
        console.log('[SettingsProvider] Setting notificationsEnabledState to:', currentPreference);
        setNotificationsEnabledState(currentPreference);
        localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, JSON.stringify(currentPreference));

      } else {
        console.log('[SettingsProvider] Notifications not supported or not in browser environment.');
        const storedPreferenceJSON = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
        if (storedPreferenceJSON) {
          setNotificationsEnabledState(JSON.parse(storedPreferenceJSON));
        } else {
          setNotificationsEnabledState(false); 
        }
      }
      setIsLoading(false);
      console.log('[SettingsProvider] Notification settings initialized.');
    };

    initializeNotificationSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const setNotificationsPreference = (enabled: boolean) => {
    console.log('[SettingsProvider] setNotificationsPreference called with:', enabled);
    if (typeof window !== 'undefined' && window.Notification && Notification.permission === 'denied' && enabled) {
      toast({ title: "İzin Gerekli", description: "Bildirim almak için lütfen tarayıcı ayarlarınızdan bu siteye bildirim izni verin.", variant: 'destructive', duration: 7000 });
      localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, JSON.stringify(false));
      setNotificationsEnabledState(false);
      console.log('[SettingsProvider] Notification permission denied, preference set to false.');
      return;
    }
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, JSON.stringify(enabled));
    setNotificationsEnabledState(enabled);
    console.log('[SettingsProvider] Notification preference updated to:', enabled);
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

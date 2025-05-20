
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { useToast } from '@/hooks/use-toast'; // useToast import edildi

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
  const { toast } = useToast(); // toast hook'u kullanıma hazırlandı

  useEffect(() => {
    const initializeNotificationSettings = async () => {
      if (typeof window !== 'undefined' && window.Notification) {
        let currentPreference = false;
        const storedPreferenceJSON = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY);

        if (Notification.permission === 'default') {
          try {
            // Sayfa yüklendiğinde izin iste
            const permission = await Notification.requestPermission();
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
            console.error("Error requesting notification permission:", error);
            currentPreference = storedPreferenceJSON ? JSON.parse(storedPreferenceJSON) : false;
          }
        } else if (Notification.permission === 'granted') {
          // İzin zaten verilmiş, localStorage'daki tercihi yükle veya varsayılan olarak true yap
          currentPreference = storedPreferenceJSON !== null ? JSON.parse(storedPreferenceJSON) : true;
        } else { // Notification.permission === 'denied'
          // İzin reddedilmiş, tercihi false yap
          currentPreference = false;
        }
        
        setNotificationsEnabledState(currentPreference);
        localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, JSON.stringify(currentPreference));

      } else {
        // Bildirimler desteklenmiyor veya tarayıcı ortamında değiliz
        const storedPreferenceJSON = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
        if (storedPreferenceJSON) {
          setNotificationsEnabledState(JSON.parse(storedPreferenceJSON));
        } else {
          setNotificationsEnabledState(false); 
        }
      }
      setIsLoading(false);
    };

    initializeNotificationSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Sadece bileşen yüklendiğinde çalışır

  const setNotificationsPreference = (enabled: boolean) => {
    if (typeof window !== 'undefined' && window.Notification && Notification.permission === 'denied' && enabled) {
      toast({ title: "İzin Gerekli", description: "Bildirim almak için lütfen tarayıcı ayarlarınızdan bu siteye bildirim izni verin.", variant: 'destructive', duration: 7000 });
      localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, JSON.stringify(false));
      setNotificationsEnabledState(false);
      return;
    }
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


"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { useToast } from '@/hooks/use-toast'; 

interface SettingsContextType {
  // notificationsEnabled ve setNotificationsPreference kaldırıldı
  currentTheme: string | undefined;
  setAppTheme: (theme: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// NOTIFICATIONS_ENABLED_KEY kaldırıldı

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  // notificationsEnabled ve setNotificationsEnabledState kaldırıldı
  const { theme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(true); // Bu hala tema için gerekli olabilir.
  // const { toast } = useToast(); // Artık kullanılmıyor olabilir, eğer sadece bildirimler içinse

  useEffect(() => {
    // Sadece tema yüklenmesi için veya diğer başlangıç ayarları için kalabilir.
    // Bildirim izni ile ilgili mantık kaldırıldı.
    setIsLoading(false); 
  }, []); 

  // setNotificationsPreference fonksiyonu kaldırıldı

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
    <SettingsContext.Provider value={{ currentTheme: theme, setAppTheme }}>
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

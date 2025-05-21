
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AnnouncementStatusContextType {
  lastOpenedNotificationTimestamp: number | null;
  setLastOpenedNotificationTimestamp: (timestamp: number) => void;
  unreadCount: number; // Bu context'ten kaldırıldı, useAnnouncements'a taşındı.
                       // Ancak, unreadCount'ı tetiklemek için buradaki timestamp'ı kullanacağız.
}

const AnnouncementStatusContext = createContext<AnnouncementStatusContextType | undefined>(undefined);

const LAST_OPENED_KEY = 'camlicaKoyuLastOpenedNotificationTimestamp';

export const AnnouncementStatusProvider = ({ children }: { children: ReactNode }) => {
  const [lastOpenedNotificationTimestamp, setLastOpenedState] = useState<number | null>(null);

  useEffect(() => {
    const storedTimestamp = localStorage.getItem(LAST_OPENED_KEY);
    if (storedTimestamp) {
      setLastOpenedState(parseInt(storedTimestamp, 10));
    } else {
      // İlk açılışta, geçmiş tüm duyuruları "yeni" olarak göstermemek için
      // belki de şu anki zamanı ayarlayabiliriz ya da null bırakıp hook'ta yönetebiliriz.
      // Şimdilik null bırakalım, hook ilk yüklemede bunu dikkate alacak.
      setLastOpenedState(null);
    }
  }, []);

  const setLastOpenedNotificationTimestamp = (timestamp: number) => {
    localStorage.setItem(LAST_OPENED_KEY, timestamp.toString());
    setLastOpenedState(timestamp);
  };

  return (
    <AnnouncementStatusContext.Provider 
      value={{ 
        lastOpenedNotificationTimestamp, 
        setLastOpenedNotificationTimestamp,
        unreadCount: 0 // Bu artık doğrudan burada hesaplanmayacak
      }}
    >
      {children}
    </AnnouncementStatusContext.Provider>
  );
};

export const useAnnouncementStatus = (): AnnouncementStatusContextType => {
  const context = useContext(AnnouncementStatusContext);
  if (context === undefined) {
    throw new Error('useAnnouncementStatus must be used within an AnnouncementStatusProvider');
  }
  return context;
};

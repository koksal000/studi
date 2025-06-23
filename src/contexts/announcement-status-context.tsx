
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AnnouncementStatusContextType {
  lastOpenedNotificationTimestamp: number | null;
  setLastOpenedNotificationTimestamp: (timestamp: number) => void;
  isStatusLoading: boolean; 
}

const AnnouncementStatusContext = createContext<AnnouncementStatusContextType | undefined>(undefined);

const LAST_OPENED_KEY_LOCALSTORAGE = 'lastOpenedNotificationTimestamp'; // localStorage key

export const AnnouncementStatusProvider = ({ children }: { children: ReactNode }) => {
  const [lastOpenedNotificationTimestamp, setLastOpenedState] = useState<number | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(true);

  useEffect(() => {
    setIsStatusLoading(true);
    try {
      const storedTimestampString = localStorage.getItem(LAST_OPENED_KEY_LOCALSTORAGE);
      if (storedTimestampString !== null) {
        const storedTimestamp = parseInt(storedTimestampString, 10);
        if (!isNaN(storedTimestamp)) {
          setLastOpenedState(storedTimestamp);
        } else {
          setLastOpenedState(null);
          localStorage.removeItem(LAST_OPENED_KEY_LOCALSTORAGE); 
        }
      } else {
        setLastOpenedState(null); 
      }
    } catch (error) {
      console.error("Failed to load lastOpenedNotificationTimestamp from localStorage", error);
      localStorage.removeItem(LAST_OPENED_KEY_LOCALSTORAGE); 
      setLastOpenedState(null);
    } finally {
      setIsStatusLoading(false);
    }
  }, []);

  const updateLastOpenedNotificationTimestamp = (timestamp: number) => {
    try {
      localStorage.setItem(LAST_OPENED_KEY_LOCALSTORAGE, timestamp.toString());
      setLastOpenedState(timestamp);
    } catch (error) {
      console.error("Failed to save lastOpenedNotificationTimestamp to localStorage", error);
    }
  };

  if (isStatusLoading && typeof window === 'undefined') { 
      return null;
  }

  return (
    <AnnouncementStatusContext.Provider 
      value={{ 
        lastOpenedNotificationTimestamp, 
        setLastOpenedNotificationTimestamp: updateLastOpenedNotificationTimestamp,
        isStatusLoading 
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

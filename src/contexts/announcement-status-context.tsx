
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAppState, setAppState } from '@/lib/idb';

interface AnnouncementStatusContextType {
  lastOpenedNotificationTimestamp: number | null;
  setLastOpenedNotificationTimestamp: (timestamp: number) => void;
  isStatusLoading: boolean; 
}

const AnnouncementStatusContext = createContext<AnnouncementStatusContextType | undefined>(undefined);

const LAST_OPENED_KEY_IDB = 'lastOpenedNotificationTimestamp';

export const AnnouncementStatusProvider = ({ children }: { children: ReactNode }) => {
  const [lastOpenedNotificationTimestamp, setLastOpenedState] = useState<number | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(true);

  useEffect(() => {
    const loadTimestamp = async () => {
      setIsStatusLoading(true);
      try {
        const storedTimestamp = await getAppState<number>(LAST_OPENED_KEY_IDB);
        if (storedTimestamp !== undefined) { // Check for undefined as value could be 0
          setLastOpenedState(storedTimestamp);
        } else {
          setLastOpenedState(null); 
        }
      } catch (error) {
        console.error("Failed to load lastOpenedNotificationTimestamp from IndexedDB", error);
        setLastOpenedState(null);
      } finally {
        setIsStatusLoading(false);
      }
    };
    loadTimestamp();
  }, []);

  const updateLastOpenedNotificationTimestamp = async (timestamp: number) => {
    await setAppState<number>(LAST_OPENED_KEY_IDB, timestamp);
    setLastOpenedState(timestamp);
  };

  // Wait for status to load before rendering children, or show a global loader
  // This simple example just renders children once loading is done.
  // You might combine this with UserProvider's loader or have a separate one.
  if (isStatusLoading) {
    // You could return a loader here if this context's loading is critical path
    // For now, we assume UserProvider's loader covers the initial app load.
    // If this context loads significantly slower, this might need adjustment.
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

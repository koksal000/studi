
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useTheme } from 'next-themes';

export interface DirectMessage {
  title: string;
  body: string;
}

interface SettingsContextType {
  currentTheme: string | undefined;
  setAppTheme: (theme: string) => void;
  directMessage: DirectMessage | null;
  setDirectMessage: (message: DirectMessage | null) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { theme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [directMessage, setDirectMessage] = useState<DirectMessage | null>(null);

  useEffect(() => {
    setIsLoading(false); 
  }, []); 

  const setAppTheme = useCallback((newTheme: string) => {
    setTheme(newTheme);
  }, [setTheme]);

  const contextValue = useMemo(() => ({
    currentTheme: theme, 
    setAppTheme,
    directMessage,
    setDirectMessage,
  }), [theme, setAppTheme, directMessage]);

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
    <SettingsContext.Provider value={contextValue}>
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

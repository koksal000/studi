
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useTheme } from 'next-themes';

interface SettingsContextType {
  currentTheme: string | undefined;
  setAppTheme: (theme: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { theme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // This effect now only handles things that might cause a delay in loading settings,
    // like checking the theme. Notification logic has been moved.
    setIsLoading(false); 
  }, []); 

  const setAppTheme = useCallback((newTheme: string) => {
    setTheme(newTheme);
  }, [setTheme]);

  const contextValue = useMemo(() => ({
    currentTheme: theme, 
    setAppTheme,
  }), [theme, setAppTheme]);

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

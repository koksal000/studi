
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { ADMIN_PASSWORD } from '@/lib/constants';
import { useOneSignal } from './onesignal-context';
import { v4 as uuidv4 } from 'uuid';

interface User {
  name: string;
  surname: string;
  anonymousId: string; // The primary, stable identifier
  email?: string | null; // Email is now optional
}

interface UserContextType {
  user: User | null;
  isAdmin: boolean;
  login: (name: string, surname: string, email?: string | null) => void;
  logout: () => void;
  updateUserProfile: (updates: Partial<Pick<User, 'name' | 'surname' | 'email'>>) => Promise<void>;
  checkAdminPassword: (password: string) => boolean;
  showEntryForm: boolean;
  setShowEntryForm: (show: boolean) => void;
  isUserLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);
const USER_DATA_KEY = 'camlicaKoyuUser_v3'; // Increased version for new structure
const ADMIN_SESSION_KEY = 'camlicaKoyuAdminSession';

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const { loginOneSignal, logoutOneSignal, promptForNotifications } = useOneSignal();

  useEffect(() => {
    setIsUserLoading(true);
    try {
      let storedUserString = localStorage.getItem(USER_DATA_KEY);
      let userData: User | null = storedUserString ? JSON.parse(storedUserString) : null;

      if (userData?.name && userData.surname) {
        if (!userData.anonymousId) {
          userData.anonymousId = uuidv4();
          localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
        }
        setUserState(userData);
        loginOneSignal(userData.anonymousId, userData.email);
        setShowEntryForm(false);
      } else {
        localStorage.removeItem(USER_DATA_KEY);
        setShowEntryForm(true);
      }

      const adminSession = sessionStorage.getItem(ADMIN_SESSION_KEY);
      if (adminSession === 'true') {
        setIsAdmin(true);
      }
    } catch (error) {
      console.error("Failed to load user data from storage", error);
      localStorage.removeItem(USER_DATA_KEY);
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      setShowEntryForm(true);
    } finally {
      setIsUserLoading(false);
    }
  }, [loginOneSignal]);
  
  const updateUserProfileOnServer = async (userProfile: User) => {
    try {
      const response = await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userProfile),
      });
      if (!response.ok) console.warn("[UserContext] Failed to sync user profile to server.");
      else console.log("[UserContext] User profile synced to server.");
    } catch (error) {
      console.error("[UserContext] Error syncing profile to server:", error);
    }
  };

  const login = useCallback(async (name: string, surname: string, email?: string | null) => {
    const anonymousId = uuidv4();
    const newUser: User = { name, surname, anonymousId, email: email || null };

    // Ask for notification permission immediately
    await promptForNotifications();

    setUserState(newUser);
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(newUser));
    
    loginOneSignal(anonymousId, email);

    await updateUserProfileOnServer(newUser);
    await fetch('/api/stats/entry-count', { method: 'POST' });
    
    setShowEntryForm(false);
  }, [loginOneSignal, promptForNotifications]);

  const updateUserProfile = useCallback(async (updates: Partial<Pick<User, 'name' | 'surname' | 'email'>>) => {
    if (!user) return;

    const updatedUser = { ...user, ...updates };
    
    setUserState(updatedUser);
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(updatedUser));
    
    // If email changes, re-login to OneSignal to associate the email
    if (updates.email !== undefined) {
      loginOneSignal(updatedUser.anonymousId, updates.email);
    }

    await updateUserProfileOnServer(updatedUser);
  }, [user, loginOneSignal]);

  const logout = useCallback(() => {
    logoutOneSignal();
    setUserState(null);
    setIsAdmin(false);
    localStorage.removeItem(USER_DATA_KEY);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setShowEntryForm(true);
  }, [logoutOneSignal]);

  const checkAdminPassword = useCallback((password: string) => {
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
      return true;
    }
    return false;
  }, []);

  const contextValue = useMemo(() => ({
    user,
    isAdmin,
    login,
    logout,
    updateUserProfile,
    checkAdminPassword,
    showEntryForm,
    setShowEntryForm,
    isUserLoading
  }), [user, isAdmin, login, logout, updateUserProfile, checkAdminPassword, showEntryForm, isUserLoading]);

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

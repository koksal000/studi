
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ADMIN_PASSWORD } from '@/lib/constants';
import { getUserProfile, setUserProfile, deleteUserProfile } from '@/lib/idb';

interface User {
  name: string;
  surname: string;
}

interface UserContextType {
  user: User | null;
  isAdmin: boolean;
  login: (name: string, surname: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAdminPassword: (password: string) => boolean;
  showEntryForm: boolean;
  setShowEntryForm: (show: boolean) => void;
  isUserLoading: boolean; // Renamed from isLoading to avoid conflict if other contexts use it
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// USER_DATA_KEY is no longer needed as we use 'currentUser' as fixed key in IndexedDB

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUserLoading, setIsUserLoading] = useState(true); // Start true until DB check is done
  const [showEntryForm, setShowEntryForm] = useState(false); // Default to false, useEffect will show if no user


  useEffect(() => {
    const loadUser = async () => {
      setIsUserLoading(true);
      try {
        const storedUser = await getUserProfile();
        if (storedUser) {
          setUserState({ name: storedUser.name, surname: storedUser.surname });
          setShowEntryForm(false);
        } else {
          setShowEntryForm(true);
        }
      } catch (error) {
        console.error("Failed to load user data from IndexedDB", error);
        setShowEntryForm(true); 
      } finally {
        setIsUserLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (name: string, surname: string) => {
    const newUser: User = { name, surname };
    setUserState(newUser);
    await setUserProfile(name, surname);
    setShowEntryForm(false);
  };

  const logout = async () => {
    setUserState(null);
    setIsAdmin(false);
    await deleteUserProfile();
    setShowEntryForm(true);
  };

  const checkAdminPassword = (password: string) => {
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      return true;
    }
    setIsAdmin(false);
    return false;
  };
  
  if (isUserLoading) { // Use the context-specific loading state
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }


  return (
    <UserContext.Provider value={{ user, isAdmin, login, logout, checkAdminPassword, showEntryForm, setShowEntryForm, isUserLoading }}>
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

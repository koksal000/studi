
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { ADMIN_PASSWORD } from '@/lib/constants';

interface User {
  name: string;
  surname: string;
  email: string; 
}

interface UserContextType {
  user: User | null;
  isAdmin: boolean;
  login: (name: string, surname: string, email: string) => void;
  logout: () => void;
  checkAdminPassword: (password: string) => boolean;
  showEntryForm: boolean;
  setShowEntryForm: (show: boolean) => void;
  isUserLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);
const USER_DATA_KEY = 'camlicaKoyuUser_v2';

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [showEntryForm, setShowEntryForm] = useState(false);


  useEffect(() => {
    setIsUserLoading(true);
    try {
      const storedUserString = localStorage.getItem(USER_DATA_KEY);
      if (storedUserString) {
        const storedUser = JSON.parse(storedUserString) as User;
        if (storedUser.name && storedUser.surname && storedUser.email) {
          setUserState(storedUser);
          setShowEntryForm(false);
        } else {
          localStorage.removeItem(USER_DATA_KEY);
          setShowEntryForm(true);
        }
      } else {
        setShowEntryForm(true);
      }
    } catch (error) {
      console.error("Failed to load user data from localStorage", error);
      localStorage.removeItem(USER_DATA_KEY); 
      setShowEntryForm(true); 
    } finally {
      setIsUserLoading(false);
    }
  }, []);

  const login = useCallback((name: string, surname: string, email: string) => {
    const newUser: User = { name, surname, email };
    setUserState(newUser);
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(newUser));
    setShowEntryForm(false);
  }, []);

  const logout = useCallback(() => {
    setUserState(null);
    setIsAdmin(false);
    localStorage.removeItem(USER_DATA_KEY);
    setShowEntryForm(true);
  }, []);

  const checkAdminPassword = useCallback((password: string) => {
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      return true;
    }
    setIsAdmin(false);
    return false;
  }, []);
  
  const contextValue = useMemo(() => ({
    user,
    isAdmin,
    login,
    logout,
    checkAdminPassword,
    showEntryForm,
    setShowEntryForm,
    isUserLoading
  }), [user, isAdmin, login, logout, checkAdminPassword, showEntryForm, isUserLoading]);

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

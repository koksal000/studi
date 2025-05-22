
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ADMIN_PASSWORD } from '@/lib/constants';

interface User {
  name: string;
  surname: string;
  email?: string; // E-posta alanı eklendi (isteğe bağlı)
}

interface UserContextType {
  user: User | null;
  isAdmin: boolean;
  login: (name: string, surname: string, email?: string) => void; // Email parametresi eklendi
  logout: () => void;
  checkAdminPassword: (password: string) => boolean;
  showEntryForm: boolean;
  setShowEntryForm: (show: boolean) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const USER_DATA_KEY = 'camlicaKoyuUserData';

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showEntryForm, setShowEntryForm] = useState(false);


  useEffect(() => {
    try {
      const storedUserData = localStorage.getItem(USER_DATA_KEY);
      if (storedUserData) {
        const parsedUser = JSON.parse(storedUserData) as User; // User tipine cast edildi
        setUser(parsedUser);
        setShowEntryForm(false);
      } else {
        setShowEntryForm(true);
      }
    } catch (error) {
      console.error("Failed to parse user data from localStorage", error);
      setShowEntryForm(true); 
    }
    setIsLoading(false);
  }, []);

  const login = (name: string, surname: string, email?: string) => {
    const newUser: User = { name, surname };
    if (email && email.trim() !== '') {
      newUser.email = email.trim();
    }
    setUser(newUser);
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(newUser));
    setShowEntryForm(false);
  };

  const logout = () => {
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem(USER_DATA_KEY);
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
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }


  return (
    <UserContext.Provider value={{ user, isAdmin, login, logout, checkAdminPassword, showEntryForm, setShowEntryForm }}>
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

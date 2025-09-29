
// src/hooks/use-users.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';

export interface UserProfile {
  id: string; // This will be the anonymousId
  name: string;
  surname: string;
  email?: string | null;
  anonymousId: string;
  joinedAt: string;
  lastUpdatedAt: string;
}

export function useUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/user-profile');
      if (!response.ok) {
        throw new Error('Kullanıcı verileri sunucudan alınamadı.');
      }
      const data: UserProfile[] = await response.json();
      // Sort by last activity date, newest first
      data.sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());
      setUsers(data);
    } catch (error: any) {
      toast({
        title: 'Kullanıcılar Yüklenemedi',
        description: error.message,
        variant: 'destructive',
      });
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    isLoading,
    refetchUsers: fetchUsers,
  };
}

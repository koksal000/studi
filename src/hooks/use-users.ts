
// src/hooks/use-users.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';
import type { UserProfile as UserProfileType } from '@/app/api/user-profile/route';

export type UserProfile = UserProfileType;

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

    
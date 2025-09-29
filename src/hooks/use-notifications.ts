
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { useToast } from './use-toast';
import type { AppNotification } from '@/app/api/notifications/route';

export { type AppNotification };

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, isAdmin } = useUser();
  const { toast } = useToast();

  const getUserId = useCallback(() => {
    if (!user) return null;
    return user.anonymousId;
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    const userId = getUserId();
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    if (notifications.length === 0) {
      setIsLoading(true);
    }
    
    try {
      const response = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) {
        throw new Error("Bildirimler alınamadı.");
      }
      const data: AppNotification[] = await response.json();
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    } catch (error: any) {
      toast({ title: 'Bildirim Hatası', description: error.message, variant: 'destructive' });
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [getUserId, toast, notifications.length]);

  useEffect(() => {
    if (user) {
        fetchNotifications();
    } else {
        setIsLoading(false);
        setNotifications([]);
        setUnreadCount(0);
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  
  useEffect(() => {
    const channel = new BroadcastChannel('notification_updates');
    const handleMessage = (event: MessageEvent) => {
        if (event.data === 'update') {
            fetchNotifications();
        }
    };
    channel.addEventListener('message', handleMessage);
    return () => {
        channel.removeEventListener('message', handleMessage);
        channel.close();
    };
  }, [fetchNotifications]);


  const markAllAsRead = useCallback(async () => {
    const userId = getUserId();
    if (!userId || unreadCount === 0) {
      return;
    }

    const originalNotifications = [...notifications];
    const newNotifications = notifications.map(n => ({ ...n, read: true }));
    setNotifications(newNotifications);
    setUnreadCount(0);

    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        throw new Error('Bildirimler okundu olarak işaretlenemedi.');
      }
    } catch (error: any) {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
      setNotifications(originalNotifications);
      setUnreadCount(originalNotifications.filter(n => !n.read).length);
    }
  }, [getUserId, notifications, unreadCount, toast]);

  return { 
    notifications,
    isLoading, 
    unreadCount,
    markAllAsRead,
    refetchNotifications: fetchNotifications,
  };
}

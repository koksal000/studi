
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { useAnnouncementStatus } from '@/contexts/announcement-status-context';
import type { SettingsContextType } from '@/contexts/settings-context';
import { useSettings } from '@/contexts/settings-context';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  media?: string | null;
  mediaType?: string | null;
  date: string;
  author: string;
  authorId?: string;
}

export type NewAnnouncementPayload = Omit<Announcement, 'id' | 'date'>;

const ANNOUNCEMENTS_LOCAL_STORAGE_KEY = 'camlicaKoyuAnnouncements_localStorage';

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const announcementsRef = useRef(announcements);

  const { user } = useUser();
  const { lastOpenedNotificationTimestamp } = useAnnouncementStatus();
  const [unreadCount, setUnreadCount] = useState(0);
  const { siteNotificationsPreference } = useSettings();

  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    announcementsRef.current = announcements;
    if (lastOpenedNotificationTimestamp) {
      const newUnreadCount = announcements.filter(
        (ann) => new Date(ann.date).getTime() > lastOpenedNotificationTimestamp
      ).length;
      setUnreadCount(newUnreadCount);
    } else {
      setUnreadCount(announcements.length > 0 ? announcements.length : 0);
    }
  }, [announcements, lastOpenedNotificationTimestamp]);

  const showNotification = useCallback((title: string, body: string) => {
    console.log("[useAnnouncements] Attempting to show notification. Preference:", siteNotificationsPreference, "Browser Permission:", Notification.permission);
    if (siteNotificationsPreference && Notification.permission === 'granted') {
      if (document.visibilityState === 'visible') {
        try {
          const notification = new Notification(title, {
            body: body,
            icon: '/images/logo.png',
          });
          notification.onclick = (event) => {
            event.preventDefault();
            window.open('https://studi-ldexx24gi-koksals-projects-00474b3b.vercel.app/', '_blank');
            notification.close();
          };
        } catch (err: any) {
          console.error("[useAnnouncements] Notification error message:", err.message);
          console.error("[useAnnouncements] Notification error name:", err.name);
          toast({
            title: "Bildirim Hatası",
            description: `Tarayıcı bildirimi gösterilemedi: ${err.message}. Lütfen tarayıcı ayarlarınızı kontrol edin.`,
            variant: "destructive",
            duration: 7000,
          });
        }
      } else {
        console.log("[useAnnouncements] Document not visible, skipping notification.");
      }
    } else {
        if (!siteNotificationsPreference) console.log("[useAnnouncements] Notification skipped: User preference is off.");
        if (Notification.permission !== 'granted') console.log("[useAnnouncements] Notification skipped: Browser permission not granted. Current status:", Notification.permission);
    }
  }, [siteNotificationsPreference, toast]);

  const loadAnnouncementsFromLocalStorage = useCallback(() => {
    setIsLoading(true);
    try {
      const storedAnnouncements = localStorage.getItem(ANNOUNCEMENTS_LOCAL_STORAGE_KEY);
      if (storedAnnouncements) {
        const parsed = JSON.parse(storedAnnouncements) as Announcement[];
        parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAnnouncements(parsed);
      } else {
        // Optionally, fetch from API as a fallback if localStorage is empty for a new user
        // For now, we'll rely on SSE to populate if it's empty.
        setAnnouncements([]);
      }
    } catch (error) {
      console.error("[Announcements] Failed to load announcements from localStorage:", error);
      setAnnouncements([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncementsFromLocalStorage();
  }, [loadAnnouncementsFromLocalStorage]);

  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const newEventSource = new EventSource('/api/announcements/stream');
    eventSourceRef.current = newEventSource;

    newEventSource.onopen = () => {
      // console.log('[SSE Announcements] Connection opened.');
    };

    newEventSource.onmessage = (event) => {
      try {
        const updatedAnnouncementsFromServer: Announcement[] = JSON.parse(event.data);
        // Sort by date descending before setting
        updatedAnnouncementsFromServer.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const currentLocalAnnouncements = announcementsRef.current;
        updatedAnnouncementsFromServer.forEach(newAnn => {
          const isTrulyNew = !currentLocalAnnouncements.some(localAnn => localAnn.id === newAnn.id && localAnn.date === newAnn.date);
          if (isTrulyNew) {
             showNotification(`Yeni Duyuru: ${newAnn.title}`, newAnn.content.substring(0, 100) + "...");
          }
        });
        
        setAnnouncements(updatedAnnouncementsFromServer);
        localStorage.setItem(ANNOUNCEMENTS_LOCAL_STORAGE_KEY, JSON.stringify(updatedAnnouncementsFromServer));
      } catch (error) {
        console.error("[SSE Announcements] Error processing SSE message:", error);
      }
    };

    newEventSource.onerror = (errorEvent: Event) => {
      const target = errorEvent.target as EventSource;
      const readyState = target?.readyState;
      const eventType = errorEvent.type || 'unknown event type';
      
      if (readyState === EventSource.CLOSED) {
        console.warn(
          `[SSE Announcements] Connection closed. EventSource readyState: ${readyState}, Event Type: ${eventType}. Browser will attempt to reconnect. Full Event:`, errorEvent
        );
      } else {
        console.error(
          `[SSE Announcements] Connection error. EventSource readyState: ${readyState}, Event Type: ${eventType}, Full Event:`, errorEvent
        );
      }
    };

    return () => {
      const es = eventSourceRef.current;
      if (es) {
        es.close();
        eventSourceRef.current = null;
      }
    };
  }, [showNotification]);

  const addAnnouncement = useCallback(async (newAnnouncementData: Omit<Announcement, 'id' | 'date' | 'author' | 'authorId'>) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Duyuru eklemek için giriş yapmalısınız.", variant: "destructive" });
      return;
    }

    const newAnnouncement: Announcement = {
      ...newAnnouncementData,
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      date: new Date().toISOString(),
      author: `${user.name} ${user.surname}`,
    };

    // Update local state and localStorage first
    setAnnouncements(prev => {
      const updated = [newAnnouncement, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      localStorage.setItem(ANNOUNCEMENTS_LOCAL_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    // Then, notify the server to broadcast via SSE
    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAnnouncement), // Send the full new announcement
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        throw new Error(errorData.message || 'Duyuru sunucuya iletilemedi');
      }
      // SSE will handle broadcasting to other clients
    } catch (error: any) {
      console.error("[Announcements] Failed to notify server about new announcement:", error);
      toast({ title: "Duyuru Gönderilemedi", description: error.message || "Yeni duyuru diğer kullanıcılara iletilirken bir sorun oluştu.", variant: "destructive" });
      // Optionally, revert local change if server notification fails, though this can be complex
    }
  }, [user, toast]);

  const deleteAnnouncement = useCallback(async (id: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Duyuru silmek için giriş yapmalısınız.", variant: "destructive" });
      return;
    }

    // Update local state and localStorage first
    setAnnouncements(prev => {
      const updated = prev.filter(ann => ann.id !== id);
      localStorage.setItem(ANNOUNCEMENTS_LOCAL_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    
    // Then, notify the server to broadcast the deletion via SSE
    try {
      const response = await fetch(`/api/announcements?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        throw new Error(errorData.message || 'Duyuru silme bilgisi sunucuya iletilemedi');
      }
      // SSE will handle broadcasting to other clients
    } catch (error: any) {
      console.error("[Announcements] Failed to notify server about deleted announcement:", error);
      toast({ title: "Duyuru Silinemedi", description: error.message || "Duyuru silme bilgisi diğer kullanıcılara iletilirken bir sorun oluştu.", variant: "destructive" });
      // Optionally, revert local change
    }
  }, [user, toast]);

  const getAnnouncementById = useCallback((id: string): Announcement | undefined => {
    return announcements.find(ann => ann.id === id);
  }, [announcements]);

  return { announcements, addAnnouncement, deleteAnnouncement, getAnnouncementById, isLoading, unreadCount };
}

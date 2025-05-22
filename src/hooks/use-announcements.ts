
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { useAnnouncementStatus } from '@/contexts/announcement-status-context';
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

export type NewAnnouncementPayload = {
  title: string;
  content: string;
  media?: string | null;
  mediaType?: string | null;
};

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const { user } = useUser();
  const { lastOpenedNotificationTimestamp } = useAnnouncementStatus();
  const [unreadCount, setUnreadCount] = useState(0);
  const { siteNotificationsPreference } = useSettings();

  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isLoading, setIsLoading] = useState(true); 
  const initialDataLoadedRef = useRef(false); 

  useEffect(() => {
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
    if (!siteNotificationsPreference) {
      console.log("[useAnnouncements] Notification skipped: User preference is off.");
      return;
    }
    if (Notification.permission !== 'granted') {
      console.log("[useAnnouncements] Notification skipped: Browser permission not granted. Current status:", Notification.permission);
      return;
    }

    if (document.visibilityState === 'visible') {
      try {
        const notification = new Notification(title, {
          body: body,
          icon: '/images/logo.png', // Ensure you have a logo here
        });
        notification.onclick = (event) => {
          event.preventDefault();
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://studi-ldexx24gi-koksals-projects-00474b3b.vercel.app/'; 
          window.open(appUrl, '_blank');
          if (window.focus) window.focus();
          notification.close();
        };
      } catch (err: any) {
        console.error("[SSE Announcements] Notification error message:", err.message);
        console.error("[SSE Announcements] Notification error name:", err.name);
        toast({
          title: "Tarayıcı Bildirimi Hatası",
          description: `Tarayıcı bildirimi gösterilemedi: ${err.message}. Tarayıcı ayarlarınızı veya sayfa odağını kontrol edin.`,
          variant: "warning",
          duration: 7000,
        });
      }
    } else {
      console.log("[useAnnouncements] Document not visible, skipping foreground notification.");
    }
  }, [siteNotificationsPreference, toast]);


  useEffect(() => {
    initialDataLoadedRef.current = false; // Reset for new connection attempts
    setIsLoading(true); // Set loading true at the start of effect

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/announcements/stream');
    eventSourceRef.current = es;

    es.onopen = () => {
      // console.log('[SSE Announcements] Connection opened.');
    };

    es.onmessage = (event) => {
      try {
        const updatedAnnouncementsFromServer: Announcement[] = JSON.parse(event.data);
        
        const previousAnnouncements = announcements; // Capture current state before setting
        const isNewDataDifferent = JSON.stringify(previousAnnouncements) !== JSON.stringify(updatedAnnouncementsFromServer);

        if (isNewDataDifferent) {
           setAnnouncements(updatedAnnouncementsFromServer);
        }

        if (updatedAnnouncementsFromServer.length > 0 && initialDataLoadedRef.current && isNewDataDifferent) { 
            const latestServerAnnouncement = updatedAnnouncementsFromServer[0];
            const isTrulyNew = !previousAnnouncements.some(ann => ann.id === latestServerAnnouncement.id) || 
                               (new Date(latestServerAnnouncement.date) > new Date(previousAnnouncements.find(a => a.id === latestServerAnnouncement.id)?.date || 0).getTime());
            
            if (isTrulyNew && (!user || (latestServerAnnouncement.authorId && user && latestServerAnnouncement.authorId !== user.name + user.surname))) {
                 showNotification(`Yeni Duyuru: ${latestServerAnnouncement.title}`, latestServerAnnouncement.content.substring(0, 100) + "...");
            }
        }
        
        if (!initialDataLoadedRef.current) {
          setIsLoading(false);
          initialDataLoadedRef.current = true;
        }

      } catch (error) {
        console.error("[SSE Announcements] Error processing SSE message:", error);
        if (!initialDataLoadedRef.current) {
          setIsLoading(false);
          initialDataLoadedRef.current = true;
        }
      }
    };

    es.onerror = (errorEvent: Event) => {
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
      if (!initialDataLoadedRef.current) {
        setIsLoading(false);
        initialDataLoadedRef.current = true;
      }
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNotification, user]); 

  const addAnnouncement = useCallback(async (payload: NewAnnouncementPayload) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Duyuru eklemek için giriş yapmalısınız.", variant: "destructive" });
      return Promise.reject(new Error("User not logged in"));
    }
    if (!payload.title?.trim() || !payload.content?.trim()) {
        toast({ title: "Eksik Bilgi", description: "Başlık ve içerik boş bırakılamaz.", variant: "destructive" });
        return Promise.reject(new Error("Title and content are required."));
    }
    
    const newAnnouncementData: Announcement = {
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      title: payload.title,
      content: payload.content,
      media: payload.media || null,
      mediaType: payload.mediaType || null,
      date: new Date().toISOString(),
      author: `${user.name} ${user.surname}`,
      authorId: user.name + user.surname,
    };

    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAnnouncementData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        toast({ title: "Duyuru Gönderilemedi", description: errorData.message || "Sunucu hatası oluştu.", variant: "destructive" });
        throw new Error(errorData.message || 'Duyuru sunucuya iletilemedi');
      }
      // UI güncellenmesi SSE üzerinden olacak
    } catch (error: any) {
      console.error("[Announcements] Failed to send new announcement to server:", error);
      toast({ title: "Duyuru Eklenemedi", description: error.message || "Ağ hatası veya beklenmedik bir sorun oluştu.", variant: "destructive" });
      throw error; // Re-throw error for the calling component to handle if needed
    }
  }, [user, toast]);

  const deleteAnnouncement = useCallback(async (id: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Duyuru silmek için giriş yapmalısınız.", variant: "destructive" });
      return Promise.reject(new Error("User not logged in"));
    }

    try {
      const response = await fetch(`/api/announcements?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        toast({ title: "Duyuru Silinemedi", description: errorData.message || "Sunucu hatası oluştu.", variant: "destructive" });
        throw new Error(errorData.message || 'Duyuru silme bilgisi sunucuya iletilemedi');
      }
      // UI güncellenmesi SSE üzerinden olacak
    } catch (error: any) {
      console.error("[Announcements] Failed to notify server about deleted announcement:", error);
      toast({ title: "Duyuru Silinemedi", description: error.message || "Duyuru silme işlemi sırasında bir sorun oluştu.", variant: "destructive" });
      throw error; // Re-throw error
    }
  }, [user, toast]);

  const getAnnouncementById = useCallback((id: string): Announcement | undefined => {
    return announcements.find(ann => ann.id === id);
  }, [announcements]);

  return { announcements, addAnnouncement, deleteAnnouncement, getAnnouncementById, isLoading, unreadCount };
}

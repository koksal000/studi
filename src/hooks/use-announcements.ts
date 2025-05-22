
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Announcement, NewAnnouncementPayload } from '@/hooks/use-announcements'; // Ensure Announcement type is also exported if needed elsewhere
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { useAnnouncementStatus } from '@/contexts/announcement-status-context';
import { useSettings } from '@/contexts/settings-context';

// Re-exporting for use in other files if necessary, or ensure it's defined where needed.
// export interface Announcement { ... }

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const { user } = useUser();
  const { lastOpenedNotificationTimestamp, setLastOpenedNotificationTimestamp } = useAnnouncementStatus();
  const [unreadCount, setUnreadCount] = useState(0);
  const { siteNotificationsPreference } = useSettings();

  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialDataLoadedRef = useRef(false);
  const announcementsRef = useRef<Announcement[]>(announcements); // Ref to keep track of current announcements

  useEffect(() => {
    announcementsRef.current = announcements; // Keep ref updated
    if (lastOpenedNotificationTimestamp === null && announcements.length > 0 && initialDataLoadedRef.current) {
      // If it's the first load (lastOpened is null) and we have announcements,
      // consider all current announcements as "read" by setting the timestamp.
      // This prevents all initial announcements from showing as unread.
      // Or, if you want to show all as unread on first ever load, remove this block.
      setLastOpenedNotificationTimestamp(Date.now());
      setUnreadCount(0);
    } else if (lastOpenedNotificationTimestamp) {
      const newUnreadCount = announcements.filter(
        (ann) => new Date(ann.date).getTime() > lastOpenedNotificationTimestamp
      ).length;
      setUnreadCount(newUnreadCount);
    } else {
       // Handles case where lastOpened is null and announcements is empty (or still loading)
      setUnreadCount(0);
    }
  }, [announcements, lastOpenedNotificationTimestamp, setLastOpenedNotificationTimestamp]);


  const showNotification = useCallback((title: string, body: string) => {
    if (!siteNotificationsPreference) {
      console.log("[SSE Announcements] Notification skipped: User preference is off.");
      return;
    }
    if (Notification.permission !== 'granted') {
      console.log("[SSE Announcements] Notification skipped: Browser permission not granted. Current status:", Notification.permission);
      return;
    }

    if (document.visibilityState === 'visible') {
      try {
        const notification = new Notification(title, {
          body: body,
          icon: '/images/logo.png',
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
          description: `Tarayıcı bildirimi gösterilemedi: ${err.message}. Bu genellikle sayfa odakta değilken veya tarayıcı ayarları nedeniyle olur.`,
          variant: "warning",
          duration: 8000,
        });
      }
    } else {
      console.log("[SSE Announcements] Document not visible, skipping foreground notification.");
    }
  }, [siteNotificationsPreference, toast]);

  useEffect(() => {
    setIsLoading(true);
    initialDataLoadedRef.current = false;

    fetch('/api/announcements')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch initial announcements: ${res.status}`);
        return res.json();
      })
      .then((data: Announcement[]) => {
        setAnnouncements(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      })
      .catch(err => {
        console.error("[Announcements] Failed to fetch initial announcements:", err);
        // Do not toast here, SSE connection will handle further UI
      })
      .finally(() => {
        // SSE will handle the final isLoading=false after its first message or error
      });
    
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
        const previousAnnouncements = announcementsRef.current;
        setAnnouncements(updatedAnnouncementsFromServer);

        if (updatedAnnouncementsFromServer.length > 0 && initialDataLoadedRef.current) {
            const latestServerAnnouncement = updatedAnnouncementsFromServer[0]; // Assumes newest is first
            const isTrulyNew = !previousAnnouncements.some(ann => ann.id === latestServerAnnouncement.id) ||
                               (new Date(latestServerAnnouncement.date).getTime() > new Date(previousAnnouncements.find(a => a.id === latestServerAnnouncement.id)?.date || 0).getTime());

            if (isTrulyNew && (!user || (latestServerAnnouncement.authorId && user && latestServerAnnouncement.authorId !== `${user.name} ${user.surname}`))) {
                 showNotification(`Yeni Duyuru: ${latestServerAnnouncement.title}`, latestServerAnnouncement.content.substring(0, 100) + "...");
            }
        }
      } catch (error) {
        console.error("[SSE Announcements] Error processing SSE message:", error);
      } finally {
        if (!initialDataLoadedRef.current) {
            setIsLoading(false);
            initialDataLoadedRef.current = true;
        }
      }
    };

    newEventSource.onerror = (errorEvent: Event) => {
      const target = errorEvent.target as EventSource;
      if (eventSourceRef.current !== target) {
        return; // Error from an old EventSource instance
      }
      const readyState = target?.readyState;
      const eventType = errorEvent.type || 'unknown event type';
      
      if (readyState === EventSource.CLOSED) {
        console.warn(
          `[SSE Announcements] Connection closed. EventSource readyState: ${readyState}, Event Type: ${eventType}. Browser will attempt to reconnect. Full Event:`, errorEvent
        );
      } else if (readyState === EventSource.CONNECTING) { // Specifically for readyState 0
        console.warn(
          `[SSE Announcements] Initial connection failed or connection attempt error. EventSource readyState: ${readyState}, Event Type: ${eventType}. Full Event:`, errorEvent,
          "This might be due to NEXT_PUBLIC_APP_URL not being set correctly in your deployment environment, or the stream API endpoint having issues."
        );
      }
       else {
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
      if (newEventSource) {
        newEventSource.close();
      }
      eventSourceRef.current = null;
    };
  }, [showNotification, user, toast]); // Removed isLoading from dependencies

  const addAnnouncement = useCallback(async (payload: NewAnnouncementPayload) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Duyuru eklemek için giriş yapmalısınız.", variant: "destructive" });
      return Promise.reject(new Error("User not logged in"));
    }
     if (!payload.title?.trim() || !payload.content?.trim()) {
        toast({ title: "Eksik Bilgi", description: "Başlık ve içerik boş bırakılamaz.", variant: "destructive" });
        return Promise.reject(new Error("Title and content are required."));
    }
     if (payload.media && (payload.media.startsWith("data:image/") || payload.media.startsWith("data:video/"))) {
        const MAX_ANNOUNCEMENT_DATA_URI_LENGTH = Math.floor(5 * 1024 * 1024 * 1.37); 
        if (payload.media.length > MAX_ANNOUNCEMENT_DATA_URI_LENGTH) {
            toast({ title: "Medya Dosyası Çok Büyük", description: `Duyuru medyası için maksimum boyut yaklaşık ${Math.round(MAX_ANNOUNCEMENT_DATA_URI_LENGTH / (1024*1024*1.37))}MB olmalıdır.`, variant: "destructive", duration: 8000 });
            return Promise.reject(new Error("Media data URI too large for announcement."));
        }
    }

    const newAnnouncementData: Announcement = {
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      title: payload.title,
      content: payload.content,
      media: payload.media || null,
      mediaType: payload.mediaType || null,
      date: new Date().toISOString(),
      author: `${user.name} ${user.surname}`,
      authorId: `${user.name} ${user.surname}`,
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
      // UI update will happen via SSE
    } catch (error: any) {
      console.error("[Announcements] Failed to send new announcement to server:", error);
      if (!error.message?.includes("sunucuya iletilemedi") && !error.message?.includes("kota") && !error.message?.includes("büyük")) {
        toast({ title: "Duyuru Eklenemedi", description: error.message || "Ağ hatası veya beklenmedik bir sorun oluştu.", variant: "destructive" });
      }
      throw error;
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
       // UI update will happen via SSE
    } catch (error: any) {
      console.error("[Announcements] Failed to notify server about deleted announcement:", error);
      if (!error.message?.includes("sunucuya iletilemedi")) {
        toast({ title: "Duyuru Silinemedi", description: error.message || "Duyuru silme işlemi sırasında bir sorun oluştu.", variant: "destructive" });
      }
      throw error;
    }
  }, [user, toast]);
  

  const getAnnouncementById = useCallback((id: string): Announcement | undefined => {
    return announcementsRef.current.find(ann => ann.id === id);
  }, []);

  return { announcements, addAnnouncement, deleteAnnouncement, getAnnouncementById, isLoading, unreadCount };
}

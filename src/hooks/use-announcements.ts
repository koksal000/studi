
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

const MAX_ANNOUNCEMENT_DATA_URI_LENGTH_HOOK = Math.floor(5 * 1024 * 1024 * 1.37); 

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const announcementsRef = useRef(announcements); // To access current announcements in SSE callbacks

  const { user } = useUser();
  const { lastOpenedNotificationTimestamp } = useAnnouncementStatus();
  const [unreadCount, setUnreadCount] = useState(0);
  const { siteNotificationsPreference } = useSettings();

  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    announcementsRef.current = announcements; // Keep ref updated
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
          icon: '/images/logo.png', 
        });
        notification.onclick = (event) => {
          event.preventDefault();
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || '/';
          window.open(appUrl, '_blank'); 
          if(window.focus) window.focus();
          notification.close();
        };
      } catch (err: any) {
        console.error("[SSE Announcements] Notification error message:", err.message);
        console.error("[SSE Announcements] Notification error name:", err.name);
        toast({
          title: "Bildirim Hatası",
          description: `Tarayıcı bildirimi gösterilemedi: ${err.message}. Tarayıcı ayarlarınızı kontrol edin.`,
          variant: "warning",
          duration: 7000,
        });
      }
    } else {
      console.log("[useAnnouncements] Document not visible, skipping foreground notification.");
    }
  }, [siteNotificationsPreference, toast]);


  useEffect(() => {
    setIsLoading(true); // Set loading true when effect runs

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const newEventSource = new EventSource('/api/announcements/stream');
    eventSourceRef.current = newEventSource;

    newEventSource.onopen = () => { 
      // console.log('[SSE Announcements] Connection opened.'); 
      // Initial data is fetched here, then SSE updates follow
    };

    newEventSource.onmessage = (event) => {
      try {
        const updatedAnnouncementsFromServer: Announcement[] = JSON.parse(event.data);
        updatedAnnouncementsFromServer.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const currentLatestId = announcementsRef.current.length > 0 ? announcementsRef.current[0].id : null;
        const serverLatestId = updatedAnnouncementsFromServer.length > 0 ? updatedAnnouncementsFromServer[0].id : null;

        setAnnouncements(updatedAnnouncementsFromServer); // Update state with data from server

        // Check for new announcement to show notification
        if (updatedAnnouncementsFromServer.length > 0) {
            const latestServerAnnouncement = updatedAnnouncementsFromServer[0];
            const isNew = !announcementsRef.current.some(ann => ann.id === latestServerAnnouncement.id) || 
                          (currentLatestId !== serverLatestId && new Date(latestServerAnnouncement.date) > new Date(announcementsRef.current.find(a => a.id === latestServerAnnouncement.id)?.date || 0).getTime());

            if (isNew && (!user || latestServerAnnouncement.authorId !== user.name + user.surname)) {
                 showNotification(`Yeni Duyuru: ${latestServerAnnouncement.title}`, latestServerAnnouncement.content.substring(0, 100) + "...");
            }
        }
        
        if(isLoading) setIsLoading(false); // Set loading to false after first message (initial data)

      } catch (error) {
        console.error("[SSE Announcements] Error processing SSE message:", error);
        if(isLoading) setIsLoading(false);
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
      } else if (readyState === EventSource.CONNECTING && eventType === 'error') {
         console.warn(`[SSE Announcements] Initial connection attempt failed or stream unavailable. EventSource readyState: ${readyState}, Event Type: ${eventType}. Browser will retry. Full Event:`, errorEvent);
      } else {
        console.error(
          `[SSE Announcements] Connection error. EventSource readyState: ${readyState}, Event Type: ${eventType}, Full Event:`, errorEvent
        );
      }
       if(isLoading) setIsLoading(false); // Also set loading false on error to prevent infinite loading state
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [showNotification, user, isLoading]); // isLoading added to dependencies

  const addAnnouncement = useCallback(async (payload: NewAnnouncementPayload) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Duyuru eklemek için giriş yapmalısınız.", variant: "destructive" });
      return Promise.reject(new Error("User not logged in"));
    }
    if (!payload.title?.trim() || !payload.content?.trim()) {
        toast({ title: "Eksik Bilgi", description: "Başlık ve içerik boş bırakılamaz.", variant: "destructive" });
        return Promise.reject(new Error("Title and content are required."));
    }
    if (payload.media && (payload.media.startsWith("data:image/") || payload.media.startsWith("data:video/")) && payload.media.length > MAX_ANNOUNCEMENT_DATA_URI_LENGTH_HOOK) {
        toast({ title: "Medya Dosyası Çok Büyük", description: `Medya içeriği çok büyük. Lütfen daha küçük bir dosya kullanın (yaklaşık ${Math.round(MAX_ANNOUNCEMENT_DATA_URI_LENGTH_HOOK / (1024*1024*1.37))}MB).`, variant: "destructive", duration: 7000 });
        return Promise.reject(new Error("Media data URI too large."));
    }

    const newAnnouncement: Announcement = {
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      title: payload.title,
      content: payload.content,
      media: payload.media || null,
      mediaType: payload.mediaType || null,
      date: new Date().toISOString(),
      author: `${user.name} ${user.surname}`,
      authorId: user.name + user.surname, 
    };

    // No optimistic UI update or localStorage.setItem here.
    // The update will come via SSE after server processes.

    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAnnouncement),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        let errorMessage = errorData.message || 'Duyuru sunucuya iletilemedi';
        if (response.status === 413) {
            errorMessage = "Duyuru yüklenemedi çünkü medya içeriği sunucu limitlerini aşıyor.";
        }
        toast({ title: "Duyuru Gönderilemedi", description: errorMessage, variant: "destructive" });
        throw new Error(errorMessage);
      }
      // Success means server will save to JSON and emit SSE. UI will update via SSE.
    } catch (error: any) {
      console.error("[Announcements] Failed to send new announcement to server:", error);
      toast({ title: "Duyuru Eklenemedi", description: error.message || "Ağ hatası veya beklenmedik bir sorun oluştu.", variant: "destructive" });
      throw error;
    }
  }, [user, toast]);

  const deleteAnnouncement = useCallback(async (id: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Duyuru silmek için giriş yapmalısınız.", variant: "destructive" });
      return Promise.reject(new Error("User not logged in"));
    }
    
    // No optimistic UI update or localStorage.setItem here.
    // The update will come via SSE after server processes.

    try {
      const response = await fetch(`/api/announcements?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        throw new Error(errorData.message || 'Duyuru silme bilgisi sunucuya iletilemedi');
      }
      // Success means server will save to JSON and emit SSE. UI will update via SSE.
    } catch (error: any) {
      console.error("[Announcements] Failed to notify server about deleted announcement:", error);
      toast({ title: "Duyuru Silinemedi", description: error.message || "Duyuru silme bilgisi diğer kullanıcılara iletilirken bir sorun oluştu.", variant: "destructive" });
      throw error;
    }
  }, [user, toast]);

  const getAnnouncementById = useCallback((id: string): Announcement | undefined => {
    return announcements.find(ann => ann.id === id);
  }, [announcements]);

  return { announcements, addAnnouncement, deleteAnnouncement, getAnnouncementById, isLoading, unreadCount };
}

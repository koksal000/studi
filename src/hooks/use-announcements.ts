
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { useAnnouncementStatus } from '@/contexts/announcement-status-context';
import type { SettingsContextType } from '@/contexts/settings-context'; // Keep if useSettings still exports this
import { useSettings } from '@/contexts/settings-context';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  media?: string | null;      // Can be base64 data URI or external URL
  mediaType?: string | null;  // e.g., 'image/png', 'video/mp4', 'image/url', 'video/url', 'url'
  date: string;
  author: string;
  authorId?: string; // Added to identify originator in P2P/SSE
}

// Payload for creating a new announcement (media related fields are optional)
export type NewAnnouncementPayload = {
  title: string;
  content: string;
  media?: string | null;
  mediaType?: string | null;
};


const ANNOUNCEMENTS_LOCAL_STORAGE_KEY = 'camlicaKoyuAnnouncements_localStorage';
const MAX_ANNOUNCEMENT_DATA_URI_LENGTH_HOOK = Math.floor(5 * 1024 * 1024 * 1.37); // Approx 7MB for base64 from 5MB raw

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
      // If no timestamp, all are unread until popover is opened
      setUnreadCount(announcements.length > 0 ? announcements.length : 0);
    }
  }, [announcements, lastOpenedNotificationTimestamp]);

  const showNotification = useCallback((title: string, body: string) => {
    if (!siteNotificationsPreference) {
      // console.log("[useAnnouncements] Notification skipped: User preference is off.");
      return;
    }
    if (Notification.permission !== 'granted') {
      // console.log("[useAnnouncements] Notification skipped: Browser permission not granted. Current status:", Notification.permission);
      return;
    }

    if (document.visibilityState === 'visible') {
      try {
        const notification = new Notification(title, {
          body: body,
          icon: '/images/logo.png', // Ensure this path is correct in your public folder
        });
        notification.onclick = (event) => {
          event.preventDefault();
          window.open(process.env.NEXT_PUBLIC_APP_URL || '/', '_blank'); // Use environment variable for URL
          if(window.focus) window.focus();
          notification.close();
        };
      } catch (err: any) {
        // console.error("[SSE Announcements] Notification error message:", err.message);
        // console.error("[SSE Announcements] Notification error name:", err.name);
        // Toast message is now handled directly where this function is called if needed
      }
    } else {
      // console.log("[useAnnouncements] Document not visible, skipping foreground notification.");
      // For true background notifications, a Service Worker would be needed.
    }
  }, [siteNotificationsPreference]);


  const loadAnnouncementsFromLocalStorage = useCallback(() => {
    setIsLoading(true);
    try {
      const storedAnnouncements = localStorage.getItem(ANNOUNCEMENTS_LOCAL_STORAGE_KEY);
      if (storedAnnouncements) {
        const parsed = JSON.parse(storedAnnouncements) as Announcement[];
        parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAnnouncements(parsed);
      } else {
        setAnnouncements([]);
      }
    } catch (error) {
      console.error("[Announcements] Failed to load announcements from localStorage:", error);
      setAnnouncements([]); // Fallback to empty array on error
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

    newEventSource.onopen = () => { /* console.log('[SSE Announcements] Connection opened.'); */ };

    newEventSource.onmessage = (event) => {
      try {
        const updatedAnnouncementsFromServer: Announcement[] = JSON.parse(event.data);
        updatedAnnouncementsFromServer.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const currentLocalAnnouncements = announcementsRef.current;
        
        if (updatedAnnouncementsFromServer.length > 0) {
          const latestServerAnnouncement = updatedAnnouncementsFromServer[0];
          const isNewer = !currentLocalAnnouncements.some(localAnn => localAnn.id === latestServerAnnouncement.id) || 
                          new Date(latestServerAnnouncement.date) > new Date(currentLocalAnnouncements.find(la => la.id === latestServerAnnouncement.id)?.date || 0).getTime();

          if (isNewer && (!user || latestServerAnnouncement.authorId !== user.name + user.surname)) { // Avoid self-notification
            showNotification(`Yeni Duyuru: ${latestServerAnnouncement.title}`, latestServerAnnouncement.content.substring(0, 100) + "...");
          }
        }
        
        setAnnouncements(updatedAnnouncementsFromServer);
        try {
            localStorage.setItem(ANNOUNCEMENTS_LOCAL_STORAGE_KEY, JSON.stringify(updatedAnnouncementsFromServer));
        } catch (e: any) {
            if (e.name === 'QuotaExceededError') {
                 toast({
                    title: "Yerel Depolama Uyarısı",
                    description: "Duyurular güncellendi, ancak tarayıcı depolama limiti aşıldığı için bazı veriler yerel olarak tam kaydedilememiş olabilir.",
                    variant: "warning",
                    duration: 8000,
                });
            } else {
                console.error("Error saving announcement updates from SSE to localStorage:", e);
            }
        }

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
      } else if (readyState === EventSource.CONNECTING && eventType === 'error') {
        // console.warn(`[SSE Announcements] Initial connection attempt failed or stream unavailable. EventSource readyState: ${readyState}. Browser will retry.`);
      } else {
        console.error(
          `[SSE Announcements] Connection error. EventSource readyState: ${readyState}, Event Type: ${eventType}, Full Event:`, errorEvent
        );
      }
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [showNotification, user, toast]); // Added user and toast to dependencies

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
      authorId: user.name + user.surname, // For identifying originator in SSE
    };

    const previousAnnouncements = [...announcementsRef.current];
    setAnnouncements(prev => [newAnnouncement, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

    try {
      localStorage.setItem(ANNOUNCEMENTS_LOCAL_STORAGE_KEY, JSON.stringify([newAnnouncement, ...previousAnnouncements].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        setAnnouncements(previousAnnouncements); // Revert optimistic UI update
        toast({
          title: "Yerel Depolama Limiti Aşıldı",
          description: "Duyuru eklenemedi çünkü tarayıcı depolama alanı dolu. API'ye gönderilmeyecek.",
          variant: "destructive",
          duration: 8000,
        });
        return Promise.reject(new Error("localStorage quota exceeded. Announcement not sent to API."));
      } else {
        console.error("Error saving optimistic announcement to localStorage:", e);
        // Potentially revert UI if it's a different critical localStorage error
      }
    }

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
        
        setAnnouncements(previousAnnouncements);
        try {
            localStorage.setItem(ANNOUNCEMENTS_LOCAL_STORAGE_KEY, JSON.stringify(previousAnnouncements));
        } catch (lsError) { /* ignore localStorage error on revert */ }
        toast({ title: "Duyuru Gönderilemedi", description: errorMessage, variant: "destructive" });
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error("[Announcements] Failed to send new announcement to server (or during revert):", error);
      setAnnouncements(previousAnnouncements);
      try {
        localStorage.setItem(ANNOUNCEMENTS_LOCAL_STORAGE_KEY, JSON.stringify(previousAnnouncements));
      } catch (lsRevertError: any) {
        // Avoid double toast if quota was the original issue during save attempt
        if (!error.message?.includes("localStorage quota exceeded")) {
            console.warn("Error reverting localStorage on API error:", lsRevertError);
        }
      }
      // Avoid double toasting if the error originated from localStorage quota check
      if (!error.message?.includes("localStorage quota exceeded")) {
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
    
    const previousAnnouncementsForRevert = [...announcementsRef.current];
    setAnnouncements(prev => prev.filter(ann => ann.id !== id));
    
    try {
        const updatedForStorage = previousAnnouncementsForRevert.filter(ann => ann.id !== id);
        localStorage.setItem(ANNOUNCEMENTS_LOCAL_STORAGE_KEY, JSON.stringify(updatedForStorage));
    } catch (e: any) {
        console.warn("Error updating localStorage after delete (optimistic):", e);
         if (e.name === 'QuotaExceededError') {
            toast({
                title: "Yerel Depolama Uyarısı",
                description: "Duyuru silindi ancak tarayıcı depolama alanı dolu olduğu için değişiklik tam kaydedilemedi.",
                variant: "warning",
                duration: 7000,
            });
        }
    }

    try {
      const response = await fetch(`/api/announcements?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        setAnnouncements(previousAnnouncementsForRevert); // Revert UI
        try {
            localStorage.setItem(ANNOUNCEMENTS_LOCAL_STORAGE_KEY, JSON.stringify(previousAnnouncementsForRevert));
        } catch (lsError) { /* ignore localStorage error on revert */ }
        throw new Error(errorData.message || 'Duyuru silme bilgisi sunucuya iletilemedi');
      }
    } catch (error: any) {
      console.error("[Announcements] Failed to notify server about deleted announcement:", error);
      toast({ title: "Duyuru Silinemedi", description: error.message || "Duyuru silme bilgisi diğer kullanıcılara iletilirken bir sorun oluştu.", variant: "destructive" });
      setAnnouncements(previousAnnouncementsForRevert); // Ensure UI is reverted
      try {
          localStorage.setItem(ANNOUNCEMENTS_LOCAL_STORAGE_KEY, JSON.stringify(previousAnnouncementsForRevert));
      } catch (lsRevertError) { /* ... */ }
      throw error;
    }
  }, [user, toast]);

  const getAnnouncementById = useCallback((id: string): Announcement | undefined => {
    return announcements.find(ann => ann.id === id);
  }, [announcements]);

  return { announcements, addAnnouncement, deleteAnnouncement, getAnnouncementById, isLoading, unreadCount };
}

    
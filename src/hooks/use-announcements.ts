
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { useAnnouncementStatus } from '@/contexts/announcement-status-context'; 
import type { SettingsContextType } from '@/contexts/settings-context'; // Assuming this type is exported if needed
import { useSettings } from '@/contexts/settings-context'; // Import useSettings

export interface Announcement {
  id: string;
  title: string;
  content: string;
  media?: string | null;
  mediaType?: string | null;
  date: string;
  author: string;
  authorId?: string; // Added for P2P logic, may not be used by API
}

export type NewAnnouncementPayload = Omit<Announcement, 'id' | 'date'>;

const ANNOUNCEMENTS_KEY = 'camlicaKoyuAnnouncements_api_cache';

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const announcementsRef = useRef(announcements); 

  const { user } = useUser();
  const { lastOpenedNotificationTimestamp } = useAnnouncementStatus(); 
  const [unreadCount, setUnreadCount] = useState(0); 
  const { siteNotificationsPreference } = useSettings(); // Get preference from settings

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
      // If no timestamp, all announcements are unread initially, or 0 if no announcements
      setUnreadCount(announcements.length > 0 ? announcements.length : 0);
    }
  }, [announcements, lastOpenedNotificationTimestamp]);

  const showNotification = useCallback((title: string, body: string) => {
    console.log("[SSE Announcements] Attempting to show notification. Preference:", siteNotificationsPreference, "Browser Permission:", Notification.permission);
    if (siteNotificationsPreference && Notification.permission === 'granted') {
      if (document.visibilityState === 'visible') {
        try {
          const notification = new Notification(title, {
            body: body,
            icon: '/images/logo.png', // Make sure you have a logo at public/images/logo.png
          });
          notification.onclick = (event) => {
            event.preventDefault(); 
            window.open('https://studi-ldexx24gi-koksals-projects-00474b3b.vercel.app/', '_blank');
            notification.close();
          };
        } catch (err: any) {
          console.error("[SSE Announcements] Notification error message:", err.message);
          console.error("[SSE Announcements] Notification error name:", err.name);
          toast({
            title: "Bildirim Gösterilemedi",
            description: `Tarayıcınız bildirimi engelledi: ${err.message}. Lütfen tarayıcı ayarlarınızı kontrol edin.`,
            variant: "destructive",
            duration: 7000,
          });
        }
      } else {
        console.log("[SSE Announcements] Document not visible, skipping notification.");
      }
    } else {
        if (!siteNotificationsPreference) console.log("[SSE Announcements] Notification skipped: User preference is off.");
        if (Notification.permission !== 'granted') console.log("[SSE Announcements] Notification skipped: Browser permission not granted. Current status:", Notification.permission);
    }
  }, [siteNotificationsPreference, toast]);


  const fetchInitialAnnouncements = useCallback(async () => {
    // console.log('[Announcements] Fetching initial announcements...');
    setIsLoading(true);
    try {
      const response = await fetch('/api/announcements', { cache: 'no-store' });
      if (!response.ok) {
        // console.error('[Announcements] Failed to fetch initial announcements, status:', response.status);
        throw new Error('Failed to fetch announcements');
      }
      const data: Announcement[] = await response.json();
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAnnouncements(data);
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(data));
      // console.log('[Announcements] Initial announcements fetched and set:', data.length);
    } catch (error) {
      console.error("[Announcements] Failed to fetch initial announcements:", error);
      const storedAnnouncements = localStorage.getItem(ANNOUNCEMENTS_KEY);
      if (storedAnnouncements) {
        try {
          const parsed = JSON.parse(storedAnnouncements);
          setAnnouncements(parsed);
        } catch (e) {
          console.error("[Announcements] Failed to parse announcements from localStorage", e);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialAnnouncements();
  }, [fetchInitialAnnouncements]);

  useEffect(() => {
    // console.log('[SSE Announcements] useEffect for EventSource triggered.'); 
    
    if (eventSourceRef.current) {
      // console.log('[SSE Announcements] Closing existing EventSource.');
      eventSourceRef.current.close();
    }

    // console.log('[SSE Announcements] Creating new EventSource for /api/announcements/stream');
    const newEventSource = new EventSource('/api/announcements/stream');
    eventSourceRef.current = newEventSource;

    newEventSource.onopen = () => {
      // console.log('[SSE Announcements] Connection opened.');
    };
    
    newEventSource.onmessage = (event) => {
      try {
        const updatedAnnouncementsFromServer: Announcement[] = JSON.parse(event.data);
        // console.log('[SSE Announcements] Received data via SSE:', updatedAnnouncementsFromServer.length, 'items');
        
        const currentLocalAnnouncements = announcementsRef.current;
        setAnnouncements(prevAnnouncements => {
          // Notify for genuinely new announcements
          updatedAnnouncementsFromServer.forEach(newAnn => {
            const isTrulyNew = !currentLocalAnnouncements.some(localAnn => localAnn.id === newAnn.id);
            if (isTrulyNew) {
                // console.log(`[SSE Announcements] New announcement detected: ${newAnn.title}`);
                showNotification(`Yeni Duyuru: ${newAnn.title}`, newAnn.content.substring(0, 100) + "...");
            }
          });
          localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncementsFromServer));
          return updatedAnnouncementsFromServer;
        });
        // console.log('[SSE Announcements] Local announcements and localStorage updated.');

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
        // console.log('[SSE Announcements] Cleaning up EventSource on unmount or re-run.');
        es.close();
        eventSourceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNotification]); // showNotification is stable due to useCallback

  const addAnnouncement = useCallback(async (newAnnouncementData: Omit<Announcement, 'id' | 'date' | 'author' | 'authorId'>) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Duyuru eklemek için giriş yapmalısınız.", variant: "destructive" });
      return;
    }

    const payload: NewAnnouncementPayload = {
      ...newAnnouncementData,
      author: `${user.name} ${user.surname}`,
    };

    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        throw new Error(errorData.message || 'Duyuru eklenemedi');
      }
      // SSE will handle the update, no need to manually setAnnouncements here
    } catch (error: any) {
      console.error("[Announcements] Failed to add announcement:", error);
      toast({ title: "Duyuru Eklenemedi", description: error.message || "Duyuru eklenirken bir sorun oluştu.", variant: "destructive" });
    }
  }, [user, toast]);

  const deleteAnnouncement = useCallback(async (id: string) => {
     if (!user) {
      toast({ title: "Giriş Gerekli", description: "Duyuru silmek için giriş yapmalısınız.", variant: "destructive" });
      return;
    }

    try {
      const response = await fetch(`/api/announcements?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        throw new Error(errorData.message || 'Duyuru silinemedi');
      }
      // SSE will handle the update
    } catch (error: any) {
      console.error("[Announcements] Failed to delete announcement:", error);
      toast({ title: "Duyuru Silinemedi", description: error.message || "Duyuru silinirken bir sorun oluştu.", variant: "destructive" });
    }
  }, [user, toast]);

  const getAnnouncementById = useCallback((id: string): Announcement | undefined => {
    return announcements.find(ann => ann.id === id);
  }, [announcements]);

  return { announcements, addAnnouncement, deleteAnnouncement, getAnnouncementById, isLoading, unreadCount };
}

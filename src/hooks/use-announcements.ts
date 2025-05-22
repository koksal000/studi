
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/user-context';
// import { useToast } from '@/hooks/use-toast'; // Toasts for SSE errors removed previously
import { useAnnouncementStatus } from '@/contexts/announcement-status-context';
import { useSettings } from '@/contexts/settings-context';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string; // ISO string
  author: string;
  authorId?: string; // PeerJS ID of the author or user's name
  media?: string | null; // Base64 data URI or external URL
  mediaType?: string | null; // e.g., 'image/png', 'video/mp4', 'image/url', 'video/url', 'url/link'
}

export interface NewAnnouncementPayload {
  title: string;
  content: string;
  media?: string | null;
  mediaType?: string | null;
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const { user } = useUser();
  const { lastOpenedNotificationTimestamp, setLastOpenedNotificationTimestamp } = useAnnouncementStatus();
  const [unreadCount, setUnreadCount] = useState(0);
  const { siteNotificationsPreference } = useSettings();

  // const { toast } = useToast(); // Toasts for SSE errors removed previously
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialDataLoadedRef = useRef(false); 
  const announcementsRef = useRef<Announcement[]>(announcements); 

  useEffect(() => {
    announcementsRef.current = announcements; 
    if (lastOpenedNotificationTimestamp === null && announcements.length > 0 && initialDataLoadedRef.current) {
      setLastOpenedNotificationTimestamp(Date.now());
      setUnreadCount(0);
    } else if (lastOpenedNotificationTimestamp) {
      const newUnreadCount = announcements.filter(
        (ann) => new Date(ann.date).getTime() > lastOpenedNotificationTimestamp
      ).length;
      setUnreadCount(newUnreadCount);
    } else {
      setUnreadCount(announcements.length > 0 && initialDataLoadedRef.current ? announcements.length : 0);
    }
  }, [announcements, lastOpenedNotificationTimestamp, setLastOpenedNotificationTimestamp]);


  const showNotification = useCallback((title: string, body: string) => {
    if (!siteNotificationsPreference) {
      console.log("[SSE Announcements] Browser notification skipped: User preference is off.");
      return;
    }
    if (Notification.permission !== 'granted') {
      console.log("[SSE Announcements] Browser notification skipped: Browser permission not granted. Current status:", Notification.permission);
      return;
    }
    if (document.visibilityState !== 'visible') {
      console.log("[SSE Announcements] Document not visible, skipping foreground browser notification.");
      return;
    }

    try {
      const notification = new Notification(title, {
        body: body,
        icon: '/images/logo.png', // Ensure this path is correct in your public folder
      });
      notification.onclick = (event) => {
        event.preventDefault();
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://studi-ldexx24gi-koksals-projects-00474b3b.vercel.app/';
        window.open(appUrl, '_blank');
        if (window.focus) window.focus();
        notification.close();
      };
    } catch (err: any) {
      console.error("[SSE Announcements] Browser notification construction error:", err);
      // Toast for this specific error was removed per user request to avoid "illegal constructor" toasts.
      // If an alternative UI feedback is needed, it can be added here.
    }
  }, [siteNotificationsPreference]);

  useEffect(() => {
    initialDataLoadedRef.current = false;
    setIsLoading(true);

    // Fetch initial announcements
    fetch('/api/announcements')
      .then(res => {
        if (!res.ok) {
          console.error(`[Announcements] Failed to fetch initial announcements: ${res.status} ${res.statusText}`);
          // Do not set error state here, let SSE attempt to connect
          return []; // Return empty array on fetch error to avoid breaking JSON.parse
        }
        return res.json();
      })
      .then((data: Announcement[]) => {
        // console.log('[Announcements] Fetched initial data:', data.length, 'items');
        setAnnouncements(data); // Set initial data, SSE will provide further updates
      })
      .catch(err => {
        console.error("[Announcements] Error fetching or parsing initial announcements:", err);
        setAnnouncements([]); // Set to empty on error
      })
      .finally(() => {
        // setIsLoading(false) will be handled by the first SSE message or error
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
      if (!initialDataLoadedRef.current) {
        initialDataLoadedRef.current = true;
        setIsLoading(false);
      }
      
      try {
        const updatedAnnouncementsFromServer: Announcement[] = JSON.parse(event.data);
        // The entire list of announcements is received from the server.
        // Setting this state will cause components consuming this hook (like Navbar/AnnouncementPopover)
        // to re-render with the new list, effectively removing any deleted announcements.
        // console.log('[SSE Announcements] Received full update via SSE:', updatedAnnouncementsFromServer.length, 'items. Notification popover will be updated with this list.');
        
        const previousAnnouncements = announcementsRef.current;
        setAnnouncements(updatedAnnouncementsFromServer);

        // Show browser notification for genuinely new announcements
        if (updatedAnnouncementsFromServer.length > 0) {
            const latestServerAnnouncement = updatedAnnouncementsFromServer[0]; // Assumes newest is first
            const isTrulyNew = !previousAnnouncements.some(ann => ann.id === latestServerAnnouncement.id) ||
                               (new Date(latestServerAnnouncement.date).getTime() > new Date(previousAnnouncements.find(a => a.id === latestServerAnnouncement.id)?.date || 0).getTime());

            if (isTrulyNew && (latestServerAnnouncement.authorId !== (user ? `${user.name} ${user.surname}` : ''))) {
                 showNotification(`Yeni Duyuru: ${latestServerAnnouncement.title}`, latestServerAnnouncement.content.substring(0, 100) + "...");
            }
        }
      } catch (error) {
        console.error("[SSE Announcements] Error processing SSE message:", error);
      }
    };

    newEventSource.onerror = (errorEvent: Event) => {
      const target = errorEvent.target as EventSource;
      if (eventSourceRef.current !== target) {
        // console.log("[SSE Announcements] Error from an old EventSource instance, ignoring.");
        return; 
      }
      const readyState = target?.readyState;
      const eventType = errorEvent.type || 'unknown event type';
      
      if (readyState === EventSource.CONNECTING) { // readyState: 0
        console.warn(
          `[SSE Announcements] Initial connection failed or attempting to reconnect. EventSource readyState: ${readyState}, Event Type: ${eventType}. Full Event:`, errorEvent,
          "This might be due to NEXT_PUBLIC_APP_URL not being set correctly in your deployment environment, or the stream API endpoint having issues."
        );
      } else if (readyState === EventSource.CLOSED) { // readyState: 2
         console.warn(
          `[SSE Announcements] Connection closed. EventSource readyState: ${readyState}, Event Type: ${eventType}. Browser will attempt to reconnect. Full Event:`, errorEvent
        );
      } else { // Typically readyState: 1 (OPEN) but an error occurred
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
        // console.log('[SSE Announcements] Closing EventSource connection.');
        newEventSource.close();
      }
      eventSourceRef.current = null;
    };
  }, [showNotification, user, setLastOpenedNotificationTimestamp]); 

  const addAnnouncement = useCallback(async (payload: NewAnnouncementPayload) => {
    if (!user) {
      // toast({ title: "Giriş Gerekli", description: "Duyuru eklemek için giriş yapmalısınız.", variant: "destructive" });
      console.error("Add announcement failed: User not logged in");
      throw new Error("User not logged in");
    }
     if (!payload.title?.trim() || !payload.content?.trim()) {
        // toast({ title: "Eksik Bilgi", description: "Başlık ve içerik boş bırakılamaz.", variant: "destructive" });
        console.error("Add announcement failed: Title and content are required.");
        throw new Error("Title and content are required.");
    }
    
    const newAnnouncementData: Announcement = {
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      title: payload.title,
      content: payload.content,
      media: payload.media || null,
      mediaType: payload.mediaType || null,
      date: new Date().toISOString(),
      author: `${user.name} ${user.surname}`,
      authorId: `${user.name} ${user.surname}`, // Using combined name as authorId for simplicity
    };

    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAnnouncementData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        // toast({ title: "Duyuru Gönderilemedi", description: errorData.message || "Sunucu hatası oluştu.", variant: "destructive" });
        console.error("Failed to send new announcement to server:", errorData.message);
        throw new Error(errorData.message || 'Duyuru sunucuya iletilemedi');
      }
      // UI update will happen via SSE from the server broadcasting the change to all clients
      // console.log('[Announcements] Successfully sent new announcement to server.');
    } catch (error: any) {
      console.error("[Announcements] Error in addAnnouncement:", error);
      // toast({ title: "Duyuru Eklenemedi", description: error.message || "Ağ hatası veya beklenmedik bir sorun oluştu.", variant: "destructive" });
      throw error;
    }
  }, [user]);

  const deleteAnnouncement = useCallback(async (id: string) => {
    if (!user) {
      // toast({ title: "Giriş Gerekli", description: "Duyuru silmek için giriş yapmalısınız.", variant: "destructive" });
      console.error("Delete announcement failed: User not logged in");
      throw new Error("User not logged in");
    }

    try {
      const response = await fetch(`/api/announcements?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        // toast({ title: "Duyuru Silinemedi", description: errorData.message || "Sunucu hatası oluştu.", variant: "destructive" });
        console.error("Failed to delete announcement on server:", errorData.message);
        throw new Error(errorData.message || 'Duyuru silme bilgisi sunucuya iletilemedi');
      }
      // UI update will happen via SSE
      // console.log(`[Announcements] Successfully sent delete request for announcement ${id} to server.`);
    } catch (error: any) {
      console.error("[Announcements] Error in deleteAnnouncement:", error);
      // toast({ title: "Duyuru Silinemedi", description: error.message || "Duyuru silme işlemi sırasında bir sorun oluştu.", variant: "destructive" });
      throw error;
    }
  }, [user]);
  

  const getAnnouncementById = useCallback((id: string): Announcement | undefined => {
    return announcementsRef.current.find(ann => ann.id === id);
  }, []); // announcementsRef.current will always be up-to-date

  return { announcements, addAnnouncement, deleteAnnouncement, getAnnouncementById, isLoading, unreadCount };
}

    
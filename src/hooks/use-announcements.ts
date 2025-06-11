
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/user-context';
import { useAnnouncementStatus } from '@/contexts/announcement-status-context';
import { useSettings } from '@/contexts/settings-context'; // siteNotificationsPreference için

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string; // ISO string
  author: string;
  authorId?: string; 
  media?: string | null; 
  mediaType?: string | null; 
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
  const { lastOpenedNotificationTimestamp, setLastOpenedNotificationTimestamp: updateLastOpenedTimestamp, isStatusLoading } = useAnnouncementStatus();
  const [unreadCount, setUnreadCount] = useState(0);
  // useSettings'ten siteNotificationsPreference'ı alıyoruz
  const { currentTheme, setAppTheme, siteNotificationsPreference } = useSettings() ?? { siteNotificationsPreference: true };


  const eventSourceRef = useRef<EventSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialDataLoadedRef = useRef(false); 
  const announcementsRef = useRef<Announcement[]>(announcements); 

  useEffect(() => {
    announcementsRef.current = announcements; 
    if (isStatusLoading) return; // Wait for timestamp to load from IDB

    if (lastOpenedNotificationTimestamp === null && announcements.length > 0 && initialDataLoadedRef.current) {
      updateLastOpenedTimestamp(Date.now());
      setUnreadCount(0);
    } else if (lastOpenedNotificationTimestamp) {
      const newUnreadCount = announcements.filter(
        (ann) => new Date(ann.date).getTime() > lastOpenedNotificationTimestamp
      ).length;
      setUnreadCount(newUnreadCount);
    } else {
      setUnreadCount(announcements.length > 0 && initialDataLoadedRef.current ? announcements.length : 0);
    }
  }, [announcements, lastOpenedNotificationTimestamp, updateLastOpenedTimestamp, isStatusLoading]);


  const showNotification = useCallback((title: string, body: string) => {
    if (!siteNotificationsPreference) {
      console.log("[SSE Announcements] Browser notification skipped: User preference is off.");
      return;
    }
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission !== 'granted') {
        console.log("[SSE Announcements] Browser notification skipped: Browser permission not granted. Current status:", Notification.permission);
        return;
      }
      // Check if document is visible logic was removed - it was causing notifications not to show
      // if (document.visibilityState !== 'visible') {
      //   console.log("[SSE Announcements] Document not visible, skipping foreground browser notification.");
      //   return;
      // }

      try {
        const notification = new Notification(title, {
          body: body,
          icon: '/images/logo.png', 
        });
        notification.onclick = (event) => {
          event.preventDefault();
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : 'http://localhost:9002');
          if (typeof window !== "undefined") {
            window.open(appUrl + '/announcements', '_blank'); // Duyurular sayfasına yönlendir
            if (window.focus) window.focus();
          }
          notification.close();
        };
      } catch (err: any) {
        console.error("[SSE Announcements] Browser notification construction error:", err);
      }
    } else {
        console.log("[SSE Announcements] Browser notification skipped: Notifications API not available.");
    }
  }, [siteNotificationsPreference]);

  useEffect(() => {
    initialDataLoadedRef.current = false;
    setIsLoading(true);

    fetch('/api/announcements')
      .then(res => {
        if (!res.ok) {
          console.error(`[Announcements] Failed to fetch initial announcements: ${res.status} ${res.statusText}`);
          return []; 
        }
        return res.json();
      })
      .then((data: Announcement[]) => {
        setAnnouncements(data); 
      })
      .catch(err => {
        console.error("[Announcements] Error fetching or parsing initial announcements:", err);
        setAnnouncements([]); 
      })
      .finally(() => {
        // setIsLoading will be handled by SSE or error
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
        // console.log('[SSE Announcements] Received full update via SSE:', updatedAnnouncementsFromServer.length, 'items.');
        
        const previousAnnouncements = announcementsRef.current;
        setAnnouncements(updatedAnnouncementsFromServer);

        if (updatedAnnouncementsFromServer.length > 0) {
            const latestServerAnnouncement = updatedAnnouncementsFromServer[0]; 
            const isTrulyNew = !previousAnnouncements.some(ann => ann.id === latestServerAnnouncement.id) ||
                               (new Date(latestServerAnnouncement.date).getTime() > new Date(previousAnnouncements.find(a => a.id === latestServerAnnouncement.id)?.date || 0).getTime());
            
            // Kullanıcının kendi eklediği duyuru için bildirim gösterme
            const isAuthorSelf = user && (latestServerAnnouncement.authorId === `${user.name} ${user.surname}` || latestServerAnnouncement.author === `${user.name} ${user.surname}`);

            if (isTrulyNew && !isAuthorSelf) {
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
        return; 
      }
      const readyState = target?.readyState;
      const eventType = errorEvent.type || 'unknown event type';
      
      if (readyState === EventSource.CONNECTING) { 
        console.warn(
          `[SSE Announcements] Initial connection failed or attempting to reconnect. EventSource readyState: ${readyState}, Event Type: ${eventType}.`,
          "This might be due to NEXT_PUBLIC_APP_URL not being set correctly in your deployment environment, or the stream API endpoint having issues."
        );
      } else if (readyState === EventSource.CLOSED) { 
         console.warn(
          `[SSE Announcements] Connection closed. EventSource readyState: ${readyState}, Event Type: ${eventType}. Browser will attempt to reconnect.`
        );
      } else { 
        console.error(
          `[SSE Announcements] Connection error. EventSource readyState: ${readyState}, Event Type: ${eventType}.`
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
  }, [showNotification, user, updateLastOpenedTimestamp]); 

  const addAnnouncement = useCallback(async (payload: NewAnnouncementPayload) => {
    if (!user) {
      console.error("Add announcement failed: User not logged in");
      throw new Error("User not logged in");
    }
     if (!payload.title?.trim() || !payload.content?.trim()) {
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
        console.error("Failed to send new announcement to server:", errorData.message);
        throw new Error(errorData.message || 'Duyuru sunucuya iletilemedi');
      }
    } catch (error: any) {
      console.error("[Announcements] Error in addAnnouncement:", error);
      throw error;
    }
  }, [user]);

  const deleteAnnouncement = useCallback(async (id: string) => {
    if (!user) {
      console.error("Delete announcement failed: User not logged in");
      throw new Error("User not logged in");
    }

    try {
      const response = await fetch(`/api/announcements?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        console.error("Failed to delete announcement on server:", errorData.message);
        throw new Error(errorData.message || 'Duyuru silme bilgisi sunucuya iletilemedi');
      }
    } catch (error: any) {
      console.error("[Announcements] Error in deleteAnnouncement:", error);
      throw error;
    }
  }, [user]);
  

  const getAnnouncementById = useCallback((id: string): Announcement | undefined => {
    return announcementsRef.current.find(ann => ann.id === id);
  }, []); 

  return { announcements, addAnnouncement, deleteAnnouncement, getAnnouncementById, isLoading, unreadCount };
}

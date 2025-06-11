
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/user-context';
import { useAnnouncementStatus } from '@/contexts/announcement-status-context';
import { useSettings } from '@/contexts/settings-context';
import { useToast } from './use-toast';

export interface Like {
  userId: string; // user.name + " " + user.surname for now
}

export interface Comment {
  id: string;
  authorName: string; // user.name + " " + user.surname
  authorId: string; // user.name + " " + user.surname
  text: string;
  date: string; // ISO string
  // likes?: Like[]; // For future comment liking
  // replies?: Reply[]; // For future replies
}

// export interface Reply extends Comment {
//   replyingToCommentId: string;
//   replyingToAuthorName?: string;
// }

export interface Announcement {
  id:string;
  title: string;
  content: string;
  date: string; // ISO string
  author: string; // "Yönetim Hesabı" or user name
  authorId: string; // "ADMIN_ACCOUNT" or user name for association
  media?: string | null;
  mediaType?: string | null;
  likes?: Like[];
  comments?: Comment[];
}

export interface NewAnnouncementPayload {
  title: string;
  content: string;
  media?: string | null;
  mediaType?: string | null;
}

// API action payloads
interface ToggleLikePayload {
  action: "TOGGLE_ANNOUNCEMENT_LIKE";
  announcementId: string;
  userId: string;
  userName: string; // for author field if needed, though not directly used for like entity
}

interface AddCommentPayload {
  action: "ADD_COMMENT_TO_ANNOUNCEMENT";
  announcementId: string;
  comment: Omit<Comment, 'id' | 'date'>; // API will generate id and date
}

type AnnouncementApiPayload = ToggleLikePayload | AddCommentPayload | Announcement; // Announcement for POST new

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const { user, isAdmin } = useUser();
  const { toast } = useToast();
  const { lastOpenedNotificationTimestamp, setLastOpenedNotificationTimestamp: updateLastOpenedTimestamp, isStatusLoading } = useAnnouncementStatus();
  const [unreadCount, setUnreadCount] = useState(0);
  const { siteNotificationsPreference } = useSettings() ?? { siteNotificationsPreference: true };

  const eventSourceRef = useRef<EventSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialDataLoadedRef = useRef(false);
  const announcementsRef = useRef<Announcement[]>(announcements);

  useEffect(() => {
    announcementsRef.current = announcements;
    if (isStatusLoading) return;

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
        console.log("[SSE Announcements] Browser notification skipped: Browser permission not granted.");
        return;
      }
      try {
        const notification = new Notification(title, {
          body: body,
          icon: '/images/logo.png',
        });
        notification.onclick = (event) => {
          event.preventDefault();
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : 'http://localhost:9002');
          if (typeof window !== "undefined") {
            window.open(appUrl + '/announcements', '_blank');
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
        setAnnouncements(Array.isArray(data) ? data : []);
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
        const previousAnnouncements = announcementsRef.current;
        setAnnouncements(updatedAnnouncementsFromServer);

        if (updatedAnnouncementsFromServer.length > 0 && previousAnnouncements.length > 0) {
            const latestServerAnnouncement = updatedAnnouncementsFromServer[0];
            const correspondingPrevAnnouncement = previousAnnouncements.find(ann => ann.id === latestServerAnnouncement.id);
            
            const isNewAnnouncement = !correspondingPrevAnnouncement;
            const isAuthorSelf = user && (latestServerAnnouncement.authorId === (isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`));

            if (isNewAnnouncement && !isAuthorSelf) {
                 showNotification(`Yeni Duyuru: ${latestServerAnnouncement.title}`, latestServerAnnouncement.content.substring(0, 100) + "...");
            }
        } else if (updatedAnnouncementsFromServer.length > previousAnnouncements.length && updatedAnnouncementsFromServer.length > 0) {
            // This handles the very first announcement or if prevAnnouncements was empty
            const latestServerAnnouncement = updatedAnnouncementsFromServer[0];
            const isAuthorSelf = user && (latestServerAnnouncement.authorId === (isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`));
            if (!isAuthorSelf) {
                showNotification(`Yeni Duyuru: ${latestServerAnnouncement.title}`, latestServerAnnouncement.content.substring(0, 100) + "...");
            }
        }
      } catch (error) {
        console.error("[SSE Announcements] Error processing SSE message:", error);
      }
    };

    newEventSource.onerror = (errorEvent: Event) => {
      // console.error('[SSE Announcements] Connection error:', errorEvent);
      // Existing error handling logic...
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
      if (newEventSource) newEventSource.close();
      eventSourceRef.current = null;
    };
  }, [showNotification, user, isAdmin, updateLastOpenedTimestamp]);

  const sendApiRequest = async (payload: AnnouncementApiPayload) => {
    if (!user) throw new Error("User not logged in");
    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        toast({ title: "İşlem Başarısız", description: errorData.message || 'Sunucu hatası.', variant: "destructive" });
        throw new Error(errorData.message || 'Sunucu hatası.');
      }
      // UI will update via SSE
    } catch (error) {
      console.error("[Announcements] API request error:", error);
      if (!(error instanceof Error && error.message.includes('Sunucu hatası'))) {
        toast({ title: "Ağ Hatası", description: "İstek gönderilemedi.", variant: "destructive" });
      }
      throw error;
    }
  };

  const addAnnouncement = useCallback(async (payload: NewAnnouncementPayload) => {
    if (!user) throw new Error("User not logged in");
    if (!payload.title?.trim() || !payload.content?.trim()) throw new Error("Title and content are required.");

    const newAnnouncementData: Announcement = {
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      title: payload.title,
      content: payload.content,
      media: payload.media || null,
      mediaType: payload.mediaType || null,
      date: new Date().toISOString(),
      author: isAdmin ? "Yönetim Hesabı" : `${user.name} ${user.surname}`,
      authorId: isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`,
      likes: [],
      comments: [],
    };
    await sendApiRequest(newAnnouncementData); // This is a full Announcement object, API will treat it as add new.
  }, [user, isAdmin, sendApiRequest]);

  const deleteAnnouncement = useCallback(async (id: string) => {
    if (!user) throw new Error("User not logged in");
    // No optimistic UI update here, SSE will handle
    try {
      const response = await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        toast({ title: "Silme Başarısız", description: errorData.message, variant: "destructive" });
        throw new Error(errorData.message);
      }
    } catch (error) {
      console.error("[Announcements] Delete error:", error);
      throw error;
    }
  }, [user, toast]);

  const toggleAnnouncementLike = useCallback(async (announcementId: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Beğeni yapmak için giriş yapmalısınız.", variant: "destructive"});
      return;
    }
    const userId = `${user.name} ${user.surname}`;
    await sendApiRequest({ action: "TOGGLE_ANNOUNCEMENT_LIKE", announcementId, userId, userName: userId });
  }, [user, sendApiRequest, toast]);

  const addCommentToAnnouncement = useCallback(async (announcementId: string, text: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Yorum yapmak için giriş yapmalısınız.", variant: "destructive"});
      return;
    }
    if (!text.trim()) {
      toast({ title: "Yorum Boş Olamaz", description: "Lütfen bir yorum yazın.", variant: "destructive"});
      return;
    }
    const authorName = `${user.name} ${user.surname}`;
    const authorId = authorName; // Using name as ID for now

    const commentPayload: Omit<Comment, 'id' | 'date'> = {
      authorName,
      authorId,
      text,
    };
    await sendApiRequest({ action: "ADD_COMMENT_TO_ANNOUNCEMENT", announcementId, comment: commentPayload });
  }, [user, sendApiRequest, toast]);

  const getAnnouncementById = useCallback((id: string): Announcement | undefined => {
    return announcementsRef.current.find(ann => ann.id === id);
  }, []);

  return { announcements, addAnnouncement, deleteAnnouncement, getAnnouncementById, isLoading, unreadCount, toggleAnnouncementLike, addCommentToAnnouncement };
}


"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/user-context';
import { useAnnouncementStatus } from '@/contexts/announcement-status-context';
import { useSettings } from '@/contexts/settings-context';
import { useToast } from './use-toast';

export interface Like {
  userId: string;
}

export interface Reply {
  id: string;
  authorName: string;
  authorId: string;
  text: string;
  date: string;
  replyingToAuthorName?: string;
  replyingToAuthorId?: string;
  // likes?: Like[]; // Yanıt beğenme kaldırıldı
}

export interface Comment {
  id: string;
  authorName: string;
  authorId: string;
  text: string;
  date: string;
  replies?: Reply[];
  // likes?: Like[]; // Yorum beğenme kaldırıldı
}

export interface Announcement {
  id:string;
  title: string;
  content: string;
  date: string;
  author: string;
  authorId: string;
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
interface ToggleAnnouncementLikePayload {
  action: "TOGGLE_ANNOUNCEMENT_LIKE";
  announcementId: string;
  userId: string;
  userName: string;
}

interface AddCommentPayload {
  action: "ADD_COMMENT_TO_ANNOUNCEMENT";
  announcementId: string;
  comment: Omit<Comment, 'id' | 'date' | 'replies'>;
}

interface AddReplyPayload {
  action: "ADD_REPLY_TO_COMMENT";
  announcementId: string;
  commentId: string;
  reply: Omit<Reply, 'id' | 'date'>;
}

type AnnouncementApiPayload =
  | ToggleAnnouncementLikePayload
  | AddCommentPayload
  | AddReplyPayload
  | Announcement;

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

  const showNotification = useCallback((title: string, body: string, tag?: string) => {
    if (!siteNotificationsPreference) {
      // console.log("[Notifications] Browser notification skipped: User preference is off.");
      return;
    }
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === 'granted') {
        try {
          const notification = new Notification(title, {
            body: body,
            icon: '/images/logo.png', // Ensure this path is correct in your `public` folder
            tag: tag || title, // Tag can prevent duplicate notifications if desired
            renotify: !!tag, // If tag is used, renotify can make it pop up again
          });
          notification.onclick = (event) => {
            event.preventDefault();
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
            window.open(appUrl + '/announcements', '_blank');
            if (window.focus) window.focus();
            notification.close();
          };
        } catch (err: any) {
          console.error("[Notifications] Browser notification construction error:", err);
          toast({ title: title, description: body, duration: 8000 });
        }
      } else if (Notification.permission !== 'denied') {
        // Permission is default, not granted, not denied.
        // Optionally, you could prompt for permission here, but it's often better to do it at a more opportune moment.
        // For now, fallback to toast.
        // console.log("[Notifications] Browser notification permission not granted (default). Falling back to toast.");
        toast({ title: title, description: body, duration: 8000 });
      } else {
        // Permission denied, do nothing or fallback to a very subtle in-app indicator if desired.
        // console.log("[Notifications] Browser notification permission denied.");
      }
    } else {
      // console.log("[Notifications] Browser notification skipped: Notifications API not available. Falling back to toast.");
      toast({ title: title, description: body, duration: 8000 });
    }
  }, [siteNotificationsPreference, toast]);

  useEffect(() => {
    initialDataLoadedRef.current = false;
    setIsLoading(true);

    // console.log("[Announcements] Initializing hook, fetching initial data...");
    fetch('/api/announcements')
      .then(res => {
        if (!res.ok) {
          console.error(`[Announcements] Failed to fetch initial announcements: ${res.status} ${res.statusText}`);
          return [];
        }
        return res.json();
      })
      .then((data: Announcement[]) => {
        // console.log("[Announcements] Initial data fetched:", data.length, "items");
        setAnnouncements(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        console.error("[Announcements] Error fetching or parsing initial announcements:", err);
        setAnnouncements([]);
      })
      .finally(() => {
        // setIsLoading will be handled by SSE connection or error
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
      const previousAnnouncementsState = [...announcementsRef.current]; // Capture previous state

      let updatedAnnouncementsFromServer: Announcement[];
      try {
        updatedAnnouncementsFromServer = JSON.parse(event.data);
      } catch (error) {
        console.error("[SSE Announcements] Error parsing SSE message data:", error);
        return;
      }

      setAnnouncements(updatedAnnouncementsFromServer);

      if (!initialDataLoadedRef.current) {
        initialDataLoadedRef.current = true;
        setIsLoading(false);
        // console.log("[SSE Announcements] Initial data processed via SSE.");
        return; // Don't process notifications for initial data load
      }

      // console.log("[SSE Announcements] Received update. Prev count:", previousAnnouncementsState.length, "New count:", updatedAnnouncementsFromServer.length);

      if (user && initialDataLoadedRef.current) {
        const currentUserIdentifier = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;

        // Check for new announcements
        updatedAnnouncementsFromServer.forEach(newAnn => {
          const isNewOverallAnnouncement = !previousAnnouncementsState.find(pa => pa.id === newAnn.id);
          const isAuthorSelfAnnouncement = newAnn.authorId === currentUserIdentifier;

          if (isNewOverallAnnouncement && !isAuthorSelfAnnouncement) {
            // console.log(`[Notification] New Announcement: "${newAnn.title}" by ${newAnn.author}`);
            showNotification(`Yeni Duyuru: ${newAnn.title}`, newAnn.content.substring(0, 100) + "...", `ann-${newAnn.id}`);
          }

          // Check for new replies
          const oldAnnEquivalent = previousAnnouncementsState.find(pa => pa.id === newAnn.id);
          newAnn.comments?.forEach(newComment => {
            const oldCommentEquivalent = oldAnnEquivalent?.comments?.find(pc => pc.id === newComment.id);
            newComment.replies?.forEach(newReply => {
              const isNewReply = !oldCommentEquivalent?.replies?.find(pr => pr.id === newReply.id);
              const isAuthorSelfReply = newReply.authorId === currentUserIdentifier;

              if (isNewReply && newReply.replyingToAuthorId === currentUserIdentifier && !isAuthorSelfReply) {
                // console.log(`[Notification] New Reply for ${currentUserIdentifier} from ${newReply.authorName} in Ann: "${newAnn.title}"`);
                const notificationTitle = `${newReply.authorName} size yanıt verdi`;
                const notificationBody = `@${newReply.replyingToAuthorName}: "${newReply.text.substring(0, 50)}..."`;
                showNotification(notificationTitle, notificationBody, `reply-${newReply.id}`);
              }
            });
          });
        });
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
          "This might be due to NEXT_PUBLIC_APP_URL not being set correctly, or the stream API endpoint having issues."
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
      // console.log("[Announcements] Hook unmounting, SSE connection closed.");
    };
  }, [showNotification, user, isAdmin, siteNotificationsPreference]); // siteNotificationsPreference eklendi, showNotification'ı etkileyebilir.

  const sendApiRequest = async (payload: AnnouncementApiPayload) => {
    if (!user && 'action' in payload && (payload.action === "ADD_COMMENT_TO_ANNOUNCEMENT" || payload.action === "ADD_REPLY_TO_COMMENT")) {
      toast({ title: "Giriş Gerekli", description: "Bu işlemi yapmak için giriş yapmalısınız.", variant: "destructive" });
      throw new Error("User not logged in for this action");
    }
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
    } catch (error) {
      console.error("[Announcements] API request error:", error);
      if (!(error instanceof Error && (error.message.includes('Sunucu hatası') || error.message.includes("User not logged in")))) {
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
    await sendApiRequest(newAnnouncementData);
  }, [user, isAdmin]);

  const deleteAnnouncement = useCallback(async (id: string) => {
    if (!user) throw new Error("User not logged in");
    try {
      const response = await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        toast({ title: "Silme Başarısız", description: errorData.message, variant: "destructive" });
        throw new Error(errorData.message);
      }
    } catch (error) {
      console.error("[Announcements] Delete error:", error);
      if (!(error instanceof Error && error.message.includes("Silme Başarısız"))) {
          toast({ title: "Silme İşlemi Hatası", description: "Duyuru silinirken bir sorun oluştu.", variant: "destructive" });
      }
      throw error;
    }
  }, [user, toast]);

  const toggleAnnouncementLike = useCallback(async (announcementId: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Beğeni yapmak için giriş yapmalısınız.", variant: "destructive"});
      return;
    }
    const userId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;
    await sendApiRequest({ action: "TOGGLE_ANNOUNCEMENT_LIKE", announcementId, userId, userName: userId });
  }, [user, isAdmin]);

  const addCommentToAnnouncementHook = useCallback(async (announcementId: string, text: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Yorum yapmak için giriş yapmalısınız.", variant: "destructive"});
      return;
    }
    if (!text.trim()) {
      toast({ title: "Yorum Boş Olamaz", description: "Lütfen bir yorum yazın.", variant: "destructive"});
      return;
    }
    const authorName = `${user.name} ${user.surname}`;
    const authorId = authorName;

    const commentPayload: Omit<Comment, 'id' | 'date' | 'replies'> = {
      authorName,
      authorId,
      text,
    };
    await sendApiRequest({ action: "ADD_COMMENT_TO_ANNOUNCEMENT", announcementId, comment: commentPayload });
  }, [user]);

  const addReplyToCommentHook = useCallback(async (announcementId: string, commentId: string, text: string, replyingToAuthorName?: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Yanıtlamak için giriş yapmalısınız.", variant: "destructive"});
      return;
    }
     if (!text.trim()) {
      toast({ title: "Yanıt Boş Olamaz", description: "Lütfen bir yanıt yazın.", variant: "destructive"});
      return;
    }
    const authorName = `${user.name} ${user.surname}`;
    const authorId = authorName;
    const replyingToAuthorId = replyingToAuthorName;

    const replyPayload: Omit<Reply, 'id' | 'date'> = {
        authorName,
        authorId,
        text,
        replyingToAuthorName,
        replyingToAuthorId,
    };
    await sendApiRequest({ action: "ADD_REPLY_TO_COMMENT", announcementId, commentId, reply: replyPayload });
  }, [user]);

  const getAnnouncementById = useCallback((id: string): Announcement | undefined => {
    return announcementsRef.current.find(ann => ann.id === id); // Use ref here for potentially more stable access
  }, []); // announcementsRef.current is stable, so no need to list announcements as dependency

  return {
    announcements,
    addAnnouncement,
    deleteAnnouncement,
    getAnnouncementById,
    isLoading,
    unreadCount,
    toggleAnnouncementLike,
    addCommentToAnnouncement: addCommentToAnnouncementHook,
    addReplyToComment: addReplyToCommentHook,
  };
}

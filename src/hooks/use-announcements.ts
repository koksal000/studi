
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
}

export interface Comment {
  id: string;
  authorName: string;
  authorId: string;
  text: string;
  date: string;
  replies?: Reply[];
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

interface DeleteCommentPayload {
  action: "DELETE_COMMENT";
  announcementId: string;
  commentId: string;
}

interface DeleteReplyPayload {
  action: "DELETE_REPLY";
  announcementId: string;
  commentId: string;
  replyId: string;
}

type AnnouncementApiPayload =
  | ToggleAnnouncementLikePayload
  | AddCommentPayload
  | AddReplyPayload
  | DeleteCommentPayload
  | DeleteReplyPayload
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
      return;
    }
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === 'granted') {
        try {
          const notification = new Notification(title, {
            body: body,
            icon: '/images/logo.png',
            tag: tag || title,
            renotify: !!tag,
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
          toast({ title: title, description: body, duration: 8000, variant: "default" });
        }
      } else if (Notification.permission === 'default') {
        toast({ title: title, description: body, duration: 8000, variant: "default" });
      } else if (Notification.permission === 'denied') {
        // console.log("[Notifications] Browser notification permission denied by user.");
      }
    } else {
      toast({ title: title, description: body, duration: 8000, variant: "default" });
    }
  }, [siteNotificationsPreference, toast]);
  
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
        // setIsLoading handled by SSE or error in SSE
      });

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const newEventSource = new EventSource('/api/announcements/stream');
    eventSourceRef.current = newEventSource;

    newEventSource.onopen = () => {};

    newEventSource.onmessage = (event) => {
      const previousAnnouncementsState = [...announcementsRef.current];
      let updatedAnnouncementsFromServer: Announcement[];
      try {
        updatedAnnouncementsFromServer = JSON.parse(event.data);
      } catch (error) {
        console.error("[SSE Announcements] Error parsing SSE message data:", error);
        return;
      }

      setAnnouncements(updatedAnnouncementsFromServer);

      const wasInitialDataLoad = !initialDataLoadedRef.current;
      if (!initialDataLoadedRef.current) {
        initialDataLoadedRef.current = true;
        setIsLoading(false);
      }
      
      if (user && !wasInitialDataLoad) { // Only process notifications after initial load
        const currentUserIdentifier = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;

        updatedAnnouncementsFromServer.forEach(newAnn => {
          const oldAnnEquivalent = previousAnnouncementsState.find(pa => pa.id === newAnn.id);

          // Check for new announcements
          if (!oldAnnEquivalent && newAnn.authorId !== currentUserIdentifier) {
            showNotification(`Yeni Duyuru: ${newAnn.title}`, newAnn.content.substring(0, 100) + "...", `ann-${newAnn.id}`);
          }

          // Check for new replies
          newAnn.comments?.forEach(newComment => {
            const oldCommentEquivalent = oldAnnEquivalent?.comments?.find(pc => pc.id === newComment.id);
            newComment.replies?.forEach(newReply => {
              const isNewReply = !oldCommentEquivalent?.replies?.find(pr => pr.id === newReply.id);
              const isAuthorSelfReply = newReply.authorId === currentUserIdentifier;
              const isReplyToCurrentUser = newReply.replyingToAuthorId === currentUserIdentifier;

              if (isNewReply && isReplyToCurrentUser && !isAuthorSelfReply) {
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
      if (eventSourceRef.current !== target) return;
      
      const readyState = target?.readyState;
      if (readyState === EventSource.CONNECTING) {
        console.warn("[SSE Announcements] Connecting or reconnecting to SSE stream...");
      } else if (readyState === EventSource.CLOSED) {
         console.warn("[SSE Announcements] SSE Connection closed. Browser may attempt to reconnect.");
      } else {
        console.error("[SSE Announcements] SSE Connection error state:", readyState, errorEvent);
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
  }, [showNotification, user, isAdmin, siteNotificationsPreference]);

  const sendApiRequest = async (payload: AnnouncementApiPayload) => {
    if (!user && 'action' in payload && (payload.action !== "TOGGLE_ANNOUNCEMENT_LIKE")) { // Allow like toggle for non-logged in for now, API should handle
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
    const authorId = isAdmin ? "ADMIN_ACCOUNT_COMMENTER" : authorName; // Distinguish admin comments if needed

    const commentPayload: Omit<Comment, 'id' | 'date' | 'replies'> = {
      authorName,
      authorId,
      text,
    };
    await sendApiRequest({ action: "ADD_COMMENT_TO_ANNOUNCEMENT", announcementId, comment: commentPayload });
  }, [user, isAdmin]);

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
    const authorId = isAdmin ? "ADMIN_ACCOUNT_REPLIER" : authorName;
    const replyingToAuthorId = replyingToAuthorName; // Assuming name is used as ID for now

    const replyPayload: Omit<Reply, 'id' | 'date'> = {
        authorName,
        authorId,
        text,
        replyingToAuthorName,
        replyingToAuthorId,
    };
    await sendApiRequest({ action: "ADD_REPLY_TO_COMMENT", announcementId, commentId, reply: replyPayload });
  }, [user, isAdmin]);

  const deleteComment = useCallback(async (announcementId: string, commentId: string) => {
    if (!user || !isAdmin) { // Only admin can delete comments for now
      toast({ title: "Yetki Gerekli", description: "Yorum silmek için yönetici olmalısınız.", variant: "destructive"});
      throw new Error("Admin privileges required to delete comment.");
    }
    await sendApiRequest({ action: "DELETE_COMMENT", announcementId, commentId });
  }, [user, isAdmin]);

  const deleteReply = useCallback(async (announcementId: string, commentId: string, replyId: string) => {
     if (!user || !isAdmin) { // Only admin can delete replies for now
      toast({ title: "Yetki Gerekli", description: "Yanıt silmek için yönetici olmalısınız.", variant: "destructive"});
      throw new Error("Admin privileges required to delete reply.");
    }
    await sendApiRequest({ action: "DELETE_REPLY", announcementId, commentId, replyId });
  }, [user, isAdmin]);


  const getAnnouncementById = useCallback((id: string): Announcement | undefined => {
    return announcementsRef.current.find(ann => ann.id === id);
  }, []); // announcementsRef.current is stable

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
    deleteComment,
    deleteReply,
  };
}

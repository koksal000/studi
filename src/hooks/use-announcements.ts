
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/user-context';
import { useAnnouncementStatus } from '@/contexts/announcement-status-context';
import { useSettings } from '@/contexts/settings-context';
import { useToast } from './use-toast';
import { idbGet, idbSet, STORES } from '@/lib/idb';

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
  deleterAuthorId: string; 
}

interface DeleteReplyPayload {
  action: "DELETE_REPLY";
  announcementId: string;
  commentId: string;
  replyId: string;
  deleterAuthorId: string; 
}


type AnnouncementApiPayload =
  | ToggleAnnouncementLikePayload
  | AddCommentPayload
  | AddReplyPayload
  | DeleteCommentPayload
  | DeleteReplyPayload
  | Announcement; 

const ANNOUNCEMENTS_KEY = 'all-announcements';

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const { user, isAdmin } = useUser();
  const { toast } = useToast();
  const { lastOpenedNotificationTimestamp, setLastOpenedNotificationTimestamp: updateLastOpenedTimestamp, isStatusLoading: isNotificationStatusLoading } = useAnnouncementStatus();
  const [unreadCount, setUnreadCount] = useState(0);
  const { siteNotificationsPreference } = useSettings() ?? { siteNotificationsPreference: true };

  const eventSourceRef = useRef<EventSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const announcementsRef = useRef<Announcement[]>(announcements);

  useEffect(() => {
    announcementsRef.current = announcements;
    if (isNotificationStatusLoading || !announcementsRef.current) return;

    if (lastOpenedNotificationTimestamp) {
      const newUnreadCount = announcementsRef.current.filter(
        (ann) => new Date(ann.date).getTime() > lastOpenedNotificationTimestamp
      ).length;
      setUnreadCount(newUnreadCount);
    } else {
        setUnreadCount(announcementsRef.current.length);
    }
  }, [announcements, lastOpenedNotificationTimestamp, isNotificationStatusLoading]);

 const showNotification = useCallback((title: string, body: string, tag?: string) => {
    if (!siteNotificationsPreference) {
      return;
    }
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: body,
        icon: '/images/logo.png', 
        tag: tag || `ann-${Date.now()}`,
        renotify: !!tag, 
      });
      notification.onclick = (event) => {
        event.preventDefault();
        window.open(window.location.origin + '/announcements', '_blank');
        notification.close();
      };
    }
  }, [siteNotificationsPreference]);
  
  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      try {
        const cachedAnnouncements = await idbGet<Announcement[]>(STORES.ANNOUNCEMENTS, ANNOUNCEMENTS_KEY);
        if (cachedAnnouncements && Array.isArray(cachedAnnouncements)) {
          setAnnouncements(cachedAnnouncements);
        }
      } catch (e) {
        console.warn("Could not load announcements from IndexedDB:", e);
      }
      // We don't set loading to false here, SSE will do it.
      // This provides a fast initial paint, but we still show loading until fresh data arrives.
    }

    loadInitialData();

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const newEventSource = new EventSource('/api/announcements/stream');
    eventSourceRef.current = newEventSource;

    newEventSource.onmessage = (event) => {
      const previousAnnouncementsState = [...announcementsRef.current];
      try {
        const updatedAnnouncementsFromServer: Announcement[] = JSON.parse(event.data);
        
        // Update React state and IndexedDB cache
        setAnnouncements(updatedAnnouncementsFromServer);
        idbSet(STORES.ANNOUNCEMENTS, ANNOUNCEMENTS_KEY, updatedAnnouncementsFromServer).catch(e => console.error("Failed to cache announcements in IndexedDB", e));

        if (isLoading) setIsLoading(false);

        // Notification logic
        if (user && previousAnnouncementsState.length > 0) { // Only notify after initial load
            const currentUserIdentifier = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;
            updatedAnnouncementsFromServer.forEach(newAnn => {
                const isGenuinelyNew = !previousAnnouncementsState.find(pa => pa.id === newAnn.id);
                const isAuthorSelf = newAnn.authorId === currentUserIdentifier;

                if (isGenuinelyNew && !isAuthorSelf) {
                    const notificationTitle = `Yeni Duyuru: ${newAnn.title}`;
                    const notificationBody = newAnn.content.substring(0, 100) + (newAnn.content.length > 100 ? "..." : "");
                    showNotification(notificationTitle, notificationBody, `new-ann-${newAnn.id}`);
                }
            });
        }
      } catch (error) {
        console.error("[SSE Announcements] Error parsing SSE message data:", error);
      }
    };

    newEventSource.onerror = (error) => {
      console.error("[SSE Announcements] Connection error:", error);
      if (isLoading) setIsLoading(false); // Stop loading on error if we never got a message
    };

    return () => {
      if (newEventSource) newEventSource.close();
      eventSourceRef.current = null;
    };
  }, [user, isAdmin, siteNotificationsPreference, showNotification, isLoading]); 

  const sendApiRequest = async (payload: AnnouncementApiPayload, method: 'POST' | 'DELETE' = 'POST', queryParams = '') => {
    if (!user && 'action' in payload && (payload.action !== "TOGGLE_ANNOUNCEMENT_LIKE")) {
      toast({ title: "Giriş Gerekli", description: "Bu işlemi yapmak için giriş yapmalısınız.", variant: "destructive" });
      throw new Error("User not logged in for this action");
    }
    try {
      const response = await fetch(`/api/announcements${queryParams}`, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify(payload) : undefined,
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
    toast({ title: "Duyuru Eklendi", description: `"${newAnnouncementData.title}" başarıyla yayınlandı.` });
  }, [user, isAdmin, toast]);

  const deleteAnnouncement = useCallback(async (id: string) => {
    if (!user || !isAdmin) { 
        toast({ title: "Yetki Gerekli", description: "Duyuru silmek için yönetici olmalısınız.", variant: "destructive"});
        throw new Error("Admin privileges required to delete announcement.");
    }
    await sendApiRequest(undefined as any, 'DELETE', `?id=${id}`);
  }, [user, isAdmin, toast]);

  const toggleAnnouncementLike = useCallback(async (announcementId: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Beğeni yapmak için giriş yapmalısınız.", variant: "destructive"});
      return;
    }
    const userId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;
    await sendApiRequest({ action: "TOGGLE_ANNOUNCEMENT_LIKE", announcementId, userId, userName: userId });
  }, [user, isAdmin, toast]);

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
    const authorId = isAdmin ? "ADMIN_ACCOUNT" : authorName;

    const commentPayload: Omit<Comment, 'id' | 'date' | 'replies'> = {
      authorName,
      authorId,
      text,
    };
    await sendApiRequest({ action: "ADD_COMMENT_TO_ANNOUNCEMENT", announcementId, comment: commentPayload });
    toast({ title: "Yorum Eklendi", description: "Yorumunuz başarıyla gönderildi." });
  }, [user, isAdmin, toast]);

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
    const authorId = isAdmin ? "ADMIN_ACCOUNT" : authorName;
    const replyingToAuthorId = replyingToAuthorName; 

    const replyPayload: Omit<Reply, 'id' | 'date'> = {
        authorName,
        authorId,
        text,
        replyingToAuthorName,
        replyingToAuthorId,
    };
    await sendApiRequest({ action: "ADD_REPLY_TO_COMMENT", announcementId, commentId, reply: replyPayload });
    toast({ title: "Yanıt Eklendi", description: "Yanıtınız başarıyla gönderildi." });
  }, [user, isAdmin, toast]);

  const deleteComment = useCallback(async (announcementId: string, commentId: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Yorum silmek için giriş yapmalısınız.", variant: "destructive"});
      throw new Error("User not logged in for delete comment.");
    }
    const deleterAuthorId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;
    await sendApiRequest({ action: "DELETE_COMMENT", announcementId, commentId, deleterAuthorId });
  }, [user, isAdmin, toast]);

  const deleteReply = useCallback(async (announcementId: string, commentId: string, replyId: string) => {
     if (!user) { 
      toast({ title: "Giriş Gerekli", description: "Yanıt silmek için giriş yapmalısınız.", variant: "destructive"});
      throw new Error("User not logged in for delete reply.");
    }
    const deleterAuthorId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;
    await sendApiRequest({ action: "DELETE_REPLY", announcementId, commentId, replyId, deleterAuthorId });
  }, [user, isAdmin, toast]);


  const getAnnouncementById = useCallback((id: string): Announcement | undefined => {
    return announcements.find(ann => ann.id === id);
  }, [announcements]); 

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

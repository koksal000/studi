
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

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const { user, isAdmin } = useUser();
  const { toast } = useToast();
  const { lastOpenedNotificationTimestamp, setLastOpenedNotificationTimestamp: updateLastOpenedTimestamp, isStatusLoading: isNotificationStatusLoading } = useAnnouncementStatus();
  const [unreadCount, setUnreadCount] = useState(0);
  const { siteNotificationsPreference } = useSettings() ?? { siteNotificationsPreference: true };

  const eventSourceRef = useRef<EventSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialDataLoadedRef = useRef(false);
  const announcementsRef = useRef<Announcement[]>(announcements);

  useEffect(() => {
    announcementsRef.current = announcements;
    if (isNotificationStatusLoading) return;

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
  }, [announcements, lastOpenedNotificationTimestamp, updateLastOpenedTimestamp, isNotificationStatusLoading]);

 const showNotification = useCallback((title: string, body: string, tag?: string) => {
    if (!siteNotificationsPreference) {
      // console.log("[Notifications] Site notifications preference is disabled.");
      return;
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === 'granted') {
        try {
          const notification = new Notification(title, {
            body: body,
            icon: '/images/logo.png', 
            tag: tag || `ann-${Date.now()}`,
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
      } else if (Notification.permission === 'denied') {
        // console.log("[Notifications] Browser notification permission denied by user.");
      } else if (Notification.permission === 'default') {
        // console.log("[Notifications] Browser notification permission is default. Falling back to toast.");
        toast({ title: title, description: body, duration: 8000, variant: "default" });
      }
    } else {
      // console.log("[Notifications] Notification API not available. Falling back to toast.");
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
      const previousAnnouncementsState = [...announcementsRef.current]; // Capture state BEFORE update
      let updatedAnnouncementsFromServer: Announcement[];
      try {
        updatedAnnouncementsFromServer = JSON.parse(event.data);
      } catch (error) {
        console.error("[SSE Announcements] Error parsing SSE message data:", error);
        return;
      }
      
      const wasInitialDataLoad = !initialDataLoadedRef.current;
      if (!initialDataLoadedRef.current) {
        initialDataLoadedRef.current = true;
        setIsLoading(false);
      }
      
      // Update main state after checking wasInitialDataLoad, but before notification logic
      setAnnouncements(updatedAnnouncementsFromServer); 

      if (user && !wasInitialDataLoad) { // Only process notifications after initial load and if user exists
        const currentUserIdentifier = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;
        
        updatedAnnouncementsFromServer.forEach(newAnn => {
          const isGenuinelyNew = !previousAnnouncementsState.find(pa => pa.id === newAnn.id);
          const isAuthorSelf = newAnn.authorId === currentUserIdentifier;

          if (isGenuinelyNew && !isAuthorSelf) {
            const notificationTitle = `Yeni Duyuru: ${newAnn.title}`;
            const notificationBody = newAnn.content.substring(0, 100) + (newAnn.content.length > 100 ? "..." : "");
            showNotification(notificationTitle, notificationBody, `new-ann-${newAnn.id}`);
          }

          const oldAnnEquivalent = previousAnnouncementsState.find(pa => pa.id === newAnn.id);
          newAnn.comments?.forEach(newComment => {
            const oldCommentEquivalent = oldAnnEquivalent?.comments?.find(pc => pc.id === newComment.id);
            
            newComment.replies?.forEach(newReply => {
              const isNewReply = !oldCommentEquivalent?.replies?.find(pr => pr.id === newReply.id);
              const isAuthorSelfReply = newReply.authorId === currentUserIdentifier;
              const isReplyToCurrentUser = newReply.replyingToAuthorId === currentUserIdentifier;

              if (isNewReply && isReplyToCurrentUser && !isAuthorSelfReply) {
                const replyNotificationTitle = `${newReply.authorName} size yanıt verdi`;
                const replyNotificationBody = `@${newReply.replyingToAuthorName}: "${newReply.text.substring(0, 50)}..."`;
                showNotification(replyNotificationTitle, replyNotificationBody, `reply-${newReply.id}-${newAnn.id}`);
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
  }, [user, isAdmin, siteNotificationsPreference, showNotification, toast]); 

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


    
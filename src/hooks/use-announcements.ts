
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
  replyingToAuthorName?: string; // Name of the author of the comment/reply being replied to
  replyingToAuthorId?: string;   // ID of the author of the comment/reply being replied to
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
  authorId: string; // 'ADMIN_ACCOUNT' or 'UserName UserSurname'
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
  userId: string; // Identifier of the user liking/unliking
  userName: string; // Name of the user (for potential future use, though ID is primary)
}

interface AddCommentPayload {
  action: "ADD_COMMENT_TO_ANNOUNCEMENT";
  announcementId: string;
  comment: Omit<Comment, 'id' | 'date' | 'replies'>; // Server will generate id and date
}

interface AddReplyPayload {
  action: "ADD_REPLY_TO_COMMENT";
  announcementId: string;
  commentId: string;
  reply: Omit<Reply, 'id' | 'date'>; // Server will generate id and date
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
  | Announcement; // For adding a new announcement

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
            icon: '/images/logo.png', // Ensure this path is correct in your public folder
            tag: tag || title, // Using a tag can help prevent duplicate notifications or update existing ones
            renotify: !!tag, // If tag is used, renotify to make sure user sees it
          });
          notification.onclick = (event) => {
            event.preventDefault();
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
            window.open(appUrl + '/announcements', '_blank'); // Or specific announcement URL
            if (window.focus) window.focus();
            notification.close();
          };
        } catch (err: any) {
          console.error("[Notifications] Browser notification construction error:", err);
          toast({ title: title, description: body, duration: 8000, variant: "default" });
        }
      } else if (Notification.permission === 'default') {
        // console.log("[Notifications] Browser notification permission is default. Falling back to toast.");
        toast({ title: title, description: body, duration: 8000, variant: "default" });
      } else if (Notification.permission === 'denied') {
        // console.log("[Notifications] Browser notification permission denied by user.");
        // Optionally, inform user via a non-intrusive way that they've blocked notifications
      }
    } else {
      // Fallback for environments where Notification API is not available
      // console.log("[Notifications] Notification API not available. Falling back to toast.");
      toast({ title: title, description: body, duration: 8000, variant: "default" });
    }
  }, [siteNotificationsPreference, toast]);
  
  useEffect(() => {
    initialDataLoadedRef.current = false;
    setIsLoading(true);

    // Fetch initial data
    fetch('/api/announcements')
      .then(res => {
        if (!res.ok) {
          console.error(`[Announcements] Failed to fetch initial announcements: ${res.status} ${res.statusText}`);
          return []; // Return empty array on error to avoid breaking JSON.parse
        }
        return res.json();
      })
      .then((data: Announcement[]) => {
        setAnnouncements(Array.isArray(data) ? data : []);
        // Don't set initialDataLoadedRef or setIsLoading here; let SSE handle it
      })
      .catch(err => {
        console.error("[Announcements] Error fetching or parsing initial announcements:", err);
        setAnnouncements([]); // Set to empty on error
        // If SSE also fails, isLoading might remain true. It's set to false in SSE onmessage/onerror.
      });

    // Close existing EventSource if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const newEventSource = new EventSource('/api/announcements/stream');
    eventSourceRef.current = newEventSource;

    newEventSource.onopen = () => {
      // console.log('[SSE Announcements] Connection opened.');
    };

    newEventSource.onmessage = (event) => {
      const previousAnnouncementsState = [...announcementsRef.current]; // Capture state *before* update
      let updatedAnnouncementsFromServer: Announcement[];
      try {
        updatedAnnouncementsFromServer = JSON.parse(event.data);
      } catch (error) {
        console.error("[SSE Announcements] Error parsing SSE message data:", error);
        return; // Skip update if data is malformed
      }

      setAnnouncements(updatedAnnouncementsFromServer); // Update the main state

      const wasInitialDataLoad = !initialDataLoadedRef.current;
      if (!initialDataLoadedRef.current) {
        initialDataLoadedRef.current = true; // Mark initial data as loaded
        setIsLoading(false); // Set loading to false
      }
      
      // Notification logic only after initial load and if user is logged in
      if (user && !wasInitialDataLoad) {
        const currentUserIdentifier = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;

        // Check for new announcements
        updatedAnnouncementsFromServer.forEach(newAnn => {
          const oldAnnEquivalent = previousAnnouncementsState.find(pa => pa.id === newAnn.id);
          if (!oldAnnEquivalent && newAnn.authorId !== currentUserIdentifier) { // It's a new announcement not made by current user
            // console.log(`[Notification] New announcement detected: ${newAnn.title} by ${newAnn.author}`);
            showNotification(
              `Yeni Duyuru: ${newAnn.title}`, 
              newAnn.content.substring(0, 100) + (newAnn.content.length > 100 ? "..." : ""),
              `ann-${newAnn.id}`
            );
          }

          // Check for new replies to current user's comments or replies
          newAnn.comments?.forEach(newComment => {
            const oldCommentEquivalent = oldAnnEquivalent?.comments?.find(pc => pc.id === newComment.id);
            newComment.replies?.forEach(newReply => {
              const isNewReply = !oldCommentEquivalent?.replies?.find(pr => pr.id === newReply.id);
              const isAuthorSelfReply = newReply.authorId === currentUserIdentifier;
              const isReplyToCurrentUser = newReply.replyingToAuthorId === currentUserIdentifier;

              if (isNewReply && isReplyToCurrentUser && !isAuthorSelfReply) {
                // console.log(`[Notification] New reply to current user: ${newReply.text} by ${newReply.authorName}`);
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
      // console.error("[SSE Announcements] SSE Connection error:", errorEvent);
       const target = errorEvent.target as EventSource;
      if (eventSourceRef.current !== target) return; // Error from an old EventSource
      
      const readyState = target?.readyState;
      // console.warn(`[SSE Announcements] SSE error. ReadyState: ${readyState}. Event:`, errorEvent);

      if (!initialDataLoadedRef.current) { // If initial data hasn't loaded via SSE message
        setIsLoading(false); // Stop loading spinner if SSE fails early
        initialDataLoadedRef.current = true; // Mark that we've tried to load
      }
      // Consider more robust error handling or timed reconnection attempts if needed.
      // Browsers usually handle reconnection automatically for EventSource.
    };

    return () => {
      if (newEventSource) {
        newEventSource.close();
        // console.log('[SSE Announcements] Connection closed on cleanup.');
      }
      eventSourceRef.current = null;
    };
  }, [user, isAdmin, siteNotificationsPreference, showNotification, toast]); // Added toast to dependencies

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
      // For POST, we expect SSE to update. For DELETE, it will also come via SSE.
      // Optionally return response.json() if needed, but usually not for commands.
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
      authorId: isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`, // Consistent ID for admin
      likes: [],
      comments: [],
    };
    await sendApiRequest(newAnnouncementData);
    toast({ title: "Duyuru Eklendi", description: `"${newAnnouncementData.title}" başarıyla yayınlandı.` });
  }, [user, isAdmin, toast]);

  const deleteAnnouncement = useCallback(async (id: string) => {
    if (!user || !isAdmin) { // Only admin can delete announcements
        toast({ title: "Yetki Gerekli", description: "Duyuru silmek için yönetici olmalısınız.", variant: "destructive"});
        throw new Error("Admin privileges required to delete announcement.");
    }
    await sendApiRequest(undefined as any, 'DELETE', `?id=${id}`); // Payload not needed for DELETE query param
    // Toast for success/failure is handled by sendApiRequest or calling component
  }, [user, isAdmin, toast]);

  const toggleAnnouncementLike = useCallback(async (announcementId: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Beğeni yapmak için giriş yapmalısınız.", variant: "destructive"});
      return;
    }
    // Use a consistent identifier for likes, regardless of admin status.
    // If admin has a separate user profile, use that. Otherwise, use a generic admin ID or their name.
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
    const authorId = isAdmin ? "ADMIN_ACCOUNT" : authorName; // Admin comments also use their name as ID for comments

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
    const authorId = isAdmin ? "ADMIN_ACCOUNT" : authorName; // Admin replies also use their name as ID
    const replyingToAuthorId = replyingToAuthorName; // Assuming name is used as ID for now

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
    if (!user || !isAdmin) {
      toast({ title: "Yetki Gerekli", description: "Yorum silmek için yönetici olmalısınız.", variant: "destructive"});
      throw new Error("Admin privileges required to delete comment.");
    }
    await sendApiRequest({ action: "DELETE_COMMENT", announcementId, commentId });
    // Success toast handled by the component after AdminPasswordDialog
  }, [user, isAdmin, toast]);

  const deleteReply = useCallback(async (announcementId: string, commentId: string, replyId: string) => {
     if (!user || !isAdmin) { 
      toast({ title: "Yetki Gerekli", description: "Yanıt silmek için yönetici olmalısınız.", variant: "destructive"});
      throw new Error("Admin privileges required to delete reply.");
    }
    await sendApiRequest({ action: "DELETE_REPLY", announcementId, commentId, replyId });
    // Success toast handled by the component
  }, [user, isAdmin, toast]);


  const getAnnouncementById = useCallback((id: string): Announcement | undefined => {
    // Use announcementsRef.current for the most up-to-date list, 
    // but this function's stability depends on how often it's called vs. state updates.
    // If called within a useEffect that depends on `announcements`, it's fine.
    return announcements.find(ann => ann.id === id);
  }, [announcements]); // Depend on announcements state to re-memoize when it changes

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

    
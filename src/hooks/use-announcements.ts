
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/user-context';
import { useAnnouncementStatus } from '@/contexts/announcement-status-context';
import { useSettings } from '@/contexts/settings-context';
import { useToast } from './use-toast';

export interface Like {
  userId: string; // user.name + " " + user.surname for now
}

export interface Reply {
  id: string;
  authorName: string; // user.name + " " + user.surname
  authorId: string; // user.name + " " + user.surname for association
  text: string;
  date: string; // ISO string
  replyingToAuthorName?: string; 
  replyingToAuthorId?: string; 
  likes?: Like[];
}

export interface Comment {
  id: string;
  authorName: string; // user.name + " " + user.surname
  authorId: string; // user.name + " " + user.surname for association
  text: string;
  date: string; // ISO string
  replies?: Reply[];
  likes?: Like[];
}

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
interface ToggleAnnouncementLikePayload {
  action: "TOGGLE_ANNOUNCEMENT_LIKE";
  announcementId: string;
  userId: string;
  userName: string;
}

interface AddCommentPayload {
  action: "ADD_COMMENT_TO_ANNOUNCEMENT";
  announcementId: string;
  comment: Omit<Comment, 'id' | 'date' | 'replies' | 'likes'>;
}

interface AddReplyPayload {
  action: "ADD_REPLY_TO_COMMENT";
  announcementId: string;
  commentId: string;
  reply: Omit<Reply, 'id' | 'date' | 'likes'>;
}

interface ToggleCommentLikePayload {
  action: "TOGGLE_COMMENT_LIKE";
  announcementId: string;
  commentId: string;
  userId: string;
}

interface ToggleReplyLikePayload {
  action: "TOGGLE_REPLY_LIKE";
  announcementId: string;
  commentId: string;
  replyId: string;
  userId: string;
}


type AnnouncementApiPayload = 
  | ToggleAnnouncementLikePayload 
  | AddCommentPayload 
  | AddReplyPayload 
  | ToggleCommentLikePayload
  | ToggleReplyLikePayload
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
        const previousAnnouncements = announcementsRef.current; // Use the ref for comparison before state update
        setAnnouncements(updatedAnnouncementsFromServer);

        // Notification logic for new announcements
        if (updatedAnnouncementsFromServer.length > 0 && previousAnnouncements.length > 0) {
            const latestServerAnnouncement = updatedAnnouncementsFromServer[0]; // Assuming sorted by date desc
            const correspondingPrevAnnouncement = previousAnnouncements.find(ann => ann.id === latestServerAnnouncement.id);
            
            const isNewAnnouncement = !correspondingPrevAnnouncement && new Date(latestServerAnnouncement.date).getTime() > (previousAnnouncements[0] ? new Date(previousAnnouncements[0].date).getTime() : 0);
            const isAuthorSelfAnnouncement = user && (latestServerAnnouncement.authorId === (isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`));

            if (isNewAnnouncement && !isAuthorSelfAnnouncement) {
                 showNotification(`Yeni Duyuru: ${latestServerAnnouncement.title}`, latestServerAnnouncement.content.substring(0, 100) + "...");
            }
        } else if (updatedAnnouncementsFromServer.length > previousAnnouncements.length && updatedAnnouncementsFromServer.length > 0) {
            const latestServerAnnouncement = updatedAnnouncementsFromServer[0];
            const isAuthorSelfAnnouncement = user && (latestServerAnnouncement.authorId === (isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`));
            if (!isAuthorSelfAnnouncement) {
                showNotification(`Yeni Duyuru: ${latestServerAnnouncement.title}`, latestServerAnnouncement.content.substring(0, 100) + "...");
            }
        }

        // Notification logic for new replies to user
        if (user) {
            const currentUserFullName = `${user.name} ${user.surname}`;
            updatedAnnouncementsFromServer.forEach(newAnn => {
                const oldAnn = previousAnnouncements.find(pa => pa.id === newAnn.id);
                newAnn.comments?.forEach(newComment => {
                    const oldComment = oldAnn?.comments?.find(pc => pc.id === newComment.id);
                    newComment.replies?.forEach(newReply => {
                        const oldReply = oldComment?.replies?.find(pr => pr.id === newReply.id);
                        if (!oldReply) { // This is a new reply
                            const isAuthorSelfReply = newReply.authorId === currentUserFullName;
                            const replyingToCurrentUserComment = newComment.authorId === currentUserFullName;
                            const replyingToCurrentUserReply = newReply.replyingToAuthorId === currentUserFullName;

                            if ((replyingToCurrentUserComment || replyingToCurrentUserReply) && !isAuthorSelfReply) {
                                showNotification(
                                    `${newReply.authorName} size yanıt verdi`, 
                                    `"${newComment.text.substring(0,30)}..." yorumuna: ${newReply.text.substring(0, 50)}...`
                                );
                            }
                        }
                    });
                });
            });
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
      if (newEventSource) newEventSource.close();
      eventSourceRef.current = null;
    };
  }, [showNotification, user, isAdmin, updateLastOpenedTimestamp]); // Removed announcements from dependency array for the main SSE effect

  const sendApiRequest = async (payload: AnnouncementApiPayload) => {
    if (!user && payload.action !== "TOGGLE_ANNOUNCEMENT_LIKE" && payload.action !== "TOGGLE_COMMENT_LIKE" && payload.action !== "TOGGLE_REPLY_LIKE" && !('title' in payload) /* for adding announcement */) {
        if (payload.action === "ADD_COMMENT_TO_ANNOUNCEMENT" || payload.action === "ADD_REPLY_TO_COMMENT") {
             toast({ title: "Giriş Gerekli", description: "Bu işlemi yapmak için giriş yapmalısınız.", variant: "destructive" });
             throw new Error("User not logged in for this action");
        }
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
      // No local state update here, rely on SSE
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
  }, [user, isAdmin, sendApiRequest]); // sendApiRequest is stable

  const deleteAnnouncement = useCallback(async (id: string) => {
    if (!user) throw new Error("User not logged in");
    try {
      const response = await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        toast({ title: "Silme Başarısız", description: errorData.message, variant: "destructive" });
        throw new Error(errorData.message);
      }
      // No local state update here, rely on SSE
    } catch (error) {
      console.error("[Announcements] Delete error:", error);
      throw error;
    }
  }, [user, toast]); // toast is stable

  const toggleAnnouncementLike = useCallback(async (announcementId: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Beğeni yapmak için giriş yapmalısınız.", variant: "destructive"});
      return;
    }
    const userId = `${user.name} ${user.surname}`;
    await sendApiRequest({ action: "TOGGLE_ANNOUNCEMENT_LIKE", announcementId, userId, userName: userId });
  }, [user, sendApiRequest, toast]);

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

    const commentPayload: Omit<Comment, 'id' | 'date' | 'replies' | 'likes'> = {
      authorName,
      authorId,
      text,
    };
    await sendApiRequest({ action: "ADD_COMMENT_TO_ANNOUNCEMENT", announcementId, comment: commentPayload });
  }, [user, sendApiRequest, toast]);

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
    const replyingToAuthorId = replyingToAuthorName; // Using name as ID for now

    const replyPayload: Omit<Reply, 'id' | 'date' | 'likes'> = {
        authorName,
        authorId,
        text,
        replyingToAuthorName,
        replyingToAuthorId,
    };
    await sendApiRequest({ action: "ADD_REPLY_TO_COMMENT", announcementId, commentId, reply: replyPayload });
  }, [user, sendApiRequest, toast]);

  const toggleCommentLike = useCallback(async (announcementId: string, commentId: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Beğeni yapmak için giriş yapmalısınız.", variant: "destructive"});
      return;
    }
    const userId = `${user.name} ${user.surname}`;
    await sendApiRequest({ action: "TOGGLE_COMMENT_LIKE", announcementId, commentId, userId });
  }, [user, sendApiRequest, toast]);

  const toggleReplyLike = useCallback(async (announcementId: string, commentId: string, replyId: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Beğeni yapmak için giriş yapmalısınız.", variant: "destructive"});
      return;
    }
    const userId = `${user.name} ${user.surname}`;
    await sendApiRequest({ action: "TOGGLE_REPLY_LIKE", announcementId, commentId, replyId, userId });
  }, [user, sendApiRequest, toast]);


  const getAnnouncementById = useCallback((id: string): Announcement | undefined => {
    // Use the announcements state directly so this function returns the latest data
    // when announcements state itself is updated.
    return announcements.find(ann => ann.id === id);
  }, [announcements]); // Depend on the announcements state

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
    toggleCommentLike,
    toggleReplyLike
  };
}



"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { useAnnouncementStatus } from '@/contexts/announcement-status-context';
import { useToast } from './use-toast';
import { broadcastAnnouncementUpdate } from '@/lib/broadcast-channel';


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

// This hook now manages all announcement data, interactions, and optimistic UI updates.
export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAdmin } = useUser();
  const { lastOpenedNotificationTimestamp } = useAnnouncementStatus();
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  const fetchAnnouncements = useCallback(async () => {
    // Only set loading to true on initial fetch
    if (announcements.length === 0) {
        setIsLoading(true);
    }
    try {
      const response = await fetch('/api/announcements');
      if (!response.ok) throw new Error('Duyurular sunucudan alınamadı.');
      const data: Announcement[] = await response.json();
      setAnnouncements(data);
    } catch (error: any) {
      toast({ title: 'Veri Yükleme Hatası', description: error.message, variant: 'destructive' });
      setAnnouncements([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast, announcements.length]);

  useEffect(() => {
    fetchAnnouncements();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (announcements.length > 0 && lastOpenedNotificationTimestamp) {
        setUnreadCount(announcements.filter(ann => new Date(ann.date).getTime() > lastOpenedNotificationTimestamp).length);
    } else if (announcements.length > 0 && !lastOpenedNotificationTimestamp) {
        setUnreadCount(announcements.length);
    } else {
        setUnreadCount(0);
    }
  }, [announcements, lastOpenedNotificationTimestamp]);
  
  // A generic function to perform optimistic updates and API calls
  const performApiAction = useCallback(async (
    optimisticUpdate: (currentData: Announcement[]) => Announcement[],
    apiCall: () => Promise<Response>,
    successToast?: { title: string, description?: string }
  ) => {
    const originalData = [...announcements];
    const optimisticData = optimisticUpdate(originalData);
    setAnnouncements(optimisticData);

    try {
      const response = await apiCall();
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
        throw new Error(errorData.message);
      }
      
      if (successToast) {
        toast(successToast);
      }
      
      await fetchAnnouncements(); // Re-fetch for consistency
      broadcastAnnouncementUpdate();

    } catch (error: any) {
      toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
      setAnnouncements(originalData); // Rollback on failure
    }
  }, [announcements, toast, fetchAnnouncements]);


  const addAnnouncement = useCallback(async (payload: NewAnnouncementPayload) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Duyuru eklemek için giriş yapmalısınız.", variant: "destructive" });
      return;
    }

    const optimisticUpdate = (currentData: Announcement[]) => {
      const newAnnouncement: Announcement = {
        ...payload,
        id: `ann_temp_${Date.now()}`,
        date: new Date().toISOString(),
        author: isAdmin ? "Yönetim Hesabı" : `${user.name} ${user.surname}`,
        authorId: isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`,
        likes: [],
        comments: [],
      };
      return [newAnnouncement, ...currentData];
    };

    const apiCall = () => fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ...payload,
        id: `ann_${Date.now()}`,
        date: new Date().toISOString(),
        author: isAdmin ? "Yönetim Hesabı" : `${user.name} ${user.surname}`,
        authorId: isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`,
        likes: [],
        comments: [],
       })
    });
    
    await performApiAction(optimisticUpdate, apiCall, { title: "Duyuru Eklendi", description: "Duyurunuz başarıyla yayınlandı." });
  }, [user, isAdmin, performApiAction, toast]);
  
  const deleteAnnouncement = useCallback(async (id: string) => {
    if (!user || !isAdmin) {
      toast({ title: "Yetki Gerekli", description: "Duyuru silmek için yönetici olmalısınız.", variant: "destructive" });
      return;
    }
    
    const optimisticUpdate = (currentData: Announcement[]) => currentData.filter(a => a.id !== id);
    const apiCall = () => fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });

    await performApiAction(optimisticUpdate, apiCall, { title: "Duyuru Silindi" });
  }, [user, isAdmin, performApiAction, toast]);

  const toggleAnnouncementLike = useCallback(async (announcementId: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Beğeni yapmak için giriş yapmalısınız.", variant: "destructive"});
      return;
    }
    const userId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;
    
    const optimisticUpdate = (currentData: Announcement[]) => currentData.map(ann => {
      if (ann.id === announcementId) {
        const newLikes = ann.likes ? [...ann.likes] : [];
        const likeIndex = newLikes.findIndex(l => l.userId === userId);
        if (likeIndex > -1) {
          newLikes.splice(likeIndex, 1);
        } else {
          newLikes.push({ userId });
        }
        return { ...ann, likes: newLikes };
      }
      return ann;
    });

    const apiCall = () => fetch('/api/announcements', { 
      method: 'POST', 
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify({ action: "TOGGLE_ANNOUNCEMENT_LIKE", announcementId, userId, userName: userId }) 
    });

    await performApiAction(optimisticUpdate, apiCall);
  }, [user, isAdmin, performApiAction, toast]);

  const addCommentToAnnouncement = useCallback(async (announcementId: string, text: string) => {
    if (!user) { throw new Error("Not logged in"); }
    const authorName = `${user.name} ${user.surname}`;
    const authorId = isAdmin ? "ADMIN_ACCOUNT" : authorName;
    
    const optimisticUpdate = (currentData: Announcement[]) => currentData.map(ann => {
      if (ann.id === announcementId) {
        const tempComment: Comment = { id: `cmt_temp_${Date.now()}`, authorName, authorId, text, date: new Date().toISOString(), replies: [] };
        const newComments = ann.comments ? [tempComment, ...ann.comments] : [tempComment];
        return { ...ann, comments: newComments };
      }
      return ann;
    });

    const apiCall = () => fetch('/api/announcements', { 
      method: 'POST', 
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify({ action: "ADD_COMMENT_TO_ANNOUNCEMENT", announcementId, comment: { authorName, authorId, text } }) 
    });

    await performApiAction(optimisticUpdate, apiCall, { title: "Yorum Eklendi" });
  }, [user, isAdmin, performApiAction, toast]);
  
  const addReplyToComment = useCallback(async (announcementId: string, commentId: string, text: string, replyingToAuthorName?: string) => {
    if (!user) { throw new Error("Not logged in"); }
    const authorName = `${user.name} ${user.surname}`;
    const authorId = isAdmin ? "ADMIN_ACCOUNT" : authorName;

    const optimisticUpdate = (currentData: Announcement[]) => currentData.map(ann => {
      if (ann.id === announcementId) {
        const newComments = (ann.comments || []).map(c => {
          if (c.id === commentId) {
            const tempReply: Reply = { id: `rpl_temp_${Date.now()}`, authorName, authorId, text, date: new Date().toISOString(), replyingToAuthorName };
            const newReplies = c.replies ? [tempReply, ...c.replies] : [tempReply];
            return {...c, replies: newReplies};
          }
          return c;
        });
        return {...ann, comments: newComments};
      }
      return ann;
    });

    const apiCall = () => fetch('/api/announcements', { 
      method: 'POST', 
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify({ action: "ADD_REPLY_TO_COMMENT", announcementId, commentId, reply: { authorName, authorId, text, replyingToAuthorName, replyingToAuthorId: replyingToAuthorName } })
    });

    await performApiAction(optimisticUpdate, apiCall, { title: "Yanıt Eklendi" });
  }, [user, isAdmin, performApiAction, toast]);

  const deleteComment = useCallback(async (announcementId: string, commentId: string) => {
    if (!user) { throw new Error("User not logged in"); }
    const deleterAuthorId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;

    const optimisticUpdate = (currentData: Announcement[]) => currentData.map(ann => {
        if (ann.id === announcementId) {
            const commentToDelete = (ann.comments || []).find(c => c.id === commentId);
            if (commentToDelete && commentToDelete.authorId !== deleterAuthorId) {
                toast({ title: "Yetki Hatası", description: "Bu yorumu silme yetkiniz yok.", variant: "destructive" });
                return currentData; // Return original data if not authorized
            }
            return {...ann, comments: (ann.comments || []).filter(c => c.id !== commentId)};
        }
        return ann;
    });

    const apiCall = () => fetch('/api/announcements', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ action: "DELETE_COMMENT", announcementId, commentId, deleterAuthorId })
    });

    await performApiAction(optimisticUpdate, apiCall, { title: "Yorum Silindi" });
  }, [user, isAdmin, performApiAction, toast]);

  const deleteReply = useCallback(async (announcementId: string, commentId: string, replyId: string) => {
    if (!user) { throw new Error("User not logged in"); }
    const deleterAuthorId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;

    const optimisticUpdate = (currentData: Announcement[]) => currentData.map(ann => {
        if (ann.id === announcementId) {
            const newComments = (ann.comments || []).map(c => {
                if (c.id === commentId) {
                    const replyToDelete = (c.replies || []).find(r => r.id === replyId);
                     if (replyToDelete && replyToDelete.authorId !== deleterAuthorId) {
                        toast({ title: "Yetki Hatası", description: "Bu yanıtı silme yetkiniz yok.", variant: "destructive" });
                        return c;
                    }
                    return {...c, replies: (c.replies || []).filter(r => r.id !== replyId)};
                }
                return c;
            });
            // If check fails, it returns the original comments array, so we must check if it's a new array
            if (JSON.stringify(newComments) === JSON.stringify(ann.comments)) return ann;
            return {...ann, comments: newComments};
        }
        return ann;
    });

    const apiCall = () => fetch('/api/announcements', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ action: "DELETE_REPLY", announcementId, commentId, replyId, deleterAuthorId })
    });

    await performApiAction(optimisticUpdate, apiCall, { title: "Yanıt Silindi" });
  }, [user, isAdmin, performApiAction, toast]);

  // Listen for broadcasted updates from other tabs/components
  useEffect(() => {
    const channel = new BroadcastChannel('announcement_updates');
    const handleMessage = (event: MessageEvent) => {
        if (event.data === 'update') {
            fetchAnnouncements();
        }
    };
    channel.addEventListener('message', handleMessage);

    return () => {
        channel.removeEventListener('message', handleMessage);
        channel.close();
    };
  }, [fetchAnnouncements]);


  return {
    announcements,
    addAnnouncement,
    deleteAnnouncement,
    isLoading,
    unreadCount,
    toggleAnnouncementLike,
    addCommentToAnnouncement,
    addReplyToComment,
    deleteComment,
    deleteReply,
    refetchAnnouncements: fetchAnnouncements,
  };
}

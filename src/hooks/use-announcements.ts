
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { useAnnouncementStatus } from '@/contexts/announcement-status-context';
import { useToast } from './use-toast';
import { broadcastAnnouncementUpdate, broadcastNotificationUpdate } from '@/lib/broadcast-channel';


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

    const originalData = [...announcements];
    const optimisticData = optimisticUpdate(originalData);
    setAnnouncements(optimisticData);

    try {
      const response = await fetch('/api/announcements', {
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
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
        throw new Error(errorData.message);
      }
      toast({ title: "Duyuru Eklendi", description: "Duyurunuz başarıyla yayınlandı." });
      await fetchAnnouncements();
      broadcastAnnouncementUpdate();
    } catch (error: any) {
      toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
      setAnnouncements(originalData);
    }
  }, [user, isAdmin, announcements, toast, fetchAnnouncements]);
  
  const deleteAnnouncement = useCallback(async (id: string) => {
    if (!user || !isAdmin) {
      toast({ title: "Yetki Gerekli", description: "Duyuru silmek için yönetici olmalısınız.", variant: "destructive" });
      return;
    }
    
    const optimisticUpdate = (currentData: Announcement[]) => currentData.filter(a => a.id !== id);
    const originalData = [...announcements];
    const optimisticData = optimisticUpdate(originalData);
    setAnnouncements(optimisticData);

    try {
        const apiCall = () => fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });
        const response = await apiCall();
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
            throw new Error(errorData.message);
        }
        toast({ title: "Duyuru Silindi" });
        await fetchAnnouncements();
        broadcastAnnouncementUpdate();
    } catch(error: any) {
        toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
        setAnnouncements(originalData);
    }
  }, [user, isAdmin, announcements, toast, fetchAnnouncements]);

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

    const originalData = [...announcements];
    const optimisticData = optimisticUpdate(originalData);
    setAnnouncements(optimisticData);
    
    try {
        const apiCall = () => fetch('/api/announcements', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ action: "TOGGLE_ANNOUNCEMENT_LIKE", announcementId, userId, userName: userId }) 
        });
        const response = await apiCall();
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
            throw new Error(errorData.message);
        }
        await fetchAnnouncements();
        broadcastAnnouncementUpdate();
    } catch(error: any) {
        toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
        setAnnouncements(originalData);
    }
  }, [user, isAdmin, announcements, toast, fetchAnnouncements]);

  const addCommentToAnnouncement = useCallback(async (announcementId: string, text: string) => {
    if (!user) { throw new Error("Giriş yapmalısınız."); }
    const authorName = `${user.name} ${user.surname}`;
    const authorId = isAdmin ? "ADMIN_ACCOUNT" : authorName;
    
    const optimisticUpdate = (currentData: Announcement[]) => currentData.map(ann => {
      if (ann.id === announcementId) {
        const tempComment: Comment = { id: `cmt_temp_${Date.now()}`, authorName, authorId, text, date: new Date().toISOString(), replies: [] };
        const newComments = (ann.comments ? [tempComment, ...ann.comments] : [tempComment]).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return { ...ann, comments: newComments };
      }
      return ann;
    });

    const originalData = [...announcements];
    const optimisticData = optimisticUpdate(originalData);
    setAnnouncements(optimisticData);

    try {
        const apiCall = () => fetch('/api/announcements', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ action: "ADD_COMMENT_TO_ANNOUNCEMENT", announcementId, comment: { authorName, authorId, text } }) 
        });
        const response = await apiCall();
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
            throw new Error(errorData.message);
        }
        toast({ title: "Yorum Eklendi" });
        await fetchAnnouncements();
        broadcastAnnouncementUpdate();
    } catch(error: any) {
        toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
        setAnnouncements(originalData);
    }
  }, [user, isAdmin, announcements, toast, fetchAnnouncements]);
  
  const addReplyToComment = useCallback(async (announcementId: string, commentId: string, text: string, replyingToAuthorName?: string) => {
    if (!user) { throw new Error("Giriş yapmalısınız."); }
    const authorName = `${user.name} ${user.surname}`;
    const authorId = isAdmin ? "ADMIN_ACCOUNT" : authorName;

    const originalData = [...announcements];
    const tempReply: Reply = { id: `rpl_temp_${Date.now()}`, authorName, authorId, text, date: new Date().toISOString(), replyingToAuthorName };
    
    let originalCommentAuthorId: string | undefined;
    let announcementTitle: string | undefined;

    const optimisticData = originalData.map(ann => {
      if (ann.id === announcementId) {
        announcementTitle = ann.title;
        const newComments = (ann.comments || []).map(c => {
          if (c.id === commentId) {
            originalCommentAuthorId = c.authorId;
            const newReplies = (c.replies ? [tempReply, ...c.replies] : [tempReply]).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return {...c, replies: newReplies};
          }
          return c;
        });
        return {...ann, comments: newComments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())};
      }
      return ann;
    });
    setAnnouncements(optimisticData);

    try {
      // 1. Post the reply
      const replyPayload = { action: "ADD_REPLY_TO_COMMENT", announcementId, commentId, reply: { authorName, authorId, text, replyingToAuthorName } };
      const replyResponse = await fetch('/api/announcements', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(replyPayload) });
      if (!replyResponse.ok) throw new Error((await replyResponse.json()).message || "Yanıt eklenemedi.");
      
      // 2. Post notification if needed
      if (originalCommentAuthorId && announcementTitle && originalCommentAuthorId !== authorId) {
        const notificationPayload = { type: 'reply', recipientUserId: originalCommentAuthorId, senderUserName: authorName, announcementId: announcementId, announcementTitle: announcementTitle, commentId: commentId };
        const notifResponse = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(notificationPayload) });
        if (notifResponse.ok) {
          broadcastNotificationUpdate(); // Notify clients to refetch notifications
        }
      }

      // 3. Show success and re-sync
      toast({ title: "Yanıt Eklendi" });
      await fetchAnnouncements(); 
      broadcastAnnouncementUpdate();

    } catch (error: any) {
        toast({ title: 'Yanıt Eklenemedi', description: error.message, variant: 'destructive' });
        setAnnouncements(originalData); // Rollback on failure
    }
  }, [user, isAdmin, announcements, toast, fetchAnnouncements]);

  const deleteComment = useCallback(async (announcementId: string, commentId: string) => {
    if (!user) { throw new Error("Giriş yapmalısınız."); }
    const deleterAuthorId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;

    const originalData = [...announcements];
    const optimisticData = originalData.map(ann => {
        if (ann.id === announcementId) {
            const commentToDelete = (ann.comments || []).find(c => c.id === commentId);
            if (commentToDelete && commentToDelete.authorId !== deleterAuthorId) {
                toast({ title: "Yetki Hatası", description: "Bu yorumu silme yetkiniz yok.", variant: "destructive" });
                return ann; // Return original ann if not authorized
            }
            return {...ann, comments: (ann.comments || []).filter(c => c.id !== commentId)};
        }
        return ann;
    });

    // Check if optimistic update actually changed anything
    if (JSON.stringify(originalData) === JSON.stringify(optimisticData)) {
      return; // Abort if user was not authorized
    }
    setAnnouncements(optimisticData);

    try {
      const apiCall = () => fetch('/api/announcements', { 
          method: 'POST', 
          headers: {'Content-Type': 'application/json'}, 
          body: JSON.stringify({ action: "DELETE_COMMENT", announcementId, commentId, deleterAuthorId })
      });
      const response = await apiCall();
      if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
          throw new Error(errorData.message);
      }
      toast({ title: "Yorum Silindi" });
      await fetchAnnouncements();
      broadcastAnnouncementUpdate();
    } catch(error: any) {
        toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
        setAnnouncements(originalData);
    }
  }, [user, isAdmin, announcements, toast, fetchAnnouncements]);

  const deleteReply = useCallback(async (announcementId: string, commentId: string, replyId: string) => {
    if (!user) { throw new Error("Giriş yapmalısınız."); }
    const deleterAuthorId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;

    const originalData = [...announcements];
    let wasModified = true;
    const optimisticData = originalData.map(ann => {
        if (ann.id === announcementId) {
            const newComments = (ann.comments || []).map(c => {
                if (c.id === commentId) {
                    const replyToDelete = (c.replies || []).find(r => r.id === replyId);
                     if (replyToDelete && replyToDelete.authorId !== deleterAuthorId) {
                        toast({ title: "Yetki Hatası", description: "Bu yanıtı silme yetkiniz yok.", variant: "destructive" });
                        wasModified = false;
                        return c;
                    }
                    return {...c, replies: (c.replies || []).filter(r => r.id !== replyId)};
                }
                return c;
            });
            if (!wasModified) return ann;
            return {...ann, comments: newComments};
        }
        return ann;
    });
    
    if (!wasModified) {
      return; // Abort if user was not authorized
    }
    setAnnouncements(optimisticData);

    try {
      const apiCall = () => fetch('/api/announcements', { 
          method: 'POST', 
          headers: {'Content-Type': 'application/json'}, 
          body: JSON.stringify({ action: "DELETE_REPLY", announcementId, commentId, replyId, deleterAuthorId })
      });
      const response = await apiCall();
      if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
          throw new Error(errorData.message);
      }
      toast({ title: "Yanıt Silindi" });
      await fetchAnnouncements();
      broadcastAnnouncementUpdate();
    } catch(error: any) {
        toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
        setAnnouncements(originalData);
    }
  }, [user, isAdmin, announcements, toast, fetchAnnouncements]);

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

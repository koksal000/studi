
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { useAnnouncementStatus } from '@/contexts/announcement-status-context';
import { useToast } from './use-toast';
import { STORES, idbGetAll, idbSetAll } from '@/lib/idb';

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

let announcementChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && window.BroadcastChannel) {
  announcementChannel = new BroadcastChannel('announcements-channel');
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAdmin } = useUser();
  const { lastOpenedNotificationTimestamp } = useAnnouncementStatus();
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  const syncWithServer = useCallback(async () => {
    try {
      const response = await fetch('/api/announcements');
      if (!response.ok) throw new Error('Duyurular sunucudan alınamadı.');
      const serverData: Announcement[] = await response.json();
      await idbSetAll(STORES.announcements, serverData);
      announcementChannel?.postMessage('update');
      return serverData;
    } catch (error: any) {
      console.error("[useAnnouncements] Sync with server failed:", error.message);
      return null;
    }
  }, []);

  useEffect(() => {
    const refreshFromIdb = () => {
      idbGetAll<Announcement>(STORES.announcements).then(data => {
        if (data) setAnnouncements(data);
      });
    };
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'update') {
        refreshFromIdb();
      }
    };

    announcementChannel?.addEventListener('message', handleMessage);
    
    setIsLoading(true);
    idbGetAll<Announcement>(STORES.announcements).then((cachedData) => {
      if (cachedData && cachedData.length > 0) {
        setAnnouncements(cachedData);
      }
      syncWithServer(); 
    }).finally(() => setIsLoading(false));

    return () => {
      announcementChannel?.removeEventListener('message', handleMessage);
    };
  }, [syncWithServer]);

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
        toast({ title: "Giriş Gerekli", variant: "destructive" });
        throw new Error("Giriş Gerekli");
    }
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
    const originalData = [...announcements];
    const optimisticData = [newAnnouncementData, ...originalData];
    
    setAnnouncements(optimisticData);
    await idbSetAll(STORES.announcements, optimisticData);
    announcementChannel?.postMessage('update');

    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAnnouncementData),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({message: "Bilinmeyen sunucu hatasi"}));
        throw new Error(error.message);
      }
       toast({ title: "Duyuru Eklendi", description: "Duyurunuz başarıyla yayınlandı."});
       await syncWithServer(); 
    } catch (error: any) {
      toast({ title: 'Duyuru Eklenemedi', description: String(error.message).replace(/[^\x00-\x7F]/g, ""), variant: 'destructive' });
      setAnnouncements(originalData);
      await idbSetAll(STORES.announcements, originalData);
      announcementChannel?.postMessage('update');
      throw error;
    }
  }, [user, isAdmin, announcements, toast, syncWithServer]);

  const deleteAnnouncement = useCallback(async (id: string) => {
    if (!user || !isAdmin) {
      toast({ title: "Yetki Gerekli", variant: "destructive" });
      throw new Error("Yetki Gerekli");
    }
    const originalData = [...announcements];
    const optimisticData = originalData.filter(a => a.id !== id);
    setAnnouncements(optimisticData);
    await idbSetAll(STORES.announcements, optimisticData);
    announcementChannel?.postMessage('update');

    try {
      const response = await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({message: "Bilinmeyen sunucu hatasi"}));
        throw new Error(error.message);
      }
    } catch (error: any) {
      toast({ title: "Duyuru Silinemedi", description: String(error.message).replace(/[^\x00-\x7F]/g, ""), variant: "destructive"});
      setAnnouncements(originalData);
      await idbSetAll(STORES.announcements, originalData);
      announcementChannel?.postMessage('update');
      throw error;
    }
  }, [user, isAdmin, announcements, toast]);

  const toggleAnnouncementLike = useCallback(async (announcementId: string) => {
      if (!user) {
        toast({ title: "Giriş Gerekli", variant: "destructive" });
        return;
      }
      const userId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;
      const originalData = [...announcements];
      const optimisticData = originalData.map(ann => {
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
      setAnnouncements(optimisticData);
      await idbSetAll(STORES.announcements, optimisticData);
      announcementChannel?.postMessage('update');

      try {
          const payload = { action: "TOGGLE_ANNOUNCEMENT_LIKE", announcementId, userId, userName: userId };
          const response = await fetch('/api/announcements', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
          if (!response.ok) {
            const error = await response.json().catch(() => ({message: "Bilinmeyen sunucu hatasi"}));
            throw new Error(error.message);
          }
      } catch (error: any) {
          toast({ title: 'İşlem Başarısız', description: String(error.message).replace(/[^\x00-\x7F]/g, ""), variant: 'destructive' });
          setAnnouncements(originalData);
          await idbSetAll(STORES.announcements, originalData);
          announcementChannel?.postMessage('update');
      }
  }, [user, isAdmin, announcements, toast]);
  
  const addCommentToAnnouncement = useCallback(async (announcementId: string, text: string) => {
    if (!user) { toast({ title: "Giriş Gerekli", variant: "destructive" }); throw new Error("Not logged in"); }
    const authorName = `${user.name} ${user.surname}`;
    const authorId = isAdmin ? "ADMIN_ACCOUNT" : authorName;
    const newCommentData: Omit<Comment, 'id'|'date'> = { authorName, authorId, text, replies: [] };
    const tempCommentId = `cmt_temp_${Date.now()}`;
    
    const originalData = [...announcements];
    const optimisticData = originalData.map(ann => {
        if (ann.id === announcementId) {
            const newComments = ann.comments ? [{ ...newCommentData, id: tempCommentId, date: new Date().toISOString() }, ...ann.comments] : [{ ...newCommentData, id: tempCommentId, date: new Date().toISOString() }];
            return { ...ann, comments: newComments };
        }
        return ann;
    });

    setAnnouncements(optimisticData);
    await idbSetAll(STORES.announcements, optimisticData);
    announcementChannel?.postMessage('update');

    try {
        const payload = { action: "ADD_COMMENT_TO_ANNOUNCEMENT", announcementId, comment: newCommentData };
        const response = await fetch('/api/announcements', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if (!response.ok) {
          const error = await response.json().catch(() => ({message: "Bilinmeyen sunucu hatasi"}));
          throw new Error(error.message);
        }
        await syncWithServer();
    } catch (error: any) {
        toast({ title: 'Yorum Eklenemedi', description: String(error.message).replace(/[^\x00-\x7F]/g, ""), variant: 'destructive' });
        setAnnouncements(originalData);
        await idbSetAll(STORES.announcements, originalData);
        announcementChannel?.postMessage('update');
        throw error;
    }
  }, [user, isAdmin, announcements, toast, syncWithServer]);

  const addReplyToComment = useCallback(async (announcementId: string, commentId: string, text: string, replyingToAuthorName?: string) => {
    if (!user) { toast({ title: "Giriş Gerekli", variant: "destructive" }); throw new Error("Not logged in"); }
    const authorName = `${user.name} ${user.surname}`;
    const authorId = isAdmin ? "ADMIN_ACCOUNT" : authorName;
    const newReplyData: Omit<Reply, 'id'|'date'> = { authorName, authorId, text, replyingToAuthorName, replyingToAuthorId: replyingToAuthorName };
    const tempReplyId = `rpl_temp_${Date.now()}`;

    const originalData = [...announcements];
    const optimisticData = originalData.map(ann => {
      if (ann.id === announcementId) {
        const newComments = (ann.comments || []).map(c => {
          if (c.id === commentId) {
            const newReplies = c.replies ? [{...newReplyData, id: tempReplyId, date: new Date().toISOString()}, ...c.replies] : [{...newReplyData, id: tempReplyId, date: new Date().toISOString()}];
            return {...c, replies: newReplies};
          }
          return c;
        });
        return {...ann, comments: newComments};
      }
      return ann;
    });
    setAnnouncements(optimisticData);
    await idbSetAll(STORES.announcements, optimisticData);
    announcementChannel?.postMessage('update');

    try {
      const payload = { action: "ADD_REPLY_TO_COMMENT", announcementId, commentId, reply: newReplyData };
      const response = await fetch('/api/announcements', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
      if (!response.ok) {
        const error = await response.json().catch(() => ({message: "Bilinmeyen sunucu hatasi"}));
        throw new Error(error.message);
      }
      await syncWithServer();
    } catch (error: any) {
      toast({ title: 'Yanıt Eklenemedi', description: String(error.message).replace(/[^\x00-\x7F]/g, ""), variant: 'destructive' });
      setAnnouncements(originalData);
      await idbSetAll(STORES.announcements, originalData);
      announcementChannel?.postMessage('update');
      throw error;
    }
  }, [user, isAdmin, announcements, toast, syncWithServer]);

  const deleteComment = useCallback(async (announcementId: string, commentId: string) => {
    if (!user) { throw new Error("Giriş gerekli"); }
    const deleterAuthorId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;
    const originalData = [...announcements];
    const optimisticData = originalData.map(ann => {
      if (ann.id === announcementId) {
        const newComments = (ann.comments || []).filter(c => c.id !== commentId);
        return {...ann, comments: newComments};
      }
      return ann;
    });
    setAnnouncements(optimisticData);
    await idbSetAll(STORES.announcements, optimisticData);
    announcementChannel?.postMessage('update');
    
    try {
      const payload = { action: "DELETE_COMMENT", announcementId, commentId, deleterAuthorId };
      const response = await fetch('/api/announcements', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
      if (!response.ok) {
        const error = await response.json().catch(() => ({message: "Bilinmeyen sunucu hatasi"}));
        throw new Error(error.message);
      }
    } catch (error: any) {
      toast({ title: "Yorum Silinemedi", description: String(error.message).replace(/[^\x00-\x7F]/g, ""), variant: "destructive" });
      setAnnouncements(originalData);
      await idbSetAll(STORES.announcements, originalData);
      announcementChannel?.postMessage('update');
      throw error;
    }
  }, [user, isAdmin, announcements, toast]);

  const deleteReply = useCallback(async (announcementId: string, commentId: string, replyId: string) => {
    if (!user) { throw new Error("Giriş gerekli"); }
    const deleterAuthorId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;
    const originalData = [...announcements];
    const optimisticData = originalData.map(ann => {
      if (ann.id === announcementId) {
        const newComments = (ann.comments || []).map(c => {
          if (c.id === commentId) {
            const newReplies = (c.replies || []).filter(r => r.id !== replyId);
            return {...c, replies: newReplies};
          }
          return c;
        });
        return {...ann, comments: newComments};
      }
      return ann;
    });
    setAnnouncements(optimisticData);
    await idbSetAll(STORES.announcements, optimisticData);
    announcementChannel?.postMessage('update');

    try {
      const payload = { action: "DELETE_REPLY", announcementId, commentId, replyId, deleterAuthorId };
      const response = await fetch('/api/announcements', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
       if (!response.ok) {
        const error = await response.json().catch(() => ({message: "Bilinmeyen sunucu hatasi"}));
        throw new Error(error.message);
      }
    } catch (error: any) {
      toast({ title: "Yanıt Silinemedi", description: String(error.message).replace(/[^\x00-\x7F]/g, ""), variant: "destructive" });
      setAnnouncements(originalData);
      await idbSetAll(STORES.announcements, originalData);
      announcementChannel?.postMessage('update');
      throw error;
    }
  }, [user, isAdmin, announcements, toast]);

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
  };
}

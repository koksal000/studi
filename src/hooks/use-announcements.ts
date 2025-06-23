
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

  const addAnnouncement = useCallback(async (payload: NewAnnouncementPayload) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Duyuru eklemek için giriş yapmalısınız.", variant: "destructive" });
      throw new Error("User not logged in");
    }
    // Optimistic UI update
    const tempId = `ann_temp_${Date.now()}`;
    const newAnnouncement: Announcement = {
      ...payload,
      id: tempId,
      date: new Date().toISOString(),
      author: isAdmin ? "Yönetim Hesabı" : `${user.name} ${user.surname}`,
      authorId: isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`,
      likes: [],
      comments: [],
    };
    const originalAnnouncements = announcements;
    setAnnouncements(prev => [newAnnouncement, ...prev]);

    try {
        const response = await fetch('/api/announcements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newAnnouncement, id: `ann_${Date.now()}` })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Duyuru sunucuya kaydedilemedi.' }));
            throw new Error(errorData.message);
        }
        toast({ title: "Duyuru Eklendi", description: "Duyurunuz başarıyla yayınlandı." });
        // Refetch to get the final server-confirmed data including the real ID
        await fetchAnnouncements();
        broadcastAnnouncementUpdate();
    } catch (error: any) {
        toast({ title: 'Duyuru Eklenemedi', description: error.message, variant: 'destructive' });
        setAnnouncements(originalAnnouncements); // Revert on failure
    }
  }, [user, isAdmin, announcements, toast, fetchAnnouncements]);
  
  const deleteAnnouncement = useCallback(async (id: string) => {
    if (!user || !isAdmin) {
      toast({ title: "Yetki Gerekli", description: "Duyuru silmek için yönetici olmalısınız.", variant: "destructive" });
      throw new Error("Admin privileges required");
    }
    
    const originalAnnouncements = announcements;
    const optimisticAnnouncements = originalAnnouncements.filter(a => a.id !== id);
    setAnnouncements(optimisticAnnouncements);
    broadcastAnnouncementUpdate();

    try {
      const response = await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Duyuru silinemedi."}));
        throw new Error(errorData.message);
      }
      toast({ title: "Duyuru Silindi", description: `Duyuru başarıyla silindi.` });
    } catch (error: any) {
      toast({ title: "Silme Başarısız", description: error.message, variant: "destructive"});
      setAnnouncements(originalAnnouncements);
      broadcastAnnouncementUpdate();
    }
  }, [user, isAdmin, announcements, toast]);

  const toggleAnnouncementLike = useCallback(async (announcementId: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Beğeni yapmak için giriş yapmalısınız.", variant: "destructive"});
      return;
    }
    const userId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;
    const originalAnnouncements = announcements;

    const optimisticAnnouncements = originalAnnouncements.map(ann => {
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
    setAnnouncements(optimisticAnnouncements);
    
    try {
      const payload = { action: "TOGGLE_ANNOUNCEMENT_LIKE", announcementId, userId, userName: userId };
      const response = await fetch('/api/announcements', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Beğeni işlemi kaydedilemedi."}));
        throw new Error(errorData.message);
      }
    } catch (error: any) {
      toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
      setAnnouncements(originalAnnouncements);
    }
  }, [user, isAdmin, announcements, toast]);

  const addCommentToAnnouncement = useCallback(async (announcementId: string, text: string) => {
    if (!user) { throw new Error("Not logged in"); }
    const authorName = `${user.name} ${user.surname}`;
    const authorId = isAdmin ? "ADMIN_ACCOUNT" : authorName;
    const tempComment: Comment = { id: `cmt_temp_${Date.now()}`, authorName, authorId, text, date: new Date().toISOString(), replies: [] };
    
    const originalData = announcements;
    const optimisticData = originalData.map(ann => {
      if (ann.id === announcementId) {
        const newComments = ann.comments ? [tempComment, ...ann.comments] : [tempComment];
        return { ...ann, comments: newComments };
      }
      return ann;
    });
    setAnnouncements(optimisticData);

    try {
        const payload = { action: "ADD_COMMENT_TO_ANNOUNCEMENT", announcementId, comment: { authorName, authorId, text } };
        const response = await fetch('/api/announcements', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error((await response.json()).message || "Yorum eklenemedi.");
        await fetchAnnouncements(); // Re-sync with server to get real IDs
    } catch (error: any) {
        toast({ title: 'Yorum Eklenemedi', description: error.message, variant: 'destructive' });
        setAnnouncements(originalData);
    }
  }, [user, isAdmin, announcements, toast, fetchAnnouncements]);
  
  const addReplyToComment = useCallback(async (announcementId: string, commentId: string, text: string, replyingToAuthorName?: string) => {
    if (!user) { throw new Error("Not logged in"); }
    const authorName = `${user.name} ${user.surname}`;
    const authorId = isAdmin ? "ADMIN_ACCOUNT" : authorName;
    const tempReply: Reply = { id: `rpl_temp_${Date.now()}`, authorName, authorId, text, date: new Date().toISOString(), replyingToAuthorName };
    
    const originalData = announcements;
    const optimisticData = originalData.map(ann => {
      if (ann.id === announcementId) {
        const newComments = (ann.comments || []).map(c => {
          if (c.id === commentId) {
            const newReplies = c.replies ? [tempReply, ...c.replies] : [tempReply];
            return {...c, replies: newReplies};
          }
          return c;
        });
        return {...ann, comments: newComments};
      }
      return ann;
    });
    setAnnouncements(optimisticData);

    try {
      const payload = { action: "ADD_REPLY_TO_COMMENT", announcementId, commentId, reply: { authorName, authorId, text, replyingToAuthorName, replyingToAuthorId: replyingToAuthorName } };
      const response = await fetch('/api/announcements', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error((await response.json()).message || "Yanıt eklenemedi.");
      await fetchAnnouncements(); // Re-sync
    } catch (error: any) {
      toast({ title: 'Yanıt Eklenemedi', description: error.message, variant: 'destructive' });
      setAnnouncements(originalData);
    }
  }, [user, isAdmin, announcements, toast, fetchAnnouncements]);

  const deleteComment = useCallback(async (announcementId: string, commentId: string) => {
    if (!user) { throw new Error("User not logged in"); }
    const originalData = announcements;
    const optimisticData = originalData.map(ann => {
      if (ann.id === announcementId) {
        return {...ann, comments: (ann.comments || []).filter(c => c.id !== commentId)};
      }
      return ann;
    });
    setAnnouncements(optimisticData);

    try {
      const payload = { action: "DELETE_COMMENT", announcementId, commentId, deleterAuthorId: isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}` };
      const response = await fetch('/api/announcements', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error((await response.json()).message || "Yorum silinemedi.");
      toast({ title: "Yorum Silindi", description: "Yorumunuz başarıyla kaldırıldı."});
    } catch (error: any) {
      toast({ title: "Yorum Silinemedi", description: error.message, variant: "destructive" });
      setAnnouncements(originalData);
    }
  }, [user, isAdmin, announcements, toast]);

  const deleteReply = useCallback(async (announcementId: string, commentId: string, replyId: string) => {
    if (!user) { throw new Error("User not logged in"); }
    const originalData = announcements;
    const optimisticData = originalData.map(ann => {
      if (ann.id === announcementId) {
        const newComments = (ann.comments || []).map(c => {
          if (c.id === commentId) {
            return {...c, replies: (c.replies || []).filter(r => r.id !== replyId)};
          }
          return c;
        });
        return {...ann, comments: newComments};
      }
      return ann;
    });
    setAnnouncements(optimisticData);

    try {
      const payload = { action: "DELETE_REPLY", announcementId, commentId, replyId, deleterAuthorId: isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}` };
      const response = await fetch('/api/announcements', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error((await response.json()).message || "Yanıt silinemedi.");
      toast({ title: "Yanıt Silindi", description: "Yanıtınız başarıyla kaldırıldı." });
    } catch (error: any) {
      toast({ title: "Yanıt Silinemedi", description: error.message, variant: "destructive" });
      setAnnouncements(originalData);
    }
  }, [user, isAdmin, announcements, toast]);

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

    
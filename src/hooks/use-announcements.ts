
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { useAnnouncementStatus } from '@/contexts/announcement-status-context';
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
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAdmin } = useUser();
  const { lastOpenedNotificationTimestamp } = useAnnouncementStatus();
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  const fetchAnnouncements = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/announcements');
      if (!response.ok) {
        throw new Error('Duyurular sunucudan alınamadı.');
      }
      const data: Announcement[] = await response.json();
      setAnnouncements(data);
    } catch (error: any) {
      toast({ title: 'Veri Yükleme Hatası', description: error.message, variant: 'destructive' });
      setAnnouncements([]); // Set to empty array on error to avoid broken state
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  useEffect(() => {
    if (announcements.length > 0 && lastOpenedNotificationTimestamp) {
      const newUnreadCount = announcements.filter(
        (ann) => new Date(ann.date).getTime() > lastOpenedNotificationTimestamp
      ).length;
      setUnreadCount(newUnreadCount);
    } else if (announcements.length > 0) {
      setUnreadCount(announcements.length);
    } else {
      setUnreadCount(0);
    }
  }, [announcements, lastOpenedNotificationTimestamp]);
  
  const performApiAction = useCallback(async (
    endpoint: string, 
    method: 'POST' | 'DELETE', 
    body?: any,
    successToast?: { title: string; description?: string }
  ): Promise<boolean> => {
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
        throw new Error(errorData.message);
      }
      
      if (successToast) {
        toast(successToast);
      }

      await fetchAnnouncements(); 
      return true;

    } catch (error: any) {
      toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
      console.error(`[useAnnouncements] API Action Failed:`, error);
      return false;
    }
  }, [toast, fetchAnnouncements]);


  const addAnnouncement = useCallback(async (payload: NewAnnouncementPayload) => {
    if (!user) {
        toast({ title: "Giriş Gerekli", variant: "destructive" });
        return;
    }
     if (!payload.title?.trim() || !payload.content?.trim()) {
        toast({ title: 'Eksik Bilgi', description: 'Lütfen başlık ve içerik alanlarını doldurun.', variant: 'destructive' });
        return;
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

    await performApiAction('/api/announcements', 'POST', newAnnouncementData, { title: "Duyuru Eklendi", description: `"${newAnnouncementData.title}" başarıyla yayınlandı.` });
  }, [user, isAdmin, performApiAction, toast]);


  const deleteAnnouncement = useCallback(async (id: string) => {
    if (!user || !isAdmin) { 
        toast({ title: "Yetki Gerekli", description: "Duyuru silmek için yönetici olmalısınız.", variant: "destructive"});
        return;
    }
    await performApiAction(`/api/announcements?id=${id}`, 'DELETE');
  }, [user, isAdmin, performApiAction]);

  const toggleAnnouncementLike = useCallback(async (announcementId: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Beğeni yapmak için giriş yapmalısınız.", variant: "destructive"});
      return;
    }
    const userId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;
    const payload: ToggleAnnouncementLikePayload = { action: "TOGGLE_ANNOUNCEMENT_LIKE", announcementId, userId, userName: userId };
    await performApiAction('/api/announcements', 'POST', payload);
  }, [user, isAdmin, performApiAction, toast]);

  const addCommentToAnnouncement = useCallback(async (announcementId: string, text: string) => {
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
    const commentPayload: AddCommentPayload = { action: "ADD_COMMENT_TO_ANNOUNCEMENT", announcementId, comment: { authorName, authorId, text } };
    await performApiAction('/api/announcements', 'POST', commentPayload, { title: "Yorum Eklendi", description: "Yorumunuz başarıyla gönderildi." });
  }, [user, isAdmin, performApiAction, toast]);

  const addReplyToComment = useCallback(async (announcementId: string, commentId: string, text: string, replyingToAuthorName?: string) => {
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
    const replyPayload: AddReplyPayload = { action: "ADD_REPLY_TO_COMMENT", announcementId, commentId, reply: { authorName, authorId, text, replyingToAuthorName, replyingToAuthorId: replyingToAuthorName } };
    await performApiAction('/api/announcements', 'POST', replyPayload, { title: "Yanıt Eklendi", description: "Yanıtınız başarıyla gönderildi." });
  }, [user, isAdmin, performApiAction, toast]);

  const deleteComment = useCallback(async (announcementId: string, commentId: string) => {
    if (!user) { throw new Error("User not logged in"); }
    const deleterAuthorId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;
    const payload: DeleteCommentPayload = { action: "DELETE_COMMENT", announcementId, commentId, deleterAuthorId };
    await performApiAction('/api/announcements', 'POST', payload);
  }, [user, isAdmin, performApiAction]);

  const deleteReply = useCallback(async (announcementId: string, commentId: string, replyId: string) => {
    if (!user) { throw new Error("User not logged in"); }
    const deleterAuthorId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;
    const payload: DeleteReplyPayload = { action: "DELETE_REPLY", announcementId, commentId, replyId, deleterAuthorId };
    await performApiAction('/api/announcements', 'POST', payload);
  }, [user, isAdmin, performApiAction]);


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

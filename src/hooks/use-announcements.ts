
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAdmin } = useUser();
  const { lastOpenedNotificationTimestamp } = useAnnouncementStatus();
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();
  const isSyncing = useRef(false);

  const syncWithServer = useCallback(async () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    
    try {
      const response = await fetch('/api/announcements');
      if (!response.ok) throw new Error('Duyurular sunucudan alınamadı.');
      const serverData: Announcement[] = await response.json();
      setAnnouncements(serverData);
      await idbSetAll(STORES.announcements, serverData);
    } catch (error: any) {
      toast({ title: 'Veri Senkronizasyon Hatası', description: error.message, variant: 'destructive' });
    } finally {
      isSyncing.current = false;
    }
  }, [toast]);
  
  useEffect(() => {
    const loadFromCacheAndSync = async () => {
      setIsLoading(true);
      const cachedData = await idbGetAll<Announcement>(STORES.announcements);
      if (cachedData && cachedData.length > 0) {
        setAnnouncements(cachedData);
      }
      setIsLoading(false);
      await syncWithServer();
    };

    loadFromCacheAndSync();
  }, [syncWithServer]);

  useEffect(() => {
    if (announcements.length > 0 && lastOpenedNotificationTimestamp) {
        setUnreadCount(announcements.filter(ann => new Date(ann.date).getTime() > lastOpenedNotificationTimestamp).length);
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
  ) => {
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
      
      if (successToast) toast(successToast);
      await syncWithServer();
    } catch (error: any) {
      const rawErrorMessage = error.message || 'Bilinmeyen bir ağ hatası oluştu.';
      toast({ title: 'İşlem Başarısız', description: rawErrorMessage, variant: 'destructive' });
      throw new Error(String(rawErrorMessage).replace(/[^\x00-\x7F]/g, ""));
    }
  }, [toast, syncWithServer]);

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
    const payload = { action: "TOGGLE_ANNOUNCEMENT_LIKE", announcementId, userId, userName: userId };
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
    const commentPayload = { action: "ADD_COMMENT_TO_ANNOUNCEMENT", announcementId, comment: { authorName, authorId, text } };
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
    const replyPayload = { action: "ADD_REPLY_TO_COMMENT", announcementId, commentId, reply: { authorName, authorId, text, replyingToAuthorName, replyingToAuthorId: replyingToAuthorName } };
    await performApiAction('/api/announcements', 'POST', replyPayload, { title: "Yanıt Eklendi", description: "Yanıtınız başarıyla gönderildi." });
  }, [user, isAdmin, performApiAction, toast]);

  const deleteComment = useCallback(async (announcementId: string, commentId: string) => {
    if (!user) { throw new Error("User not logged in"); }
    const deleterAuthorId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;
    const payload = { action: "DELETE_COMMENT", announcementId, commentId, deleterAuthorId };
    await performApiAction('/api/announcements', 'POST', payload);
  }, [user, isAdmin, performApiAction]);

  const deleteReply = useCallback(async (announcementId: string, commentId: string, replyId: string) => {
    if (!user) { throw new Error("User not logged in"); }
    const deleterAuthorId = isAdmin ? "ADMIN_ACCOUNT" : `${user.name} ${user.surname}`;
    const payload = { action: "DELETE_REPLY", announcementId, commentId, replyId, deleterAuthorId };
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

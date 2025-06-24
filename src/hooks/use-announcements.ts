
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

export interface EditAnnouncementPayload extends NewAnnouncementPayload {}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAdmin } = useUser();
  const { lastOpenedNotificationTimestamp } = useAnnouncementStatus();
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  const fetchAnnouncements = useCallback(async () => {
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
    if (!user || !user.email) {
      toast({ title: "Giriş Gerekli", description: "Duyuru eklemek için giriş yapmalısınız.", variant: "destructive" });
      return;
    }

    const tempId = `ann_temp_${Date.now()}`;
    const newAnnouncement: Announcement = {
        ...payload,
        id: tempId,
        date: new Date().toISOString(),
        author: isAdmin ? "Yönetim Hesabı" : `${user.name} ${user.surname}`,
        authorId: isAdmin ? "ADMIN_ACCOUNT" : user.email,
        likes: [],
        comments: [],
    };
    
    setAnnouncements(currentData => [newAnnouncement, ...currentData]);

    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...payload,
          id: `ann_${Date.now()}`,
          date: new Date().toISOString(),
          author: isAdmin ? "Yönetim Hesabı" : `${user.name} ${user.surname}`,
          authorId: isAdmin ? "ADMIN_ACCOUNT" : user.email,
          likes: [],
          comments: [],
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
        throw new Error(errorData.message);
      }
      
      const finalAnnouncement: Announcement = await response.json();
      setAnnouncements(currentData => currentData.map(ann => ann.id === tempId ? finalAnnouncement : ann));
      
      toast({ title: "Duyuru Eklendi", description: "Duyurunuz başarıyla yayınlandı." });
      broadcastAnnouncementUpdate();

    } catch (error: any) {
      toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
      setAnnouncements(currentData => currentData.filter(a => a.id !== tempId));
    }
  }, [user, isAdmin, toast]);
  
  const editAnnouncement = useCallback(async (announcementId: string, payload: EditAnnouncementPayload) => {
    if (!user || !isAdmin) {
      toast({ title: 'Yetki Gerekli', description: 'Duyuru düzenlemek için yönetici olmalısınız.', variant: 'destructive' });
      throw new Error('Admin privileges required.');
    }

    const originalAnnouncements = [...announcements];
    let originalAnnouncement: Announcement | undefined;

    const optimisticData = originalAnnouncements.map(ann => {
      if (ann.id === announcementId) {
        originalAnnouncement = { ...ann };
        return {
          ...ann,
          title: payload.title,
          content: payload.content,
          media: payload.media,
          mediaType: payload.mediaType,
        };
      }
      return ann;
    });

    setAnnouncements(optimisticData);

    try {
      if (!originalAnnouncement) {
          throw new Error("Düzenlenecek duyuru bulunamadı.");
      }
        
      const announcementToUpdate: Announcement = {
          ...originalAnnouncement,
          title: payload.title,
          content: payload.content,
          media: payload.media,
          mediaType: payload.mediaType,
      };

      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(announcementToUpdate),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Duyuru güncellenirken sunucu hatası oluştu.' }));
        throw new Error(errorData.message);
      }
      
      const finalAnnouncement: Announcement = await response.json();
      
      setAnnouncements(current => current.map(ann => ann.id === announcementId ? finalAnnouncement : ann));
      toast({ title: 'Duyuru Güncellendi', description: 'Değişiklikler başarıyla kaydedildi.' });
      broadcastAnnouncementUpdate();

    } catch (error: any) {
      toast({ title: 'Güncelleme Başarısız', description: error.message, variant: 'destructive' });
      setAnnouncements(originalAnnouncements);
      throw error;
    }
  }, [user, isAdmin, announcements, toast]);

  const deleteAnnouncement = useCallback(async (id: string) => {
    if (!user || !isAdmin) {
      toast({ title: "Yetki Gerekli", description: "Duyuru silmek için yönetici olmalısınız.", variant: "destructive" });
      throw new Error("Admin privileges required.");
    }
    
    const originalData = [...announcements];
    const optimisticData = originalData.filter(a => a.id !== id);
    setAnnouncements(optimisticData);

    try {
        const response = await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
            throw new Error(errorData.message);
        }
        toast({ title: "Duyuru Silindi" });
        broadcastAnnouncementUpdate();
    } catch(error: any) {
        toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
        setAnnouncements(originalData);
    }
  }, [user, isAdmin, announcements, toast]);

  const updateAnnouncementInState = (updatedAnnouncement: Announcement) => {
    setAnnouncements(currentAnnouncements => 
        currentAnnouncements.map(ann => 
            ann.id === updatedAnnouncement.id ? updatedAnnouncement : ann
        )
    );
  };

  const toggleAnnouncementLike = useCallback(async (announcementId: string) => {
    if (!user || !user.email) {
      toast({ title: "Giriş Gerekli", description: "Beğeni yapmak için giriş yapmalısınız.", variant: "destructive"});
      return;
    }
    const userId = isAdmin ? "ADMIN_ACCOUNT" : user.email;
    
    const originalData = [...announcements];
    const optimisticData = announcements.map(ann => {
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
    
    try {
        const response = await fetch('/api/announcements', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ action: "TOGGLE_ANNOUNCEMENT_LIKE", announcementId, userId, userName: `${user.name} ${user.surname}` }) 
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
            throw new Error(errorData.message);
        }
        const updatedAnnouncement = await response.json();
        updateAnnouncementInState(updatedAnnouncement);
        broadcastAnnouncementUpdate();
    } catch(error: any) {
        toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
        setAnnouncements(originalData);
    }
  }, [user, isAdmin, announcements, toast]);

  const addCommentToAnnouncement = useCallback(async (announcementId: string, text: string) => {
    if (!user || !user.email) { throw new Error("Giriş yapmalısınız."); }
    const authorName = `${user.name} ${user.surname}`;
    const authorId = isAdmin ? "ADMIN_ACCOUNT" : user.email;
    const tempCommentId = `cmt_temp_${Date.now()}`;
    const tempComment: Comment = { id: tempCommentId, authorName, authorId, text, date: new Date().toISOString(), replies: [] };
    
    const originalData = [...announcements];
    const optimisticData = originalData.map(ann => {
      if (ann.id === announcementId) {
        const newComments = (ann.comments ? [tempComment, ...ann.comments] : [tempComment]).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return { ...ann, comments: newComments };
      }
      return ann;
    });
    setAnnouncements(optimisticData);

    try {
        const response = await fetch('/api/announcements', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ action: "ADD_COMMENT_TO_ANNOUNCEMENT", announcementId, comment: { authorName, authorId, text } }) 
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
            throw new Error(errorData.message);
        }
        const updatedAnnouncement = await response.json();
        updateAnnouncementInState(updatedAnnouncement);
        toast({ title: "Yorum Eklendi" });
        broadcastAnnouncementUpdate();
    } catch(error: any) {
        toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
        setAnnouncements(originalData);
    }
  }, [user, isAdmin, announcements, toast]);
  
  const addReplyToComment = useCallback(async (announcementId: string, commentId: string, text: string, replyingToAuthorName?: string, replyingToAuthorId?: string) => {
    if (!user || !user.email) { throw new Error("Giriş yapmalısınız."); }
    const authorName = `${user.name} ${user.surname}`;
    const authorId = isAdmin ? "ADMIN_ACCOUNT" : user.email;

    const originalData = [...announcements];
    const tempReplyId = `rpl_temp_${Date.now()}`;
    const tempReply: Reply = { id: tempReplyId, authorName, authorId, text, date: new Date().toISOString(), replyingToAuthorName, replyingToAuthorId };
    
    let announcementTitle: string | undefined;

    const optimisticData = originalData.map(ann => {
      if (ann.id === announcementId) {
        announcementTitle = ann.title;
        const newComments = (ann.comments || []).map(c => {
          if (c.id === commentId) {
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
      const replyResponse = await fetch('/api/announcements', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ action: "ADD_REPLY_TO_COMMENT", announcementId, commentId, reply: { authorName, authorId, text, replyingToAuthorName, replyingToAuthorId } }) 
      });
      if (!replyResponse.ok) throw new Error((await replyResponse.json()).message || "Yanıt eklenemedi.");
      const updatedAnnouncement = await replyResponse.json();
      
      // Send notification ONLY if replying to someone else.
      if (replyingToAuthorId && announcementTitle && replyingToAuthorId !== authorId) {
        const notificationPayload = { type: 'reply', recipientUserId: replyingToAuthorId, senderUserName: authorName, announcementId: announcementId, announcementTitle: announcementTitle, commentId: commentId };
        const notifResponse = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(notificationPayload) });
        if (notifResponse.ok) {
          broadcastNotificationUpdate();
        }
      }
      
      updateAnnouncementInState(updatedAnnouncement);
      toast({ title: "Yanıt Eklendi" });
      broadcastAnnouncementUpdate();

    } catch (error: any) {
        toast({ title: 'Yanıt Eklenemedi', description: error.message, variant: 'destructive' });
        setAnnouncements(originalData);
    }
  }, [user, isAdmin, announcements, toast]);

  const deleteComment = useCallback(async (announcementId: string, commentId: string) => {
    if (!user || !user.email) { throw new Error("Giriş yapmalısınız."); }
    const deleterAuthorId = isAdmin ? "ADMIN_ACCOUNT" : user.email;

    const originalData = [...announcements];
    const optimisticData = originalData.map(ann => {
        if (ann.id === announcementId) {
            return {...ann, comments: (ann.comments || []).filter(c => c.id !== commentId)};
        }
        return ann;
    });
    setAnnouncements(optimisticData);

    try {
        const response = await fetch('/api/announcements', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ action: "DELETE_COMMENT", announcementId, commentId, deleterAuthorId })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
            throw new Error(errorData.message);
        }
        const updatedAnnouncement = await response.json();
        updateAnnouncementInState(updatedAnnouncement);
        toast({ title: "Yorum Silindi" });
        broadcastAnnouncementUpdate();
    } catch(error: any) {
        toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
        setAnnouncements(originalData);
    }
  }, [user, isAdmin, announcements, toast]);

  const deleteReply = useCallback(async (announcementId: string, commentId: string, replyId: string) => {
    if (!user || !user.email) { throw new Error("Giriş yapmalısınız."); }
    const deleterAuthorId = isAdmin ? "ADMIN_ACCOUNT" : user.email;

    const originalData = [...announcements];
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
      const response = await fetch('/api/announcements', { 
          method: 'POST', 
          headers: {'Content-Type': 'application/json'}, 
          body: JSON.stringify({ action: "DELETE_REPLY", announcementId, commentId, replyId, deleterAuthorId })
      });
      if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
          throw new Error(errorData.message);
      }
      const updatedAnnouncement = await response.json();
      updateAnnouncementInState(updatedAnnouncement);
      toast({ title: "Yanıt Silindi" });
      broadcastAnnouncementUpdate();
    } catch(error: any) {
        toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
        setAnnouncements(originalData);
    }
  }, [user, isAdmin, announcements, toast]);

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
    editAnnouncement,
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

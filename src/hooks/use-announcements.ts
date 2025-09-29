
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { useAnnouncementStatus } from '@/contexts/announcement-status-context';
import { useToast } from './use-toast';
import { broadcastAnnouncementUpdate, broadcastNotificationUpdate } from '@/lib/broadcast-channel';
import { getAnnouncementsFromDB, cacheAnnouncementsToDB } from '@/lib/idb';


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
  isPinned?: boolean;
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
    setIsLoading(true);
    try {
      const response = await fetch('/api/announcements');
      if (!response.ok) {
        throw new Error('Sunucuya ulaşılamadı. Çevrimdışı veriler gösteriliyor.');
      }
      const data: Announcement[] = await response.json();

      // Sunucudan veri geldiyse (boş olsa bile) bunu "doğrunun kaynağı" olarak kabul et.
      if (data) {
        setAnnouncements(data);
        await cacheAnnouncementsToDB(data); // Önbelleği de boş veriyle güncelle
      } else {
        // Bu durum genellikle API'nin tamamen bozuk olduğu anlamına gelir.
        throw new Error('Sunucudan geçersiz veri alındı. Çevrimdışı veriler deneniyor.');
      }
    } catch (error: any) {
        toast({ title: 'Sunucu Hatası', description: error.message, variant: 'destructive', duration: 5000 });
        console.warn("[useAnnouncements] API fetch failed, falling back to IndexedDB.");
        const dbData = await getAnnouncementsFromDB();
        if (dbData && dbData.length > 0) {
            setAnnouncements(dbData);
            toast({ title: 'Çevrimdışı Mod', description: 'İnternet bağlantısı yok veya sunucu yanıt vermiyor. En son kaydedilen veriler gösteriliyor.', duration: 5000 });
        }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);


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
    const newAnnouncementData = {
        ...payload,
        id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        date: new Date().toISOString(),
        author: isAdmin ? "Yönetim Hesabı" : `${user.name} ${user.surname}`,
        authorId: isAdmin ? "ADMIN_ACCOUNT" : user.email,
        likes: [],
        comments: [],
        isPinned: false,
    };
    
    setAnnouncements(currentData => [
        {...newAnnouncementData, id: tempId}, 
        ...currentData
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAnnouncementData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
        throw new Error(errorData.message);
      }
      
      const finalAnnouncement: Announcement = await response.json();
      const updatedAnnouncements = announcements.map(ann => ann.id === tempId ? finalAnnouncement : ann);
      setAnnouncements(updatedAnnouncements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      await cacheAnnouncementsToDB(updatedAnnouncements);
      
      toast({ title: "Duyuru Eklendi", description: "Duyurunuz başarıyla yayınlandı." });
      broadcastAnnouncementUpdate();

    } catch (error: any) {
      toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
      setAnnouncements(currentData => currentData.filter(a => a.id !== tempId));
    }
  }, [user, isAdmin, toast, announcements]);
  
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
      
      const finalAnnouncements = optimisticData.map(ann => ann.id === announcementId ? finalAnnouncement : ann)
      setAnnouncements(finalAnnouncements);
      await cacheAnnouncementsToDB(finalAnnouncements);

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
        await cacheAnnouncementsToDB(optimisticData);
        toast({ title: "Duyuru Silindi" });
        broadcastAnnouncementUpdate();
    } catch(error: any) {
        toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
        setAnnouncements(originalData);
    }
  }, [user, isAdmin, announcements, toast]);

  const updateAnnouncementInState = async (updatedAnnouncement: Announcement) => {
    const newAnnouncements = announcements.map(ann => 
        ann.id === updatedAnnouncement.id ? updatedAnnouncement : ann
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setAnnouncements(newAnnouncements);
    await cacheAnnouncementsToDB(newAnnouncements);
  };

  const toggleAnnouncementLike = useCallback(async (announcementId: string) => {
    if (!user || !user.email) {
      toast({ title: "Giriş Gerekli", description: "Beğeni yapmak için giriş yapmalısınız.", variant: "destructive"});
      return;
    }
    const userId = isAdmin ? "ADMIN_ACCOUNT" : user.email;
    
    // Optimistic update
    const originalAnnouncements = [...announcements];
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
        await updateAnnouncementInState(updatedAnnouncement);
        broadcastAnnouncementUpdate();
    } catch(error: any) {
        toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
        setAnnouncements(originalAnnouncements);
    }
  }, [user, isAdmin, toast, announcements]);

  const togglePinAnnouncement = useCallback(async (announcementId: string) => {
    if (!user || !isAdmin) {
      toast({ title: "Yetki Gerekli", description: "Duyuru sabitlemek için yönetici olmalısınız.", variant: "destructive" });
      return;
    }

    const currentAnnouncement = announcements.find(a => a.id === announcementId);
    if (!currentAnnouncement) return;

    if (!currentAnnouncement.isPinned) {
        const pinnedCount = announcements.filter(a => a.isPinned).length;
        if (pinnedCount >= 5) {
            toast({ title: "Limit Dolu", description: "Maksimum 5 duyuru sabitleyebilirsiniz. Yeni bir tane sabitlemek için mevcut sabitlenmiş bir duyuruyu kaldırın.", variant: "destructive", duration: 7000 });
            return;
        }
    }

    const originalAnnouncements = [...announcements];
    const optimisticAnnouncements = originalAnnouncements.map(ann => {
        if (ann.id === announcementId) {
            return { ...ann, isPinned: !ann.isPinned };
        }
        return ann;
    });
    setAnnouncements(optimisticAnnouncements);

    try {
        const response = await fetch('/api/announcements', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: "TOGGLE_PIN_ANNOUNCEMENT", announcementId })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'İşlem sunucuya kaydedilemedi.' }));
            throw new Error(errorData.message);
        }

        const updatedAnnouncement = await response.json();
        await updateAnnouncementInState(updatedAnnouncement);
        toast({ title: "İşlem Başarılı", description: `Duyuru ${updatedAnnouncement.isPinned ? 'sabitlendi' : 'sabitlemesi kaldırıldı'}.` });
        broadcastAnnouncementUpdate();
    } catch (error: any) {
        toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
        setAnnouncements(originalAnnouncements);
    }
  }, [user, isAdmin, announcements, toast]);

  const addCommentToAnnouncement = useCallback(async (announcementId: string, text: string) => {
    if (!user || !user.email) { throw new Error("Giriş yapmalısınız."); }
    const authorName = isAdmin ? "Yönetim Hesabı" : `${user.name} ${user.surname}`;
    const authorId = isAdmin ? "ADMIN_ACCOUNT" : user.email;
    const tempCommentId = `cmt_temp_${Date.now()}`;
    const tempComment: Comment = { id: tempCommentId, authorName, authorId, text, date: new Date().toISOString(), replies: [] };
    
    const originalAnnouncements = [...announcements];
    const optimisticData = originalAnnouncements.map(ann => {
        if (ann.id === announcementId) {
            const newComments = (ann.comments ? [tempComment, ...ann.comments] : [tempComment]);
            return { ...ann, comments: newComments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())};
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
        await updateAnnouncementInState(updatedAnnouncement);
        toast({ title: "Yorum Eklendi", description: "Yorumunuzun görünmesi birkaç saniye sürebilir." });
        broadcastAnnouncementUpdate();
    } catch(error: any) {
        toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
        setAnnouncements(originalAnnouncements);
    }
  }, [user, isAdmin, toast, announcements]);
  
  const addReplyToComment = useCallback(async (announcementId: string, commentId: string, text: string, replyingToAuthorName?: string, replyingToAuthorId?: string) => {
    if (!user || !user.email) { throw new Error("Giriş yapmalısınız."); }
    const authorName = isAdmin ? "Yönetim Hesabı" : `${user.name} ${user.surname}`;
    const authorId = isAdmin ? "ADMIN_ACCOUNT" : user.email;

    const tempReplyId = `rpl_temp_${Date.now()}`;
    const tempReply: Reply = { id: tempReplyId, authorName, authorId, text, date: new Date().toISOString(), replyingToAuthorName, replyingToAuthorId };
    
    const originalAnnouncements = [...announcements];
    const optimisticData = originalAnnouncements.map(ann => {
        if (ann.id === announcementId) {
            const newComments = (ann.comments || []).map(c => {
                if (c.id === commentId) {
                    const newReplies = (c.replies ? [tempReply, ...c.replies] : [tempReply]);
                    return {...c, replies: newReplies.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())};
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
      await updateAnnouncementInState(updatedAnnouncement);
      toast({ title: "Yanıt Eklendi", description: "Yanıtınızın görünmesi birkaç saniye sürebilir." });
      broadcastAnnouncementUpdate();
      broadcastNotificationUpdate();

    } catch (error: any) {
        toast({ title: 'Yanıt Eklenemedi', description: error.message, variant: 'destructive' });
        setAnnouncements(originalAnnouncements);
    }
  }, [user, isAdmin, toast, announcements]);

  const deleteComment = useCallback(async (announcementId: string, commentId: string) => {
    if (!user || !user.email) { throw new Error("Giriş yapmalısınız."); }
    const deleterAuthorId = isAdmin ? "ADMIN_ACCOUNT" : user.email;

    const originalAnnouncements = [...announcements];
    const optimisticData = originalAnnouncements.map(ann => {
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
        await updateAnnouncementInState(updatedAnnouncement);
        toast({ title: "Yorum Silindi" });
        broadcastAnnouncementUpdate();
    } catch(error: any) {
        toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
        setAnnouncements(originalAnnouncements);
    }
  }, [user, isAdmin, toast, announcements]);

  const deleteReply = useCallback(async (announcementId: string, commentId: string, replyId: string) => {
    if (!user || !user.email) { throw new Error("Giriş yapmalısınız."); }
    const deleterAuthorId = isAdmin ? "ADMIN_ACCOUNT" : user.email;

    const originalAnnouncements = [...announcements];
    const optimisticData = originalAnnouncements.map(ann => {
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
      await updateAnnouncementInState(updatedAnnouncement);
      toast({ title: "Yanıt Silindi" });
      broadcastAnnouncementUpdate();
      broadcastNotificationUpdate();
    } catch(error: any) {
        toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
        setAnnouncements(originalAnnouncements);
    }
  }, [user, isAdmin, toast, announcements]);

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
    togglePinAnnouncement,
    addCommentToAnnouncement,
    addReplyToComment,
    deleteComment,
    deleteReply,
    refetchAnnouncements: fetchAnnouncements,
  };
}

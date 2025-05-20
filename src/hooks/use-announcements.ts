
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context'; 
import { useToast } from '@/hooks/use-toast';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  media?: string | null; 
  mediaType?: string | null; 
  date: string; 
  author: string; 
  // authorId is removed as P2P context is gone; server will handle identity if needed
}

// Used for sending to API, server will generate id and date
export type NewAnnouncementPayload = Omit<Announcement, 'id' | 'date'>;


const ANNOUNCEMENTS_KEY = 'camlicaKoyuAnnouncements_api'; // Renamed to avoid conflict with old P2P storage

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const { user } = useUser();
  const { notificationsEnabled: siteNotificationsPreference } = useSettings(); 
  const { toast } = useToast();

  // Fetch initial announcements from API
  useEffect(() => {
    const fetchInitialAnnouncements = async () => {
      try {
        const response = await fetch('/api/announcements');
        if (!response.ok) {
          throw new Error('Failed to fetch announcements');
        }
        const data: Announcement[] = await response.json();
        data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAnnouncements(data);
        localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(data));
      } catch (error) {
        console.error("Failed to fetch initial announcements:", error);
        toast({
          title: "Duyurular Yüklenemedi",
          description: "Sunucudan duyurular alınırken bir sorun oluştu. Lütfen daha sonra tekrar deneyin.",
          variant: "destructive"
        });
        // Try to load from localStorage as a fallback
        const storedAnnouncements = localStorage.getItem(ANNOUNCEMENTS_KEY);
        if (storedAnnouncements) {
          try {
            const parsed = JSON.parse(storedAnnouncements);
            setAnnouncements(parsed);
          } catch (e) {
            console.error("Failed to parse announcements from localStorage", e);
          }
        }
      }
    };

    fetchInitialAnnouncements();
  }, [toast]);
  
  // Connect to SSE stream for real-time updates
  useEffect(() => {
    const eventSource = new EventSource('/api/announcements/stream');

    eventSource.onmessage = (event) => {
      try {
        const updatedAnnouncements: Announcement[] = JSON.parse(event.data);
        
        // Identify the latest announcement in the update that isn't already shown, for notification
        let latestNewAnnouncementForNotification: Announcement | null = null;
        if (updatedAnnouncements.length > 0) {
            const currentIds = new Set(announcements.map(a => a.id));
            const sortedServerAnnouncements = [...updatedAnnouncements].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            for (const ann of sortedServerAnnouncements) {
                if (!currentIds.has(ann.id)) {
                    latestNewAnnouncementForNotification = ann;
                    break; 
                }
            }
        }
        
        updatedAnnouncements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAnnouncements(updatedAnnouncements);
        localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));

        if (latestNewAnnouncementForNotification && siteNotificationsPreference && typeof window !== 'undefined' && window.Notification && Notification.permission === 'granted') {
          const notificationBody = latestNewAnnouncementForNotification.content.length > 120 
            ? latestNewAnnouncementForNotification.content.substring(0, 120) + "..." 
            : latestNewAnnouncementForNotification.content;
          
          const notification = new Notification(latestNewAnnouncementForNotification.title, {
            body: notificationBody,
            tag: latestNewAnnouncementForNotification.id, 
          });
          notification.onclick = () => {
            window.focus(); 
          };
        }
      } catch (error) {
          console.error("Error processing SSE message:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      toast({
        title: "Bağlantı Sorunu",
        description: "Duyuru güncellemeleriyle bağlantı kesildi. Otomatik olarak yeniden deneniyor.",
        variant: "destructive"
      });
      // EventSource attempts to reconnect automatically.
    };

    return () => {
      eventSource.close();
    };
  }, [siteNotificationsPreference, toast, announcements]); // added announcements to check for new ones

  const addAnnouncement = useCallback(async (newAnnouncementData: Omit<Announcement, 'id' | 'date' | 'author'>) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Duyuru eklemek için giriş yapmalısınız.", variant: "destructive" });
      return; 
    }

    const payload: NewAnnouncementPayload = {
      ...newAnnouncementData,
      author: `${user.name} ${user.surname}`,
    };

    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        throw new Error(errorData.message || 'Duyuru eklenemedi');
      }
      // No need to return announcement, SSE will update the state
      // The API now emits an event which SSE picks up.
      // Optional: optimistic update could be done here, but SSE should handle it.
      toast({ title: "Duyuru Gönderildi", description: "Duyurunuz başarıyla gönderildi ve yakında görünecektir." });
    } catch (error: any) {
      console.error("Failed to add announcement:", error);
      toast({ title: "Duyuru Eklenemedi", description: error.message || "Duyuru eklenirken bir sorun oluştu.", variant: "destructive" });
    }
  }, [user, toast]);

  const deleteAnnouncement = useCallback(async (id: string) => {
     if (!user) { // Basic check, server should ideally do more robust auth
      toast({ title: "Giriş Gerekli", description: "Duyuru silmek için giriş yapmalısınız.", variant: "destructive" });
      return; 
    }
    
    try {
      const response = await fetch(`/api/announcements?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        throw new Error(errorData.message || 'Duyuru silinemedi');
      }
      // SSE will update the state.
      toast({ title: "Duyuru Silindi", description: "Duyuru başarıyla silindi ve yakında listeden kaldırılacaktır." });
    } catch (error: any) {
      console.error("Failed to delete announcement:", error);
      toast({ title: "Duyuru Silinemedi", description: error.message || "Duyuru silinirken bir sorun oluştu.", variant: "destructive" });
    }
  }, [user, toast]);
  
  const getAnnouncementById = useCallback((id: string): Announcement | undefined => {
    return announcements.find(ann => ann.id === id);
  }, [announcements]);

  return { announcements, addAnnouncement, deleteAnnouncement, getAnnouncementById };
}

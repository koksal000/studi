
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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
  authorId?: string;
}

export type NewAnnouncementPayload = Omit<Announcement, 'id' | 'date'>;

const ANNOUNCEMENTS_KEY = 'camlicaKoyuAnnouncements_api_cache';

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const announcementsRef = useRef(announcements); 

  const { user } = useUser();
  const { notificationsEnabled: siteNotificationsPreference } = useSettings();
  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    announcementsRef.current = announcements;
  }, [announcements]);

  const fetchInitialAnnouncements = useCallback(async () => {
    console.log('[Announcements] Fetching initial announcements...');
    setIsLoading(true);
    try {
      const response = await fetch('/api/announcements');
      if (!response.ok) {
        console.error('[Announcements] Failed to fetch initial announcements, status:', response.status);
        throw new Error('Failed to fetch announcements');
      }
      const data: Announcement[] = await response.json();
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAnnouncements(data);
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(data));
      console.log('[Announcements] Initial announcements fetched and set:', data.length);
    } catch (error) {
      console.error("[Announcements] Failed to fetch initial announcements:", error);
      toast({
        title: "Duyurular Yüklenemedi",
        description: "Sunucudan duyurular alınırken bir sorun oluştu. Lütfen daha sonra tekrar deneyin.",
        variant: "destructive"
      });
      const storedAnnouncements = localStorage.getItem(ANNOUNCEMENTS_KEY);
      if (storedAnnouncements) {
        try {
          const parsed = JSON.parse(storedAnnouncements);
          setAnnouncements(parsed);
        } catch (e) {
          console.error("[Announcements] Failed to parse announcements from localStorage", e);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchInitialAnnouncements();
  }, [fetchInitialAnnouncements]);

  useEffect(() => {
    console.log('[SSE Announcements] useEffect for EventSource triggered. Site notifications preference:', siteNotificationsPreference);
    
    if (eventSourceRef.current) {
      console.log('[SSE Announcements] Closing existing EventSource.');
      eventSourceRef.current.close();
    }

    console.log('[SSE Announcements] Creating new EventSource for /api/announcements/stream');
    const newEventSource = new EventSource('/api/announcements/stream');
    eventSourceRef.current = newEventSource;

    newEventSource.onopen = () => {
      console.log('[SSE Announcements] Connection opened.');
    };
    
    newEventSource.onmessage = (event) => {
      try {
        const updatedAnnouncementsFromServer: Announcement[] = JSON.parse(event.data);
        console.log('[SSE Announcements] Received data via SSE:', updatedAnnouncementsFromServer.length, 'items');
        console.log('[SSE Announcements] Current local announcements (ref) before processing:', announcementsRef.current.length, 'items');
        
        const currentLocalAnnouncements = announcementsRef.current;
        let latestNewAnnouncementForNotification: Announcement | null = null;

        if (updatedAnnouncementsFromServer.length > 0) {
            const currentLocalIds = new Set(currentLocalAnnouncements.map(a => a.id));
            const newAnnouncementsFromServer = updatedAnnouncementsFromServer.filter(serverAnn => !currentLocalIds.has(serverAnn.id));

            if (newAnnouncementsFromServer.length > 0) {
                // Find the most recent among the new ones for notification
                newAnnouncementsFromServer.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                latestNewAnnouncementForNotification = newAnnouncementsFromServer[0];
                console.log('[SSE Announcements] Identified as NEW for notification:', latestNewAnnouncementForNotification.title);
            }
        }
        
        setAnnouncements(updatedAnnouncementsFromServer);
        localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncementsFromServer));
        console.log('[SSE Announcements] Local announcements and localStorage updated.');

        if (latestNewAnnouncementForNotification && siteNotificationsPreference && typeof window !== 'undefined' && window.Notification && Notification.permission === 'granted') {
          console.log('[SSE Announcements] Conditions MET for showing notification for:', latestNewAnnouncementForNotification.title);
          const notificationBody = latestNewAnnouncementForNotification.content.length > 120
            ? latestNewAnnouncementForNotification.content.substring(0, 120) + "..."
            : latestNewAnnouncementForNotification.content;

          if (document.visibilityState === 'visible') {
            try {
              const notification = new Notification(latestNewAnnouncementForNotification.title, {
                body: notificationBody,
                tag: latestNewAnnouncementForNotification.id, 
              });
              notification.onclick = () => {
                window.open('https://studi-ldexx24gi-koksals-projects-00474b3b.vercel.app/', '_blank');
                window.focus(); 
              };
              console.log('[SSE Announcements] Notification created successfully for:', latestNewAnnouncementForNotification.title);
            } catch (notificationError: any) {
              console.error('[SSE Announcements] Error creating notification (even when visible):', notificationError);
              console.error('[SSE Announcements] Notification error message:', notificationError.message);
              console.error('[SSE Announcements] Notification error name:', notificationError.name);
              toast({
                title: "Bildirim Gösterilemedi",
                description: "Tarayıcı bildirimi oluşturulurken bir sorun oluştu: " + notificationError.message,
                variant: "destructive"
              });
            }
          } else {
             console.log('[SSE Announcements] Notification skipped for:', latestNewAnnouncementForNotification.title, '- Page not visible. Consider using Service Worker for background notifications.');
          }
        } else {
            if (!latestNewAnnouncementForNotification) console.log('[SSE Announcements] No new announcement identified for notification (latestNewAnnouncementForNotification is null).');
            else if (!siteNotificationsPreference) console.log('[SSE Announcements] Site notifications preference is OFF.');
            else if (typeof window !== 'undefined' && window.Notification && Notification.permission !== 'granted') console.log('[SSE Announcements] Browser notification permission is NOT "granted":', Notification.permission);
            else {
                 console.log('[SSE Announcements] Notification conditions NOT MET. latestNew:', !!latestNewAnnouncementForNotification, 'sitePref:', siteNotificationsPreference, 'Notification API:', typeof window !== 'undefined' && !!window.Notification, 'Permission:', typeof window !== 'undefined' && window.Notification && Notification.permission);
            }
        }

      } catch (error) {
          console.error("[SSE Announcements] Error processing SSE message:", error);
      }
    };

    newEventSource.onerror = (errorEvent: Event) => {
      const target = errorEvent.target as EventSource;
      const readyState = target?.readyState;
      const eventType = errorEvent.type || 'unknown event type';
      
      console.error(
        `[SSE Announcements] Connection error. EventSource readyState: ${readyState}, Event Type: ${eventType}, Full Event:`, errorEvent
      );

      if (readyState === EventSource.CLOSED) {
        toast({
          title: "Duyuru Bağlantısı Sonlandı",
          description: "Otomatik yeniden bağlanma denenecek. Sorun devam ederse sayfayı yenileyin.",
          variant: "destructive"
        });
      } else if (readyState === EventSource.CONNECTING) { // readyState is 0
        toast({
          title: "Duyuru Bağlantısı Kurulamıyor",
          description: "Sunucuya ilk bağlantı kurulamadı. Yeniden deneniyor. Lütfen internet bağlantınızı ve Vercel'deki NEXT_PUBLIC_APP_URL ayarını kontrol edin.",
          variant: "destructive",
          duration: 8000, 
        });
      } else { // For readyState OPEN (1) if an error somehow occurs, or unknown state
         toast({
          title: "Duyuru Bağlantı Hatası",
          description: "Duyuru güncellemelerinde bir hata oluştu. Yeniden deneniyor.",
          variant: "destructive"
        });
      }
    };

    return () => {
      const es = eventSourceRef.current;
      if (es) {
        console.log('[SSE Announcements] Cleaning up EventSource.');
        es.close();
        eventSourceRef.current = null;
      }
    };
  }, [siteNotificationsPreference, toast]); 

  const addAnnouncement = useCallback(async (newAnnouncementData: Omit<Announcement, 'id' | 'date' | 'author' | 'authorId'>) => {
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
      // SSE should handle the state update
    } catch (error: any) {
      console.error("[Announcements] Failed to add announcement:", error);
      toast({ title: "Duyuru Eklenemedi", description: error.message || "Duyuru eklenirken bir sorun oluştu.", variant: "destructive" });
    }
  }, [user, toast]);

  const deleteAnnouncement = useCallback(async (id: string) => {
     if (!user) {
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
      // SSE should handle the state update
    } catch (error: any) {
      console.error("[Announcements] Failed to delete announcement:", error);
      toast({ title: "Duyuru Silinemedi", description: error.message || "Duyuru silinirken bir sorun oluştu.", variant: "destructive" });
    }
  }, [user, toast]);

  const getAnnouncementById = useCallback((id: string): Announcement | undefined => {
    return announcements.find(ann => ann.id === id);
  }, [announcements]);

  return { announcements, addAnnouncement, deleteAnnouncement, getAnnouncementById, isLoading };
}


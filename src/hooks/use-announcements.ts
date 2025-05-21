
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/user-context';
// import { useSettings } from '@/contexts/settings-context'; // Kaldırıldı
import { useToast } from '@/hooks/use-toast';
import { useAnnouncementStatus } from '@/contexts/announcement-status-context'; // Yeni import

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
  // const { notificationsEnabled: siteNotificationsPreference } = useSettings(); // Kaldırıldı
  const { lastOpenedNotificationTimestamp } = useAnnouncementStatus(); // Yeni hook
  const [unreadCount, setUnreadCount] = useState(0); // Yeni state

  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    announcementsRef.current = announcements;
    // Okunmamış duyuru sayısını hesapla
    if (lastOpenedNotificationTimestamp) {
      const newUnreadCount = announcements.filter(
        (ann) => new Date(ann.date).getTime() > lastOpenedNotificationTimestamp
      ).length;
      setUnreadCount(newUnreadCount);
    } else {
      // Eğer daha önce hiç açılmamışsa, tüm duyurular okunmamış sayılır (veya ilk yüklemede 0 olabilir)
      setUnreadCount(announcements.length > 0 ? announcements.length : 0);
    }
  }, [announcements, lastOpenedNotificationTimestamp]);

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
    // siteNotificationsPreference kaldırıldığı için bu log güncellendi veya kaldırılabilir.
    console.log('[SSE Announcements] useEffect for EventSource triggered.'); 
    
    if (eventSourceRef.current) {
      console.log('[SSE Announcements] Closing existing EventSource.');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
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
        
        setAnnouncements(updatedAnnouncementsFromServer);
        localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncementsFromServer));
        console.log('[SSE Announcements] Local announcements and localStorage updated.');

        // Tarayıcı bildirimi gönderme mantığı kaldırıldı.
        // Okunmamış sayısını güncelleme zaten `useEffect` içinde `announcements` ve `lastOpenedNotificationTimestamp` bağımlılıklarıyla yapılıyor.

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

      let toastMessage = "Duyuru güncellemeleriyle bağlantı kesildi. Otomatik olarak yeniden deneniyor.";
      if (readyState === EventSource.CLOSED) {
        toastMessage = "Duyuru bağlantısı sonlandı. Otomatik yeniden bağlanma denenecek. Sorun devam ederse sayfayı yenileyin.";
      } else if (readyState === EventSource.CONNECTING && eventType === 'error') { // Hata CONNECTING aşamasında ise
        toastMessage = "Duyuru bağlantısı kurulamıyor. Lütfen internet bağlantınızı ve Vercel'deki NEXT_PUBLIC_APP_URL ayarını kontrol edin. Yeniden deneniyor...";
      }
      
      toast({
        title: "Duyuru Bağlantı Sorunu",
        description: toastMessage,
        variant: "destructive",
        duration: 8000, 
      });
    };

    return () => {
      const es = eventSourceRef.current;
      if (es) {
        console.log('[SSE Announcements] Cleaning up EventSource.');
        es.close();
        eventSourceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]); 

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

  return { announcements, addAnnouncement, deleteAnnouncement, getAnnouncementById, isLoading, unreadCount }; // unreadCount eklendi
}

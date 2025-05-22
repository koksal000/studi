
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { STATIC_GALLERY_IMAGES_FOR_SEEDING } from '@/lib/constants';

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  caption: string;
  hint: string;
}

export type NewGalleryImagePayload = {
  imageDataUri: string;
  caption: string;
  alt: string;
  hint: string;
};

const gallerySortFn = (a: GalleryImage, b: GalleryImage): number => {
  const aIsSeed = a.id.startsWith('seed_');
  const bIsSeed = b.id.startsWith('seed_');

  if (aIsSeed && !bIsSeed) return -1;
  if (!aIsSeed && bIsSeed) return 1;

  const extractNumericPart = (id: string) => {
    const match = id.match(/\d+$/);
    return match ? parseInt(match[0]) : null;
  };

  const numA = extractNumericPart(a.id);
  const numB = extractNumericPart(b.id);

  if (numA !== null && numB !== null) {
    if (a.id.startsWith('gal_') && b.id.startsWith('gal_')) {
      return numB - numA;
    }
     if (a.id.startsWith('seed_') && b.id.startsWith('seed_')) {
      return numA - numB;
    }
  }

  if (a.id.startsWith('gal_') && b.id.startsWith('seed_')) return -1;
  if (a.id.startsWith('seed_') && b.id.startsWith('gal_')) return 1;
  
  return a.id.localeCompare(b.id);
};


export function useGallery() {
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();
  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);
  const initialDataLoadedRef = useRef(false);
  const galleryImagesRef = useRef<GalleryImage[]>(galleryImages);

  useEffect(() => {
    galleryImagesRef.current = galleryImages;
  }, [galleryImages]);

  useEffect(() => {
    setIsLoading(true);
    initialDataLoadedRef.current = false;

    fetch('/api/gallery')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch initial gallery: ${res.status}`);
        return res.json();
      })
      .then((data: GalleryImage[]) => {
        if (data && data.length > 0) {
          setGalleryImages(data.sort(gallerySortFn));
        } else {
          // API returned empty, seed with static images for the first load
          setGalleryImages([...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFn));
        }
      })
      .catch(err => {
        console.error("[Gallery] Failed to fetch initial gallery, using static seeds:", err);
        setGalleryImages([...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFn));
      })
      .finally(() => {
        // SSE will handle the final isLoading=false after its first message or error
      });

    if (eventSourceRef.current) {
        eventSourceRef.current.close();
    }
    
    const newEventSource = new EventSource('/api/gallery/stream');
    eventSourceRef.current = newEventSource;

    newEventSource.onopen = () => {
      // console.log('[SSE Gallery] Connection opened.');
    };

    newEventSource.onmessage = (event) => {
      try {
        const updatedGalleryFromServer: GalleryImage[] = JSON.parse(event.data);
        setGalleryImages(updatedGalleryFromServer.sort(gallerySortFn));
      } catch (error) {
        console.error("Error processing gallery SSE message:", error);
      } finally {
        if (!initialDataLoadedRef.current) {
            setIsLoading(false);
            initialDataLoadedRef.current = true;
        }
      }
    };

    newEventSource.onerror = (errorEvent: Event) => {
      const target = errorEvent.target as EventSource;
      if (eventSourceRef.current !== target) {
        return; // Error from an old EventSource instance
      }
      const readyState = target?.readyState;
      const eventType = errorEvent.type || 'unknown event type';
      
      if (readyState === EventSource.CLOSED) {
        console.warn(
          `[SSE Gallery] Connection closed. EventSource readyState: ${readyState}, Event Type: ${eventType}. Browser will attempt to reconnect. Full Event:`, errorEvent
        );
      } else if (readyState === EventSource.CONNECTING) {
         console.warn(
          `[SSE Gallery] Initial connection failed or connection attempt error. EventSource readyState: ${readyState}, Event Type: ${eventType}. Full Event:`, errorEvent,
          "This might be due to NEXT_PUBLIC_APP_URL not being set correctly in your deployment environment, or the stream API endpoint having issues."
        );
      }
      else {
        console.error(
          `[SSE Gallery] Connection error. EventSource readyState: ${readyState}, Event Type: ${eventType}, Full Event:`, errorEvent
        );
      }
      if (!initialDataLoadedRef.current) {
        setIsLoading(false);
        initialDataLoadedRef.current = true;
         // Fallback to static seeds if SSE fails to provide initial data
        if (galleryImagesRef.current.length === 0) {
            setGalleryImages([...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFn));
        }
      }
    };

    return () => {
      if (newEventSource) {
        newEventSource.close();
      }
      eventSourceRef.current = null;
    };
  }, [toast]); // Removed isLoading from dependencies

  const addGalleryImage = useCallback(async (payload: NewGalleryImagePayload) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim eklemek için giriş yapmalısınız.", variant: "destructive" });
      return Promise.reject(new Error("User not logged in"));
    }

    if (!payload || !payload.imageDataUri || !payload.imageDataUri.startsWith('data:image/') || !payload.caption || !payload.caption.trim()) {
      toast({ title: "Geçersiz Yükleme Verisi", description: "Resim verisi veya başlık eksik/hatalı. Lütfen tekrar deneyin.", variant: "destructive" });
      console.error("addGalleryImage: Invalid payload received", { caption: payload?.caption, imageDataUriStart: payload?.imageDataUri?.substring(0,30) });
      return Promise.reject(new Error("Invalid payload provided to addGalleryImage: Missing or invalid imageDataUri or caption."));
    }
    
    const MAX_IMAGE_DATA_URI_LENGTH = 4 * 1024 * 1024; // Approx 4MB
    if (payload.imageDataUri.length > MAX_IMAGE_DATA_URI_LENGTH) {
        toast({ title: "Resim Verisi Çok Büyük", description: `Resim dosyası çok büyük (işlenmiş veri ~${Math.round(payload.imageDataUri.length / (1024*1024))}MB). Lütfen daha küçük boyutlu bir dosya seçin.`, variant: "destructive", duration: 8000 });
        return Promise.reject(new Error("Image data URI too large."));
    }

    const newImageForApi: GalleryImage = {
      id: `gal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      src: payload.imageDataUri,
      alt: payload.alt || payload.caption,
      caption: payload.caption,
      hint: payload.hint || 'uploaded image',
    };

    try {
      const response = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newImageForApi),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        if (response.status === 413) { // Payload Too Large
            toast({ title: "Yükleme Başarısız", description: errorData.message || "Sunucuya gönderilen resim dosyası çok büyük.", variant: "destructive" });
        } else {
            toast({ title: "Yükleme Başarısız", description: errorData.message || "Sunucu hatası oluştu.", variant: "destructive" });
        }
        throw new Error(errorData.message || 'Resim sunucuya iletilemedi');
      }
      // UI update will happen via SSE
    } catch (error: any) {
      console.error("Failed to send new gallery image to server:", error);
      if (error.message && !error.message.includes("sunucuya iletilemedi") && !error.message.includes("limitlerini aşıyor") && !error.message.includes("büyük")) {
        toast({ title: "Resim Yüklenemedi", description: error.message || "Ağ hatası veya beklenmedik bir sorun oluştu.", variant: "destructive" });
      }
      throw error;
    }
  }, [user, toast]);

  const deleteGalleryImage = useCallback(async (id: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim silmek için giriş yapmalısınız.", variant: "destructive" });
      return Promise.reject(new Error("User not logged in"));
    }

    try {
      const response = await fetch(`/api/gallery?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        toast({ title: "Resim Silinemedi", description: errorData.message || "Sunucu hatası oluştu.", variant: "destructive" });
        throw new Error(errorData.message || 'Resim silme bilgisi sunucuya iletilemedi');
      }
      // UI update will happen via SSE
    } catch (error: any) {
      console.error("Failed to notify server about deleted gallery image:", error);
      if (!error.message?.includes("sunucuya iletilemedi")) {
        toast({ title: "Resim Silinemedi", description: error.message || "Resim silme işlemi sırasında bir sorun oluştu.", variant: "destructive" });
      }
      throw error;
    }
  }, [user, toast]);

  return { galleryImages, addGalleryImage, deleteGalleryImage, isLoading };
}

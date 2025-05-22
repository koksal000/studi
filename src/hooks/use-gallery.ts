
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
  
  return a.id.localeCompare(b.id); // Fallback for non-standard IDs or if both are seed/gal and numeric parts are equal
};


export function useGallery() {
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();
  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);
  const initialDataLoadedRef = useRef(false);

  useEffect(() => {
    initialDataLoadedRef.current = false;
    setIsLoading(true);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/gallery/stream');
    eventSourceRef.current = es;

    es.onopen = () => {
      // console.log('[SSE Gallery] Connection opened.');
    };

    es.onmessage = (event) => {
      try {
        const updatedGalleryFromServer: GalleryImage[] = JSON.parse(event.data);
        let finalDataToShow = [...updatedGalleryFromServer].sort(gallerySortFn);
        
        if (!initialDataLoadedRef.current && finalDataToShow.length === 0) {
            finalDataToShow = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFn);
        }
        setGalleryImages(finalDataToShow);

        if (!initialDataLoadedRef.current) {
          setIsLoading(false);
          initialDataLoadedRef.current = true;
        }
      } catch (error) {
        console.error("Error processing gallery SSE message:", error);
        if (!initialDataLoadedRef.current) {
          setGalleryImages([...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFn)); 
          setIsLoading(false);
          initialDataLoadedRef.current = true;
        }
      }
    };

    es.onerror = (errorEvent: Event) => {
      const target = errorEvent.target as EventSource;
      const readyState = target?.readyState;
      const eventType = errorEvent.type || 'unknown event type';
       if (readyState === EventSource.CLOSED) {
        console.warn(
          `[SSE Gallery] Connection closed. EventSource readyState: ${readyState}, Event Type: ${eventType}. Browser will attempt to reconnect. Full Event:`, errorEvent
        );
      } else {
         console.error(
          `[SSE Gallery] Connection error. EventSource readyState: ${readyState}, Event Type: ${eventType}, Full Event:`, errorEvent
        );
      }
      if (!initialDataLoadedRef.current) {
        setGalleryImages([...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFn));
        setIsLoading(false);
        initialDataLoadedRef.current = true;
      }
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

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
        toast({ title: "Yükleme Başarısız", description: errorData.message || "Sunucu hatası oluştu.", variant: "destructive" });
        throw new Error(errorData.message || 'Resim sunucuya iletilemedi');
      }
      // UI will update via SSE
    } catch (error: any) {
      console.error("Failed to send new gallery image to server:", error);
      // Toast is already shown if response was not ok
      if (error.message && !error.message.includes("sunucuya iletilemedi") && !error.message.includes("limitlerini aşıyor")) {
        toast({ title: "Resim Yüklenemedi", description: error.message || "Ağ hatası veya beklenmedik bir sorun oluştu.", variant: "destructive" });
      }
      throw error; // Re-throw for the calling component
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
      // UI will update via SSE
    } catch (error: any) {
      console.error("Failed to notify server about deleted gallery image:", error);
      toast({ title: "Resim Silinemedi", description: error.message || "Resim silme işlemi sırasında bir sorun oluştu.", variant: "destructive" });
      throw error; // Re-throw
    }
  }, [user, toast]);

  return { galleryImages, addGalleryImage, deleteGalleryImage, isLoading };
}

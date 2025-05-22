
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GalleryImage, NewGalleryImagePayload } from '@/hooks/use-gallery';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { STATIC_GALLERY_IMAGES_FOR_SEEDING } from '@/lib/constants';

// Re-exporting for use in other files if necessary
export type { GalleryImage, NewGalleryImagePayload };

const GALLERY_LOCAL_STORAGE_KEY = 'camlicaKoyuGallery_localStorage';
const MAX_IMAGE_DATA_URI_LENGTH_HOOK = Math.floor(5 * 1024 * 1024 * 1.37 * 1.05); // Approx 7.2MB for 5MB raw image

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
  const { user } = useUser();
  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialDataLoadedRef = useRef(false); 
  const galleryImagesRef = useRef<GalleryImage[]>(galleryImages);

  useEffect(() => {
    galleryImagesRef.current = galleryImages;
  }, [galleryImages]);

  useEffect(() => {
    initialDataLoadedRef.current = false;
    setIsLoading(true);

    fetch('/api/gallery')
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to fetch initial gallery: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then((data: GalleryImage[]) => {
        if (Array.isArray(data)) {
            if (data.length === 0) {
                // API returned empty, seed with static images if local storage is also empty
                // This part is now less relevant as localStorage is removed
                setGalleryImages([...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFn));
            } else {
                setGalleryImages(data.sort(gallerySortFn));
            }
        } else {
            console.warn("[Gallery] API did not return an array for initial gallery data, using static seeds.");
            setGalleryImages([...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFn));
        }
      })
      .catch(err => {
        console.error("[Gallery] Failed to fetch initial gallery, using static seeds:", err);
        setGalleryImages([...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFn));
      })
      .finally(() => {
        // setIsLoading(false); // SSE will handle this
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
        return; 
      }
      const readyState = target?.readyState;
      const eventType = errorEvent.type || 'unknown event type';
      
      if (readyState === 0) { // CONNECTING
        console.warn(
          `[SSE Gallery] Initial connection failed or connection attempt error. EventSource readyState: ${readyState}, Event Type: ${eventType}. Full Event:`, errorEvent,
          "Check NEXT_PUBLIC_APP_URL in your deployment environment, or if the stream API endpoint is running correctly."
        );
      } else {
        console.warn( // Changed to warn for other errors as well, to be less alarming
          `[SSE Gallery] Connection error/closed. EventSource readyState: ${readyState}, Event Type: ${eventType}. Browser will attempt to reconnect. Full Event:`, errorEvent
        );
      }

      if (!initialDataLoadedRef.current) {
        setIsLoading(false);
        initialDataLoadedRef.current = true;
        // Fallback to static seeds if SSE fails to provide initial data and current gallery is empty
        if (galleryImagesRef.current.length === 0) {
             console.warn("[Gallery] SSE connection error, and no gallery data loaded. Using static seeds as fallback.");
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
  }, []);

  const addGalleryImage = useCallback(async (payload: NewGalleryImagePayload) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim eklemek için giriş yapmalısınız.", variant: "destructive" });
      throw new Error("User not logged in");
    }

    if (!payload || !payload.imageDataUri || !payload.caption?.trim()) {
      toast({ title: "Geçersiz Yükleme Verisi", description: "Resim verisi veya başlık eksik. Lütfen tekrar deneyin.", variant: "destructive" });
      throw new Error("Invalid payload: Missing imageDataUri or caption.");
    }

    if (!payload.imageDataUri.startsWith('data:image/')) {
        toast({ title: "Geçersiz Resim Formatı", description: "Yüklenen dosya geçerli bir resim formatında değil.", variant: "destructive" });
        throw new Error("Invalid image data URI format.");
    }
    
    if (payload.imageDataUri.length > MAX_IMAGE_DATA_URI_LENGTH_HOOK) {
        toast({ title: "Resim Verisi Çok Büyük", description: `Resim dosyası çok büyük (işlenmiş veri ~${Math.round(payload.imageDataUri.length / (1024*1024))}MB, ~5MB ham dosyadan fazla). Lütfen daha küçük boyutlu bir dosya seçin.`, variant: "destructive", duration: 8000 });
        throw new Error("Image data URI too large.");
    }

    const newImageForApi: GalleryImage = {
      id: `gal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      src: payload.imageDataUri,
      alt: payload.alt?.trim() || payload.caption,
      caption: payload.caption,
      hint: payload.hint?.trim() || 'uploaded image',
    };

    // No optimistic UI update here, wait for SSE or API response

    try {
      const response = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newImageForApi),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        let userMessage = errorData.message || "Sunucu hatası oluştu.";
        if (response.status === 413) { // Payload Too Large
            userMessage = errorData.message || "Sunucuya gönderilen resim dosyası çok büyük.";
        }
        toast({ title: "Yükleme Başarısız", description: userMessage, variant: "destructive" });
        throw new Error(userMessage);
      }
      // Successful API call, UI will update via SSE from the server broadcasting the change
      // toast({ title: "Resim Başarıyla Gönderildi", description: "Galeri kısa süre içinde güncellenecektir." });
    } catch (error: any) {
      console.error("Failed to send new gallery image to server:", error);
      // Toast for this error is already shown if it's from the API response
      // If it's a network error or other, the generic catch in admin page might handle it, or we can add one here
      if (!error.message?.includes("sunucu") && !error.message?.includes("payload") && !error.message?.includes("büyük")) {
        // Only toast if it's not a server-originated message we already handled
        toast({ title: "Resim Yüklenemedi", description: error.message || "Ağ hatası veya beklenmedik bir sorun oluştu.", variant: "destructive" });
      }
      throw error; // Re-throw to be caught by the calling component if needed
    }
  }, [user, toast]);

  const deleteGalleryImage = useCallback(async (id: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim silmek için giriş yapmalısınız.", variant: "destructive" });
      throw new Error("User not logged in");
    }

    // No optimistic UI update here

    try {
      const response = await fetch(`/api/gallery?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        toast({ title: "Resim Silinemedi", description: errorData.message || "Sunucu hatası oluştu.", variant: "destructive" });
        throw new Error(errorData.message || 'Resim silme bilgisi sunucuya iletilemedi');
      }
      // Successful API call, UI will update via SSE
      // toast({ title: "Resim Silme İsteği Gönderildi", description: "Galeri kısa süre içinde güncellenecektir." });
    } catch (error: any) {
      console.error("Failed to notify server about deleted gallery image:", error);
       if (!error.message?.includes("sunucu")) {
        toast({ title: "Resim Silinemedi", description: error.message || "Resim silme işlemi sırasında bir sorun oluştu.", variant: "destructive" });
      }
      throw error; // Re-throw
    }
  }, [user, toast]);

  return { galleryImages, addGalleryImage, deleteGalleryImage, isLoading };
}

    
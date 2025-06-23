
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { useToast } from './use-toast';
import { STATIC_GALLERY_IMAGES_FOR_SEEDING } from '@/lib/constants';
import { idbGet, idbSet, STORES } from '@/lib/idb';

export interface GalleryImage {
  id: string;
  src: string; 
  alt: string;
  caption: string;
  hint: string;
}

export interface NewGalleryImagePayload {
  imageDataUri: string;
  caption: string;
  alt: string;
  hint: string;
}

const MAX_IMAGE_DATA_URI_LENGTH_HOOK = Math.floor(5 * 1024 * 1024 * 1.37 * 1.05); // Approx 7.2MB for 5MB raw image
const GALLERY_KEY = 'all-gallery-images';

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
  const [galleryImages, setGalleryImages] = useState<GalleryImage[] | null>(null);
  const { user } = useUser();
  const { toast } = useToast();

  const isLoading = galleryImages === null;

  useEffect(() => {
    let isMounted = true;
    
    // 1. Attempt to load from cache first for instant UI
    idbGet<GalleryImage[]>(STORES.GALLERY, GALLERY_KEY).then(cachedData => {
        if (isMounted) {
            if (cachedData && cachedData.length > 0) {
                setGalleryImages(cachedData.sort(gallerySortFn));
            } else {
                // If cache is empty, use static seeds as a starting point
                setGalleryImages([...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFn));
            }
        }
    });

    // 2. Establish live SSE connection
    const eventSource = new EventSource('/api/gallery/stream');

    eventSource.onmessage = (event) => {
        if(!isMounted) return;
        try {
            const serverData: GalleryImage[] = JSON.parse(event.data);
            const sortedData = serverData.sort(gallerySortFn);
            
            // Update state and cache
            setGalleryImages(sortedData);
            idbSet(STORES.GALLERY, GALLERY_KEY, sortedData).catch(e => console.error("Failed to cache gallery images in IndexedDB", e));
        } catch (error) {
            console.error("Error processing gallery SSE message:", error);
        }
    };

    eventSource.onerror = (error) => {
        console.error("[SSE Gallery] Connection error:", error);
        if (isMounted && galleryImages === null) {
            setGalleryImages([...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFn));
        }
        eventSource.close();
    };

    // 3. Cleanup on unmount
    return () => {
        isMounted = false;
        eventSource.close();
    };
  }, []); // <-- CRITICAL: Empty dependency array ensures this runs only once.

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

    try {
      const response = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newImageForApi),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        let userMessage = errorData.message || "Sunucu hatası oluştu.";
        if (response.status === 413) {
            userMessage = errorData.message || "Sunucuya gönderilen resim dosyası çok büyük.";
        }
        toast({ title: "Yükleme Başarısız", description: userMessage, variant: "destructive" });
        throw new Error(userMessage);
      }
    } catch (error: any) {
      console.error("Failed to send new gallery image to server:", error);
      if (!error.message?.includes("sunucu") && !error.message?.includes("payload") && !error.message?.includes("büyük")) {
        toast({ title: "Resim Yüklenemedi", description: error.message || "Ağ hatası veya beklenmedik bir sorun oluştu.", variant: "destructive" });
      }
      throw error;
    }
  }, [user, toast]);

  const deleteGalleryImage = useCallback(async (id: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim silmek için giriş yapmalısınız.", variant: "destructive" });
      throw new Error("User not logged in");
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
    } catch (error: any) {
      console.error("Failed to notify server about deleted gallery image:", error);
       if (!error.message?.includes("sunucu")) {
        toast({ title: "Resim Silinemedi", description: error.message || "Resim silme işlemi sırasında bir sorun oluştu.", variant: "destructive" });
      }
      throw error;
    }
  }, [user, toast]);

  return { 
    galleryImages: galleryImages ?? [],
    addGalleryImage, 
    deleteGalleryImage, 
    isLoading 
  };
}

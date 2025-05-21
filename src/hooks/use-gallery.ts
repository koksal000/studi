
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { STATIC_GALLERY_IMAGES_FOR_SEEDING } from '@/lib/constants'; // For initial seed

export interface GalleryImage {
  id: string;
  src: string; // This will be base64 data URI for new uploads, or URL from seed
  alt: string;
  caption: string;
  hint: string;
}

// Payload from client form to the hook
export type NewGalleryImagePayload = {
  imageDataUri: string; // base64
  caption: string;
  alt: string;
  hint: string;
};

const GALLERY_LOCAL_STORAGE_KEY = 'camlicaKoyuGallery_localStorage';

export function useGallery() {
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();
  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadGalleryFromLocalStorage = useCallback(() => {
    setIsLoading(true);
    try {
      const storedGallery = localStorage.getItem(GALLERY_LOCAL_STORAGE_KEY);
      if (storedGallery) {
        const parsed = JSON.parse(storedGallery) as GalleryImage[];
        setGalleryImages(parsed);
      } else {
        const seededImages = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort((a,b) => {
            const aIsSeed = a.id.startsWith('seed_');
            const bIsSeed = b.id.startsWith('seed_');
            if (aIsSeed && !bIsSeed) return -1;
            if (!aIsSeed && bIsSeed) return 1;
            return 0; 
        });
        setGalleryImages(seededImages);
        localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(seededImages));
      }
    } catch (error: any) {
      console.error("Failed to load gallery from localStorage:", error);
      if (error.name === 'QuotaExceededError') {
        toast({
          title: "Yerel Depolama Alanı Dolu",
          description: "Tarayıcınızın yerel depolama alanı dolu olduğu için galeri yüklenemedi. Lütfen bazı verileri temizleyin veya daha az resim saklayın.",
          variant: "destructive",
          duration: 7000,
        });
      }
      const seededImagesOnLoadError = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort((a,b) => {
        const aIsSeed = a.id.startsWith('seed_');
        const bIsSeed = b.id.startsWith('seed_');
        if (aIsSeed && !bIsSeed) return -1;
        if (!aIsSeed && bIsSeed) return 1;
        return 0; 
      });
      setGalleryImages(seededImagesOnLoadError);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadGalleryFromLocalStorage();
  }, [loadGalleryFromLocalStorage]);

  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/gallery/stream');
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const updatedGalleryFromServer: GalleryImage[] = JSON.parse(event.data);
        const sortedData = [...updatedGalleryFromServer].sort((a,b) => {
            if (a.id.startsWith('seed_') && !b.id.startsWith('seed_')) return -1;
            if (!a.id.startsWith('seed_') && b.id.startsWith('seed_')) return 1;
            const idA = a.id.replace(/^(seed_|gal_)/, '');
            const idB = b.id.replace(/^(seed_|gal_)/, '');
            if (isNaN(parseInt(idA)) || isNaN(parseInt(idB))) {
                return a.id.localeCompare(b.id);
            }
            return parseInt(idB) - parseInt(idA);
          });
        setGalleryImages(sortedData);
        try {
          localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(sortedData));
        } catch (e: any) {
          if (e.name === 'QuotaExceededError') {
            console.warn("LocalStorage quota exceeded while trying to save gallery updates from SSE.");
            toast({
              title: "Yerel Depolama Uyarısı",
              description: "Galeri güncellendi, ancak tarayıcı depolama limiti nedeniyle bazı resimler yerel olarak tam kaydedilememiş olabilir.",
              variant: "warning",
              duration: 7000,
            });
          } else {
            console.error("Error saving gallery updates from SSE to localStorage:", e);
          }
        }
      } catch (error) {
        console.error("Error processing gallery SSE message:", error);
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
      } else if (readyState === EventSource.CONNECTING) {
         console.warn(
          `[SSE Gallery] Connection attempt failed or interrupted. EventSource readyState: ${readyState}, Event Type: ${eventType}. Browser will retry. Full Event:`, errorEvent
        );
      } else {
        console.error(
          `[SSE Gallery] Connection error. EventSource readyState: ${readyState}, Event Type: ${eventType}, Full Event:`, errorEvent
        );
      }
    };
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [toast]);

  const addGalleryImage = useCallback(async (payload: NewGalleryImagePayload) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim eklemek için giriş yapmalısınız.", variant: "destructive" });
      return Promise.reject(new Error("User not logged in"));
    }

    const newImageForApiAndOptimistic: GalleryImage = {
      id: `gal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      src: payload.imageDataUri, 
      alt: payload.alt || payload.caption,
      caption: payload.caption,
      hint: payload.hint || 'uploaded image',
    };

    const previousGallery = [...galleryImages];
    setGalleryImages(prev => [newImageForApiAndOptimistic, ...prev]);

    try {
      localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify([newImageForApiAndOptimistic, ...previousGallery]));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        setGalleryImages(previousGallery); // Revert optimistic UI update if localStorage fails immediately
        localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(previousGallery)); // Try to save previous state
        toast({
          title: "Yerel Depolama Limiti Aşıldı",
          description: "Resim yüklenemedi çünkü tarayıcı depolama alanı dolu. Lütfen bazı resimleri silin.",
          variant: "destructive",
          duration: 7000,
        });
        throw e; // Re-throw to be caught by admin page
      } else {
        console.error("Error saving new image to localStorage (optimistic):", e);
      }
    }

    try {
      const response = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newImageForApiAndOptimistic), 
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        let errorMessage = errorData.message || 'Resim sunucuya iletilemedi';
        
        if (response.status === 413) { // Payload Too Large
          errorMessage = "Resim yüklenemedi çünkü dosya boyutu çok büyük. Lütfen daha küçük bir resim seçin.";
        }
        
        toast({ title: "Yükleme Başarısız", description: errorMessage, variant: "destructive" });
        
        // Revert optimistic update on API error
        setGalleryImages(previousGallery);
        localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(previousGallery));
        throw new Error(errorMessage);
      }
      // On successful API call, SSE will eventually update all clients.
      // Our local state and localStorage are already optimistically updated.
    } catch (error: any) {
      console.error("Failed to notify server about new gallery image:", error);
       // If error was not already toasted as a specific 413 or quota error
      if (!error.message?.includes("Resim verisi çok büyük") && !error.message?.includes("Yerel Depolama Limiti Aşıldı")) {
         // A general toast for other types of errors, but not if already handled
      }
      // Revert if not already reverted and if it's not a quota error which reverted already
      if (!error.name?.includes('QuotaExceededError')) {
        setGalleryImages(previousGallery);
        localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(previousGallery));
      }
      throw error; 
    }
  }, [user, toast, galleryImages]);

  const deleteGalleryImage = useCallback(async (id: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim silmek için giriş yapmalısınız.", variant: "destructive" });
      return Promise.reject(new Error("User not logged in"));
    }

    const imageToDelete = galleryImages.find(img => img.id === id);
    const previousGallery = [...galleryImages];
    
    setGalleryImages(prev => prev.filter(img => img.id !== id));
    try {
        localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(galleryImages.filter(img => img.id !== id)));
    } catch (e: any) {
        console.warn("Error updating localStorage after delete (optimistic):", e);
    }


    try {
      const response = await fetch(`/api/gallery?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        if (imageToDelete) { // Revert optimistic update
            setGalleryImages(previousGallery);
             try {
                localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(previousGallery));
            } catch (e: any) { /* ignore localStorage error on revert */ }
        }
        throw new Error(errorData.message || 'Resim silme bilgisi sunucuya iletilemedi');
      }
    } catch (error: any) {
      console.error("Failed to notify server about deleted gallery image:", error);
      toast({ title: "Resim Silinemedi", description: error.message || "Resim silme bilgisi diğer kullanıcılara iletilirken bir sorun oluştu.", variant: "destructive" });
      // Revert if not already reverted
      if (imageToDelete && !galleryImages.find(img => img.id === id)) {
         setGalleryImages(previousGallery);
         localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(previousGallery));
      }
      throw error;
    }
  }, [user, toast, galleryImages]);

  return { galleryImages, addGalleryImage, deleteGalleryImage, isLoading };
}

    
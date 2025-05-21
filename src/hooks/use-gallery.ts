
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { STATIC_GALLERY_IMAGES_FOR_SEEDING } from '@/lib/constants'; // For initial seed

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  caption: string;
  hint: string;
}

export type NewGalleryImagePayload = Omit<GalleryImage, 'id'> & { imageDataUri: string };

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
        // Optional: sort if needed, e.g., by an added timestamp or keep as is
        setGalleryImages(parsed);
      } else {
        // If localStorage is empty, seed with static images
        setGalleryImages([...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort((a,b) => {
            const aIsSeed = a.id.startsWith('seed_');
            const bIsSeed = b.id.startsWith('seed_');
            if (aIsSeed && !bIsSeed) return -1;
            if (!aIsSeed && bIsSeed) return 1;
            return 0;
        }));
        localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(STATIC_GALLERY_IMAGES_FOR_SEEDING));
      }
    } catch (error) {
      console.error("Failed to load gallery from localStorage:", error);
      setGalleryImages([...STATIC_GALLERY_IMAGES_FOR_SEEDING]); // Fallback to seed on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGalleryFromLocalStorage();
  }, [loadGalleryFromLocalStorage]);

  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const newEventSource = new EventSource('/api/gallery/stream');
    eventSourceRef.current = newEventSource;

    newEventSource.onmessage = (event) => {
      try {
        const updatedGallery: GalleryImage[] = JSON.parse(event.data);
         // Sort logic from API applied here as well for consistency
        const sortedData = [...updatedGallery].sort((a,b) => {
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
        localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(sortedData));
      } catch (error) {
        console.error("Error processing gallery SSE message:", error);
      }
    };

    newEventSource.onerror = (errorEvent: Event) => {
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
    };
    
    return () => {
      const es = eventSourceRef.current;
      if (es) {
        es.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const addGalleryImage = useCallback(async (payload: NewGalleryImagePayload) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim eklemek için giriş yapmalısınız.", variant: "destructive" });
      return Promise.reject(new Error("User not logged in"));
    }

    const newImage: GalleryImage = {
      id: `gal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      src: payload.imageDataUri, // imageDataUri is the base64 string
      alt: payload.alt || payload.caption,
      caption: payload.caption,
      hint: payload.hint || 'uploaded image',
    };

    setGalleryImages(prev => {
      const updated = [newImage, ...prev]; // Add new image to the beginning
      localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    try {
      const apiPayload = { // Ensure API payload matches what API expects
        imageDataUri: newImage.src, // src is the base64 string
        caption: newImage.caption,
        alt: newImage.alt,
        hint: newImage.hint,
      };
      const response = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload), 
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        throw new Error(errorData.message || 'Resim sunucuya iletilemedi');
      }
    } catch (error: any) {
      console.error("Failed to notify server about new gallery image:", error);
      toast({ title: "Resim Eklenemedi", description: error.message || "Yeni resim diğer kullanıcılara iletilirken bir sorun oluştu.", variant: "destructive" });
      // Revert local change if server notification fails
      setGalleryImages(prev => {
        const reverted = prev.filter(img => img.id !== newImage.id);
        localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(reverted));
        return reverted;
      });
      throw error;
    }
  }, [user, toast]);

  const deleteGalleryImage = useCallback(async (id: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim silmek için giriş yapmalısınız.", variant: "destructive" });
      return Promise.reject(new Error("User not logged in"));
    }

    const imageToDelete = galleryImages.find(img => img.id === id);
    if (!imageToDelete) {
      toast({ title: "Hata", description: "Silinecek resim bulunamadı.", variant: "destructive" });
      return Promise.reject(new Error("Image not found"));
    }
    // Optimistic update
    setGalleryImages(prev => {
      const updated = prev.filter(img => img.id !== id);
      localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    try {
      const response = await fetch(`/api/gallery?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        throw new Error(errorData.message || 'Resim silme bilgisi sunucuya iletilemedi');
      }
    } catch (error: any) {
      console.error("Failed to notify server about deleted gallery image:", error);
      toast({ title: "Resim Silinemedi", description: error.message || "Resim silme bilgisi diğer kullanıcılara iletilirken bir sorun oluştu.", variant: "destructive" });
      // Revert local change
      setGalleryImages(prev => {
        const reverted = imageToDelete ? [...prev, imageToDelete].sort(/* define sort if needed */) : prev;
        localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(reverted));
        return reverted;
      });
      throw error;
    }
  }, [user, toast, galleryImages]);

  return { galleryImages, addGalleryImage, deleteGalleryImage, isLoading };
}

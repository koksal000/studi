
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

const GALLERY_LOCAL_STORAGE_KEY = 'camlicaKoyuGallery_localStorage';

const gallerySortFn = (a: GalleryImage, b: GalleryImage): number => {
  const aIsSeed = a.id.startsWith('seed_');
  const bIsSeed = b.id.startsWith('seed_');
  
  if (aIsSeed && !bIsSeed) return -1;
  if (!aIsSeed && bIsSeed) return 1;

  // If both are seeds or both are not seeds, sort by ID (newest first for 'gal_')
  const extractNumericPart = (id: string) => {
    const match = id.match(/\d+$/);
    return match ? parseInt(match[0]) : null;
  };

  const numA = extractNumericPart(a.id);
  const numB = extractNumericPart(b.id);

  if (numA !== null && numB !== null) {
    if (a.id.startsWith('gal_') && b.id.startsWith('gal_')) {
      return numB - numA; // Newest 'gal_' first
    }
    return numA - numB; // Ascending for seeds or mixed if numeric
  }
  
  // Fallback for non-standard IDs or if one is numeric and other is not
  if (a.id.startsWith('gal_') && !b.id.startsWith('gal_')) return -1; // User uploaded before seed
  if (!a.id.startsWith('gal_') && b.id.startsWith('gal_')) return 1;
  
  return b.id.localeCompare(a.id); // Default: newer string IDs first
};


export function useGallery() {
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const galleryImagesRef = useRef(galleryImages); 
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();
  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    galleryImagesRef.current = galleryImages;
  }, [galleryImages]);

  const loadGalleryFromLocalStorage = useCallback(() => {
    setIsLoading(true);
    try {
      const storedGallery = localStorage.getItem(GALLERY_LOCAL_STORAGE_KEY);
      if (storedGallery) {
        const parsed = JSON.parse(storedGallery) as GalleryImage[];
        setGalleryImages(parsed.sort(gallerySortFn));
      } else {
        const seededImages = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFn);
        setGalleryImages(seededImages);
        localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(seededImages));
      }
    } catch (error: any) {
      console.error("Failed to load gallery from localStorage:", error);
      if (error.name === 'QuotaExceededError') {
        toast({
          title: "Yerel Depolama Alanı Dolu",
          description: "Tarayıcınızın yerel depolama alanı dolu olduğu için galeri yüklenemedi.",
          variant: "destructive",
          duration: 7000,
        });
      }
      const seededImagesOnLoadError = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFn);
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
        const sortedData = [...updatedGalleryFromServer].sort(gallerySortFn);
        
        setGalleryImages(sortedData); 

        try {
          localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(sortedData));
        } catch (e: any) {
          if (e.name === 'QuotaExceededError') {
            toast({
              title: "Yerel Depolama Uyarısı",
              description: "Galeri güncellendi, ancak tarayıcı depolama limiti nedeniyle bazı resimler yerel olarak tam kaydedilememiş olabilir. Bu resimler sayfa yenilendiğinde kaybolabilir.",
              variant: "warning",
              duration: 8000,
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

    if (!payload.caption || !payload.imageDataUri) {
        toast({ title: "Eksik Bilgi", description: "Resim verisi veya başlık eksik.", variant: "destructive" });
        return Promise.reject(new Error("Missing image data or caption"));
    }

    const newImageForApi: GalleryImage = {
      id: `gal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      src: payload.imageDataUri, 
      alt: payload.alt || payload.caption,
      caption: payload.caption,
      hint: payload.hint || 'uploaded image',
    };

    const previousGalleryForRevert = [...galleryImagesRef.current]; 
    
    setGalleryImages(prev => [newImageForApi, ...prev].sort(gallerySortFn));

    try {
      const currentGalleryForStorage = [newImageForApi, ...previousGalleryForRevert].sort(gallerySortFn);
      localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(currentGalleryForStorage));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        toast({
          title: "Yerel Depolama Limiti Aşıldı",
          description: "Resim geçici olarak eklendi ancak tarayıcı depolama alanı dolu olduğu için kalıcı olarak kaydedilemedi. Bu resim sayfa yenilendiğinde kaybolabilir.",
          variant: "warning",
          duration: 8000,
        });
      } else {
        console.error("Error saving optimistic gallery to localStorage:", e);
      }
    }

    try {
      const response = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newImageForApi), 
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        let errorMessage = errorData.message || 'Resim sunucuya iletilemedi';
        
        if (response.status === 413) { 
          errorMessage = "Resim yüklenemedi çünkü dosya boyutu sunucu limitlerini aşıyor. Lütfen daha küçük bir resim seçin.";
        }
        
        toast({ title: "Yükleme Başarısız", description: errorMessage, variant: "destructive" });
        
        setGalleryImages(previousGalleryForRevert);
        try {
            localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(previousGalleryForRevert));
        } catch (lsError) {
            console.warn("Could not revert localStorage after API failure:", lsError);
        }
        throw new Error(errorMessage); 
      }
    } catch (error: any) {
      console.error("Failed to send new gallery image to server:", error);
      setGalleryImages(previousGalleryForRevert);
      try {
        localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(previousGalleryForRevert));
      } catch (lsRevertError) {
        console.warn("Error reverting localStorage on API error (general catch):", lsRevertError);
      }
      if (!error.message?.includes("Resim yüklenemedi çünkü dosya boyutu sunucu limitlerini aşıyor") && 
          !error.message?.includes("Resim sunucuya iletilemedi") &&
          !error.message?.includes("Yerel Depolama Limiti Aşıldı") /* Avoid double toast from localStorage catch */
          ) {
         // This path might be for network errors or unexpected issues
         // toast({ title: "Resim Yüklenemedi", description: "Ağ hatası veya beklenmedik bir sorun oluştu.", variant: "destructive" });
      }
      throw error; 
    }
  }, [user, toast]); 

  const deleteGalleryImage = useCallback(async (id: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim silmek için giriş yapmalısınız.", variant: "destructive" });
      return Promise.reject(new Error("User not logged in"));
    }

    const previousGalleryForRevert = [...galleryImagesRef.current];    
    setGalleryImages(prev => prev.filter(img => img.id !== id).sort(gallerySortFn));
    
    try {
        const updatedGalleryForStorage = previousGalleryForRevert.filter(img => img.id !== id).sort(gallerySortFn);
        localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(updatedGalleryForStorage));
    } catch (e: any) {
        console.warn("Error updating localStorage after delete (optimistic):", e);
        if (e.name === 'QuotaExceededError') {
            toast({
                title: "Yerel Depolama Uyarısı",
                description: "Resim silindi ancak tarayıcı depolama alanı dolu olduğu için değişiklik tam kaydedilemedi.",
                variant: "warning",
                duration: 7000,
            });
        }
    }

    try {
      const response = await fetch(`/api/gallery?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        setGalleryImages(previousGalleryForRevert);
        try {
            localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(previousGalleryForRevert));
        } catch (lsError) { /* ignore localStorage error on revert */ }
        
        throw new Error(errorData.message || 'Resim silme bilgisi sunucuya iletilemedi');
      }
    } catch (error: any) {
      console.error("Failed to notify server about deleted gallery image:", error);
      toast({ title: "Resim Silinemedi", description: error.message || "Resim silme bilgisi diğer kullanıcılara iletilirken bir sorun oluştu.", variant: "destructive" });
      
      setGalleryImages(previousGalleryForRevert);
      try {
          localStorage.setItem(GALLERY_LOCAL_STORAGE_KEY, JSON.stringify(previousGalleryForRevert));
      } catch (lsRevertError) { /* ... */ }
      throw error; 
    }
  }, [user, toast]); 

  return { galleryImages, addGalleryImage, deleteGalleryImage, isLoading };
}

    

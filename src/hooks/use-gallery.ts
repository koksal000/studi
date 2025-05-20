
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context'; // For potential auth checks if needed later
import { useToast } from '@/hooks/use-toast';

// Match the interface in src/app/api/gallery/route.ts
export interface GalleryImage {
  id: string;
  src: string; // data URI for uploaded, URL for seeded
  alt: string;
  caption: string;
  hint: string;
}

export type NewGalleryImagePayload = Omit<GalleryImage, 'id'> & { imageDataUri: string };


const GALLERY_KEY = 'camlicaKoyuGallery_api';

export function useGallery() {
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    const fetchInitialGallery = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/gallery');
        if (!response.ok) {
          throw new Error('Failed to fetch gallery images');
        }
        const data: GalleryImage[] = await response.json();
        setGalleryImages(data);
        localStorage.setItem(GALLERY_KEY, JSON.stringify(data));
      } catch (error) {
        console.error("Failed to fetch initial gallery images:", error);
        toast({
          title: "Galeri Yüklenemedi",
          description: "Sunucudan galeri resimleri alınırken bir sorun oluştu.",
          variant: "destructive"
        });
        const storedGallery = localStorage.getItem(GALLERY_KEY);
        if (storedGallery) {
          try {
            setGalleryImages(JSON.parse(storedGallery));
          } catch (e) { console.error("Failed to parse gallery from localStorage", e); }
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialGallery();
  }, [toast]);

  useEffect(() => {
    const eventSource = new EventSource('/api/gallery/stream');

    eventSource.onmessage = (event) => {
      try {
        const updatedGallery: GalleryImage[] = JSON.parse(event.data);
        setGalleryImages(updatedGallery);
        localStorage.setItem(GALLERY_KEY, JSON.stringify(updatedGallery));
      } catch (error) {
          console.error("Error processing gallery SSE message:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error for gallery. EventSource readyState:', eventSource.readyState, 'Event:', error);
      toast({
        title: "Galeri Bağlantı Sorunu",
        description: "Galeri güncellemeleriyle bağlantı kesildi. Otomatik olarak yeniden deneniyor.",
        variant: "destructive"
      });
    };

    return () => {
      eventSource.close();
    };
  }, [toast]); // Added toast to dependency array

  const addGalleryImage = useCallback(async (payload: NewGalleryImagePayload) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim eklemek için giriş yapmalısınız.", variant: "destructive" });
      return;
    }

    try {
      const apiPayload = {
        imageDataUri: payload.imageDataUri,
        caption: payload.caption,
        alt: payload.alt,
        hint: payload.hint,
      };
      const response = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        throw new Error(errorData.message || 'Resim eklenemedi');
      }
    } catch (error: any) {
      console.error("Failed to add gallery image:", error);
      toast({ title: "Resim Eklenemedi", description: error.message || "Resim eklenirken bir sorun oluştu.", variant: "destructive" });
      throw error;
    }
  }, [user, toast]);

  const deleteGalleryImage = useCallback(async (id: string) => {
     if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim silmek için giriş yapmalısınız.", variant: "destructive" });
      return;
    }

    try {
      const response = await fetch(`/api/gallery?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        throw new Error(errorData.message || 'Resim silinemedi');
      }
    } catch (error: any) {
      console.error("Failed to delete gallery image:", error);
      toast({ title: "Resim Silinemedi", description: error.message || "Resim silinirken bir sorun oluştu.", variant: "destructive" });
      throw error;
    }
  }, [user, toast]);

  return { galleryImages, addGalleryImage, deleteGalleryImage, isLoading };
}

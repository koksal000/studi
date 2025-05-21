
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/user-context'; 
import { useToast } from '@/hooks/use-toast';

export interface GalleryImage {
  id: string;
  src: string; 
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
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchInitialGallery = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/gallery', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch gallery images');
      }
      const data: GalleryImage[] = await response.json();
      setGalleryImages(data);
      localStorage.setItem(GALLERY_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to fetch initial gallery images:", error);
      const storedGallery = localStorage.getItem(GALLERY_KEY);
      if (storedGallery) {
        try {
          setGalleryImages(JSON.parse(storedGallery));
        } catch (e) { console.error("Failed to parse gallery from localStorage", e); }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialGallery();
  }, [fetchInitialGallery]);

  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const newEventSource = new EventSource('/api/gallery/stream');
    eventSourceRef.current = newEventSource;

    newEventSource.onmessage = (event) => {
      try {
        const updatedGallery: GalleryImage[] = JSON.parse(event.data);
        setGalleryImages(updatedGallery);
        localStorage.setItem(GALLERY_KEY, JSON.stringify(updatedGallery));
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
      // SSE will handle the update
    } catch (error: any) {
      console.error("Failed to add gallery image:", error);
      toast({ title: "Resim Eklenemedi", description: error.message || "Resim eklenirken bir sorun oluştu.", variant: "destructive" });
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
        throw new Error(errorData.message || 'Resim silinemedi');
      }
      // SSE will handle the update
    } catch (error: any) {
      console.error("Failed to delete gallery image:", error);
      toast({ title: "Resim Silinemedi", description: error.message || "Resim silinirken bir sorun oluştu.", variant: "destructive" });
      throw error;
    }
  }, [user, toast]);

  return { galleryImages, addGalleryImage, deleteGalleryImage, isLoading };
}

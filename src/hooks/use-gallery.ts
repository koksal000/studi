
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { useToast } from './use-toast';
import { STORES, idbGetAll, idbSetAll } from '@/lib/idb';

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

let galleryChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && window.BroadcastChannel) {
  galleryChannel = new BroadcastChannel('gallery-channel');
}

export function useGallery() {
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();
  const { toast } = useToast();

  const syncWithServer = useCallback(async () => {
    try {
      const response = await fetch('/api/gallery');
      if (!response.ok) throw new Error('Galeri resimleri sunucudan alınamadı.');
      const serverData: GalleryImage[] = await response.json();
      await idbSetAll(STORES.gallery, serverData);
      galleryChannel?.postMessage('update');
      return serverData;
    } catch (error: any) {
      console.error("[useGallery] Sync with server failed:", error.message);
      return null;
    }
  }, []);

  useEffect(() => {
    const refreshFromIdb = () => {
      idbGetAll<GalleryImage>(STORES.gallery).then(data => {
        if (data) setGalleryImages(data);
      });
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'update') {
        refreshFromIdb();
      }
    };

    galleryChannel?.addEventListener('message', handleMessage);

    setIsLoading(true);
    idbGetAll<GalleryImage>(STORES.gallery).then((cachedData) => {
      if (cachedData && cachedData.length > 0) {
        setGalleryImages(cachedData);
      }
      syncWithServer().then(serverData => {
        // If cache was empty and server returns data, update state
        if ((!cachedData || cachedData.length === 0) && serverData) {
          setGalleryImages(serverData);
        }
      });
    }).finally(() => setIsLoading(false));

    return () => {
      galleryChannel?.removeEventListener('message', handleMessage);
    };
  }, [syncWithServer]);
  
  const addGalleryImage = useCallback(async (payload: NewGalleryImagePayload) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim eklemek için giriş yapmalısınız.", variant: "destructive" });
      throw new Error("User not logged in");
    }

    const MAX_IMAGE_DATA_URI_LENGTH_HOOK = Math.floor(5 * 1024 * 1024 * 1.37 * 1.05);
    if (payload.imageDataUri.length > MAX_IMAGE_DATA_URI_LENGTH_HOOK) {
        toast({ title: "Resim Verisi Çok Büyük", description: `Resim dosyası çok büyük.`, variant: "destructive", duration: 8000 });
        throw new Error("Image data URI too large.");
    }

    const newImageForApi: GalleryImage = {
      id: `gal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      src: payload.imageDataUri,
      alt: payload.alt?.trim() || payload.caption,
      caption: payload.caption,
      hint: payload.hint?.trim() || 'uploaded image',
    };

    const originalData = [...galleryImages];
    const optimisticData = [newImageForApi, ...originalData];
    setGalleryImages(optimisticData);
    await idbSetAll(STORES.gallery, optimisticData);
    galleryChannel?.postMessage('update');

    try {
      const response = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newImageForApi),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({message: "Bilinmeyen sunucu hatası"}));
        throw new Error(error.message);
      }
      toast({ title: "Yükleme Başarılı", description: "Resim galeriye eklendi." });
      await syncWithServer();

    } catch (error: any) {
      toast({ title: "Yükleme Başarısız", description: error.message, variant: "destructive" });
      setGalleryImages(originalData);
      await idbSetAll(STORES.gallery, originalData);
      galleryChannel?.postMessage('update');
      throw error;
    }
  }, [user, toast, galleryImages, syncWithServer]);

  const deleteGalleryImage = useCallback(async (id: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim silmek için giriş yapmalısınız.", variant: "destructive" });
      throw new Error("User not logged in");
    }
    
    const originalData = [...galleryImages];
    const optimisticData = originalData.filter(img => img.id !== id);
    setGalleryImages(optimisticData);
    await idbSetAll(STORES.gallery, optimisticData);
    galleryChannel?.postMessage('update');
    
    try {
      const response = await fetch(`/api/gallery?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({message: "Bilinmeyen sunucu hatası"}));
        throw new Error(error.message);
      }
      // Toast is handled in the component for user feedback
    } catch (error: any) {
      toast({ title: "Silme Başarısız", description: error.message, variant: "destructive" });
      setGalleryImages(originalData);
      await idbSetAll(STORES.gallery, originalData);
      galleryChannel?.postMessage('update');
      throw error;
    }
  }, [user, toast, galleryImages]);

  return { 
    galleryImages,
    addGalleryImage, 
    deleteGalleryImage, 
    isLoading 
  };
}

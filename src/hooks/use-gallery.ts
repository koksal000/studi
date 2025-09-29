
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { useToast } from './use-toast';
import { broadcastGalleryUpdate } from '@/lib/broadcast-channel';
import { getGalleryFromDB, cacheGalleryToDB } from '@/lib/idb';

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

export function useGallery() {
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();
  const { toast } = useToast();

  const fetchGallery = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/gallery');
      if (!response.ok) {
        throw new Error('Galeri resimleri sunucudan alınamadı.');
      }
      const data: GalleryImage[] = await response.json();

      if (data && data.length > 0) {
        setGalleryImages(data);
        await cacheGalleryToDB(data);
      } else {
        throw new Error('Sunucudan galeri verisi alınamadı. Çevrimdışı veriler deneniyor.');
      }
    } catch (error: any) {
      console.warn("[useGallery] API fetch failed, falling back to IndexedDB.", error.message);
      const dbData = await getGalleryFromDB();
      if (dbData && dbData.length > 0) {
        setGalleryImages(dbData);
        toast({ title: 'Çevrimdışı Mod', description: 'Galeri verileri gösterilemiyor. En son kaydedilenler gösteriliyor.', variant: 'default', duration: 5000 });
      } else {
        toast({ title: 'Galeri Yüklenemedi', description: error.message, variant: 'destructive' });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchGallery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addGalleryImage = useCallback(async (payload: NewGalleryImagePayload) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim eklemek için giriş yapmalısınız.", variant: "destructive" });
      throw new Error("User not logged in");
    }

    const tempId = `gal_temp_${Date.now()}`;
    const optimisticImage: GalleryImage = {
      id: tempId,
      src: payload.imageDataUri,
      alt: payload.alt?.trim() || payload.caption,
      caption: payload.caption,
      hint: payload.hint?.trim() || 'uploaded image',
    };
    const newGalleryState = [optimisticImage, ...galleryImages];
    setGalleryImages(newGalleryState);

    try {
      const response = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Resim sunucuya yüklenemedi.' }));
        throw new Error(errorData.message);
      }
      
      const finalImage: GalleryImage = await response.json();
      const finalGalleryState = newGalleryState.map(img => img.id === tempId ? finalImage : img);
      setGalleryImages(finalGalleryState);
      await cacheGalleryToDB(finalGalleryState);

      toast({ title: "Yükleme Başarılı", description: "Resim galeriye eklendi." });
      broadcastGalleryUpdate();

    } catch (error: any) {
      toast({ title: "Yükleme Başarısız", description: error.message, variant: "destructive" });
      setGalleryImages(currentData => currentData.filter(img => img.id !== tempId));
      throw error;
    }
  }, [user, toast, galleryImages]);

  const deleteGalleryImage = useCallback(async (id: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim silmek için giriş yapmalısınız.", variant: "destructive" });
      throw new Error("User not logged in");
    }
    
    const originalImages = [...galleryImages];
    const optimisticImages = originalImages.filter(img => img.id !== id);
    setGalleryImages(optimisticImages);
    
    try {
      const response = await fetch(`/api/gallery?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Resim silinemedi.' }));
        throw new Error(errorData.message);
      }
      
      await cacheGalleryToDB(optimisticImages);
      toast({ title: "Resim Silindi", description: "Resim galeriden başarıyla kaldırıldı." });
      broadcastGalleryUpdate();

    } catch (error: any) {
      toast({ title: "Silme Başarısız", description: error.message, variant: "destructive" });
      setGalleryImages(originalImages);
      throw error;
    }
  }, [user, toast, galleryImages]);


  // Listen for broadcasted updates from other tabs/components
  useEffect(() => {
    const channel = new BroadcastChannel('gallery_updates');
    const handleMessage = (event: MessageEvent) => {
        if (event.data === 'update') {
            fetchGallery();
        }
    };
    channel.addEventListener('message', handleMessage);

    return () => {
        channel.removeEventListener('message', handleMessage);
        channel.close();
    };
  }, [fetchGallery]);

  return { 
    galleryImages,
    addGalleryImage, 
    deleteGalleryImage, 
    isLoading 
  };
}

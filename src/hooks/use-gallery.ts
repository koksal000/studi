
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { useToast } from './use-toast';
import { broadcastGalleryUpdate } from '@/lib/broadcast-channel';

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
    if (galleryImages.length === 0) {
        setIsLoading(true);
    }
    try {
      const response = await fetch('/api/gallery');
      if (!response.ok) {
        throw new Error('Galeri resimleri sunucudan alınamadı.');
      }
      const data: GalleryImage[] = await response.json();
      setGalleryImages(data);
    } catch (error: any) {
      toast({ title: 'Galeri Yüklenemedi', description: error.message, variant: 'destructive' });
      setGalleryImages([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast, galleryImages.length]);

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
    const newImage: GalleryImage = {
      id: tempId,
      src: payload.imageDataUri,
      alt: payload.alt?.trim() || payload.caption,
      caption: payload.caption,
      hint: payload.hint?.trim() || 'uploaded image',
    };
    setGalleryImages(prev => [newImage, ...prev]);

    try {
      const response = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newImage, id: `gal_${Date.now()}` }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Resim sunucuya yüklenemedi.' }));
        throw new Error(errorData.message);
      }
      
      const finalImage: GalleryImage = await response.json();
      setGalleryImages(currentData => currentData.map(img => img.id === tempId ? finalImage : img));

      toast({ title: "Yükleme Başarılı", description: "Resim galeriye eklendi." });
      broadcastGalleryUpdate();

    } catch (error: any) {
      toast({ title: "Yükleme Başarısız", description: error.message, variant: "destructive" });
      setGalleryImages(currentData => currentData.filter(img => img.id !== tempId));
      throw error;
    }
  }, [user, toast]);

  const deleteGalleryImage = useCallback(async (id: string) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim silmek için giriş yapmalısınız.", variant: "destructive" });
      throw new Error("User not logged in");
    }
    
    const originalImages = [...galleryImages];
    setGalleryImages(prev => prev.filter(img => img.id !== id));
    
    try {
      const response = await fetch(`/api/gallery?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Resim silinemedi.' }));
        throw new Error(errorData.message);
      }
      
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

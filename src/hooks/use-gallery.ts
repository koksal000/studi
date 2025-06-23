
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { useToast } from './use-toast';

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
      setGalleryImages(data);
    } catch (error: any) {
      toast({ title: 'Galeri Yüklenemedi', description: error.message, variant: 'destructive' });
      setGalleryImages([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  const addGalleryImage = useCallback(async (payload: NewGalleryImagePayload) => {
    if (!user) {
      toast({ title: "Giriş Gerekli", description: "Resim eklemek için giriş yapmalısınız.", variant: "destructive" });
      throw new Error("User not logged in");
    }

    const newImage: GalleryImage = {
      id: `gal_temp_${Date.now()}`,
      src: payload.imageDataUri,
      alt: payload.alt?.trim() || payload.caption,
      caption: payload.caption,
      hint: payload.hint?.trim() || 'uploaded image',
    };

    const originalImages = [...galleryImages];
    setGalleryImages(prev => [newImage, ...prev]);

    try {
      const response = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newImage, id: `gal_${Date.now()}` }), // Use real ID for server
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Resim sunucuya yüklenemedi.' }));
        throw new Error(errorData.message);
      }
      
      toast({ title: "Yükleme Başarılı", description: "Resim galeriye eklendi." });
      await fetchGallery(); // Refetch to get final data
    } catch (error: any) {
      toast({ title: "Yükleme Başarısız", description: error.message, variant: "destructive" });
      setGalleryImages(originalImages);
      throw error;
    }
  }, [user, toast, galleryImages, fetchGallery]);

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
      
      toast({ title: "Resim Silindi", description: "Resim galeriden başarıyla kaldırıldı." });
      // No need to refetch, UI is already updated
    } catch (error: any) {
      toast({ title: "Silme Başarısız", description: error.message, variant: "destructive" });
      setGalleryImages(originalImages);
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

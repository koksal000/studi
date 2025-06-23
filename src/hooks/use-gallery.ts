
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

const MAX_IMAGE_DATA_URI_LENGTH_HOOK = Math.floor(5 * 1024 * 1024 * 1.37 * 1.05); // Approx 7.2MB for 5MB raw image

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
      const err = new Error("User not logged in");
      toast({ title: "Giriş Gerekli", description: "Resim eklemek için giriş yapmalısınız.", variant: "destructive" });
      throw err;
    }

    if (!payload || !payload.imageDataUri || !payload.caption?.trim()) {
        const err = new Error("Invalid payload: Missing imageDataUri or caption.");
        toast({ title: "Geçersiz Yükleme Verisi", description: "Resim verisi veya başlık eksik.", variant: "destructive" });
        throw err;
    }

    if (payload.imageDataUri.length > MAX_IMAGE_DATA_URI_LENGTH_HOOK) {
        const err = new Error("Image data URI too large.");
        toast({ title: "Resim Verisi Çok Büyük", description: `Resim dosyası çok büyük.`, variant: "destructive", duration: 8000 });
        throw err;
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
        throw new Error(errorData.message);
      }
      
      toast({ title: "Yükleme Başarılı", description: "Resim galeriye eklendi." });
      await fetchGallery(); // Refetch after successful add

    } catch (error: any) {
        const rawErrorMessage = error.message || 'Bilinmeyen bir sunucu hatası oluştu.';
        toast({ title: "Yükleme Başarısız", description: rawErrorMessage, variant: "destructive" });
        
        const sanitizedError = new Error(String(rawErrorMessage).replace(/[^\x00-\x7F]/g, ""));
        sanitizedError.stack = error.stack;
        throw sanitizedError;
    }
  }, [user, toast, fetchGallery]);

  const deleteGalleryImage = useCallback(async (id: string) => {
    if (!user) {
        const err = new Error("User not logged in");
        toast({ title: "Giriş Gerekli", description: "Resim silmek için giriş yapmalısınız.", variant: "destructive" });
        throw err;
    }

    try {
      const response = await fetch(`/api/gallery?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen sunucu hatası' }));
        throw new Error(errorData.message);
      }
      
      toast({ title: "Resim Silindi", description: "Resim galeriden başarıyla kaldırıldı." });
      await fetchGallery(); // Refetch after successful delete

    } catch (error: any) {
        const rawErrorMessage = error.message || 'Bilinmeyen bir sunucu hatası oluştu.';
        toast({ title: "Silme Başarısız", description: rawErrorMessage, variant: "destructive" });

        const sanitizedError = new Error(String(rawErrorMessage).replace(/[^\x00-\x7F]/g, ""));
        sanitizedError.stack = error.stack;
        throw sanitizedError;
    }
  }, [user, toast, fetchGallery]);

  return { 
    galleryImages,
    addGalleryImage, 
    deleteGalleryImage, 
    isLoading 
  };
}


"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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

export function useGallery() {
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();
  const { toast } = useToast();
  const isSyncing = useRef(false);

  const syncWithServer = useCallback(async () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    
    try {
      const response = await fetch('/api/gallery');
      if (!response.ok) throw new Error('Galeri resimleri sunucudan alınamadı.');
      const serverData: GalleryImage[] = await response.json();
      setGalleryImages(serverData);
      await idbSetAll(STORES.gallery, serverData);
    } catch (error: any) {
      toast({ title: 'Galeri Senkronizasyon Hatası', description: error.message, variant: 'destructive' });
    } finally {
      isSyncing.current = false;
    }
  }, [toast]);
  
  useEffect(() => {
    const loadFromCacheAndSync = async () => {
      setIsLoading(true);
      const cachedData = await idbGetAll<GalleryImage>(STORES.gallery);
      if (cachedData && cachedData.length > 0) {
        setGalleryImages(cachedData);
      }
      setIsLoading(false);
      await syncWithServer();
    };

    loadFromCacheAndSync();
  }, [syncWithServer]);
  
  const performApiAction = useCallback(async (
    endpoint: string, 
    method: 'POST' | 'DELETE', 
    body?: any,
    successToast?: { title: string; description?: string }
  ) => {
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
        throw new Error(errorData.message);
      }
      
      if (successToast) toast(successToast);
      await syncWithServer();
    } catch (error: any) {
      const rawErrorMessage = error.message || 'Bilinmeyen bir ağ hatası oluştu.';
      toast({ title: 'İşlem Başarısız', description: rawErrorMessage, variant: 'destructive' });
      throw new Error(String(rawErrorMessage).replace(/[^\x00-\x7F]/g, ""));
    }
  }, [toast, syncWithServer]);

  const addGalleryImage = useCallback(async (payload: NewGalleryImagePayload) => {
    if (!user) {
        toast({ title: "Giriş Gerekli", description: "Resim eklemek için giriş yapmalısınız.", variant: "destructive" });
        throw new Error("User not logged in");
    }
    
    // Validation
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
    
    await performApiAction('/api/gallery', 'POST', newImageForApi, { title: "Yükleme Başarılı", description: "Resim galeriye eklendi." });
  }, [user, toast, performApiAction]);

  const deleteGalleryImage = useCallback(async (id: string) => {
    if (!user) {
        toast({ title: "Giriş Gerekli", description: "Resim silmek için giriş yapmalısınız.", variant: "destructive" });
        throw new Error("User not logged in");
    }
    await performApiAction(`/api/gallery?id=${id}`, 'DELETE', undefined, { title: "Resim Silindi", description: "Resim galeriden başarıyla kaldırıldı." });
  }, [user, toast, performApiAction]);

  return { 
    galleryImages,
    addGalleryImage, 
    deleteGalleryImage, 
    isLoading 
  };
}

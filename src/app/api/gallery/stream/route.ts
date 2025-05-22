
// src/app/api/gallery/stream/route.ts
import { NextResponse } from 'next/server';
import type { GalleryImage } from '../route'; 
import galleryEmitter from '@/lib/gallery-emitter';
import { STATIC_GALLERY_IMAGES_FOR_SEEDING } from '@/lib/constants'; // Import for fallback

export const dynamic = 'force-dynamic';

const gallerySortFnStream = (a: GalleryImage, b: GalleryImage): number => {
  const aIsSeed = a.id.startsWith('seed_');
  const bIsSeed = b.id.startsWith('seed_');

  if (aIsSeed && !bIsSeed) return -1;
  if (!aIsSeed && bIsSeed) return 1;
  
  const extractNumericPart = (id: string) => {
    const match = id.match(/\d+$/); 
    return match ? parseInt(match[0]) : null;
  };

  const numA = extractNumericPart(a.id);
  const numB = extractNumericPart(b.id);

  if (numA !== null && numB !== null) {
    if (a.id.startsWith('gal_') && b.id.startsWith('gal_')) {
      return numB - numA; 
    }
     if (a.id.startsWith('seed_') && b.id.startsWith('seed_')) {
      return numA - numB; 
    }
  }
  
  if (a.id.startsWith('gal_') && b.id.startsWith('seed_')) return -1; 
  if (a.id.startsWith('seed_') && b.id.startsWith('gal_')) return 1;
  
  return a.id.localeCompare(b.id);
};


export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

  if (process.env.NODE_ENV === 'production' && appUrl.startsWith('http://localhost')) {
    console.warn(
      '[SSE Galeri Akışı] UYARI: NEXT_PUBLIC_APP_URL üretim için ayarlanmamış veya yanlış yapılandırılmış. '+
      'Bu URL kendi API\'sini çağırmak için kullanılıyorsa, SSE akışı ilk veriyi çekmede başarısız olabilir. '+
      'Mevcut appUrl (dahili fetch için):', appUrl
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (data: GalleryImage[]) => {
        try {
          if (controller.desiredSize === null || controller.desiredSize <= 0) {
            galleryEmitter.off('update', sendUpdate); 
            return;
          }
          const sortedData = [...data].sort(gallerySortFnStream);
          controller.enqueue(`data: ${JSON.stringify(sortedData)}\n\n`);
        } catch (e: any) {
            console.error("[SSE Galeri] Veri kuyruğa eklenirken akış hatası:", e.message);
            try {
              if (controller.desiredSize !== null && controller.desiredSize > 0) { 
                controller.error(new Error(`SSE akış hatası (enqueue): ${e.message}`));
              }
            } catch (closeErr) {
                 console.error("[SSE Galeri] Kuyruk hatası sonrası controller hatası sinyali verilirken hata:", closeErr);
            }
            galleryEmitter.off('update', sendUpdate); 
        }
      };

      try {
        const response = await fetch(new URL('/api/gallery', appUrl), { cache: 'no-store' });
        if (!response.ok) {
            const errorBody = await response.text().catch(() => "Bilinmeyen sunucu hatası");
            const errorMsg = `SSE Galeri Akışı: İlk galeri resimleri ${response.url} adresinden alınamadı: ${response.status} ${response.statusText}. Gövde: ${errorBody}`;
            console.error(errorMsg);
            // Fallback to static seeds if API fails to provide initial data
            sendUpdate([...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFnStream));
            if (controller.desiredSize !== null && controller.desiredSize > 0) {
              controller.error(new Error(errorMsg + " Statik veriler kullanıldı.")); // Signal error but send static
            }
            // Do not return here, continue to set up listener for future updates if API recovers
        } else {
            const initialGalleryImages: GalleryImage[] = await response.json();
             if (initialGalleryImages && Array.isArray(initialGalleryImages) && initialGalleryImages.length > 0) {
                 sendUpdate(initialGalleryImages);
            } else { // API returned empty or invalid, use static seeds
                 console.warn("[SSE Galeri] API'den boş veya geçersiz galeri verisi alındı, statik tohumlama verileri kullanılıyor.");
                 sendUpdate([...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFnStream));
            }
        }
      } catch(e: any) {
          const fetchErrorMsg = `SSE Galeri Akışı: İlk galeri resimlerini alırken veya işlerken hata: ${e.message}`;
          console.error(fetchErrorMsg, e); 
          sendUpdate([...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFnStream)); // Fallback in case of fetch error
          try {
            if (controller.desiredSize !== null && controller.desiredSize > 0) { 
              controller.error(new Error(fetchErrorMsg + " Statik veriler kullanıldı."));
            }
          } catch (closeError) {
            console.error("SSE Galeri Akışı: Fetch hatası sonrası controller hatası sinyali verilirken hata:", closeError);
          }
          // Do not remove listener, let it try for future updates
      }

      galleryEmitter.on('update', sendUpdate);

      controller.signal.addEventListener('abort', () => {
        galleryEmitter.off('update', sendUpdate);
      });
    },
     cancel() {
        // As above, sendUpdate handles its own cleanup.
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

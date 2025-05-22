
// src/app/api/announcements/stream/route.ts
import { NextResponse } from 'next/server';
import type { Announcement } from '@/hooks/use-announcements';
import announcementEmitter from '@/lib/announcement-emitter';

export const dynamic = 'force-dynamic'; 

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

  if (process.env.NODE_ENV === 'production' && appUrl.startsWith('http://localhost')) {
    console.warn(
      '[SSE Announcements Stream] UYARI: NEXT_PUBLIC_APP_URL üretim için ayarlanmamış veya yanlış yapılandırılmış. '+
      'Bu URL kendi API\'sini çağırmak için kullanılıyorsa, SSE akışı ilk veriyi çekmede başarısız olabilir. '+
      'Mevcut appUrl (dahili fetch için):', appUrl
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (data: Announcement[]) => {
        try {
          if (controller.desiredSize === null || controller.desiredSize <= 0) {
            announcementEmitter.off('update', sendUpdate); 
            return;
          }
          const sortedData = [...data].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          controller.enqueue(`data: ${JSON.stringify(sortedData)}\n\n`);
        } catch (e: any) {
            console.error("[SSE Announcements] Veri kuyruğa eklenirken akış hatası:", e.message);
            try {
              if (controller.desiredSize !== null && controller.desiredSize > 0) { 
                controller.error(new Error(`SSE akış hatası (enqueue): ${e.message}`));
              }
            } catch (closeErr) {
                 console.error("[SSE Announcements] Kuyruk hatası sonrası controller hatası sinyali verilirken hata:", closeErr);
            }
            announcementEmitter.off('update', sendUpdate); 
        }
      };
      
      try {
        const response = await fetch(new URL('/api/announcements', appUrl), { cache: 'no-store' });
        if (!response.ok) {
            const errorBody = await response.text().catch(() => "Bilinmeyen sunucu hatası");
            const errorMsg = `SSE Duyuru Akışı: İlk duyurular ${response.url} adresinden alınamadı: ${response.status} ${response.statusText}. Gövde: ${errorBody}`;
            console.error(errorMsg); 
            if (controller.desiredSize !== null && controller.desiredSize > 0) {
                 controller.error(new Error(errorMsg));
            }
            return; 
        }
        const initialAnnouncements: Announcement[] = await response.json();
        if (initialAnnouncements && Array.isArray(initialAnnouncements)) {
             sendUpdate(initialAnnouncements);
        } else if (!initialAnnouncements) {
             sendUpdate([]); 
        }
      } catch(e: any) {
          const fetchErrorMsg = `SSE Duyuru Akışı: İlk duyuruları alırken veya işlerken hata: ${e.message}`;
          console.error(fetchErrorMsg, e); 
          try {
            if (controller.desiredSize !== null && controller.desiredSize > 0) { 
              controller.error(new Error(fetchErrorMsg));
            }
          } catch (closeError) {
            console.error("SSE Duyuru Akışı: Fetch hatası sonrası controller hatası sinyali verilirken hata:", closeError);
          }
          announcementEmitter.off('update', sendUpdate); 
          return;
      }

      announcementEmitter.on('update', sendUpdate);

      controller.signal.addEventListener('abort', () => {
        announcementEmitter.off('update', sendUpdate);
      });
    },
    cancel() {
        // This might not be strictly necessary if sendUpdate already cleans up,
        // but good practice if there's a direct way to remove listeners bound to sendUpdate
        // For simplicity, the current sendUpdate handles its own cleanup.
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

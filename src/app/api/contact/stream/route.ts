
// src/app/api/contact/stream/route.ts
import { NextResponse } from 'next/server';
import type { ContactMessage } from '../route'; 
import contactEmitter from '@/lib/contact-emitter';

export const dynamic = 'force-dynamic';

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

  if (process.env.NODE_ENV === 'production' && appUrl.startsWith('http://localhost')) {
    console.warn(
      '[SSE İletişim Akışı] UYARI: NEXT_PUBLIC_APP_URL üretim için ayarlanmamış veya yanlış yapılandırılmış. '+
      'Bu URL kendi API\'sini çağırmak için kullanılıyorsa, SSE akışı ilk veriyi çekmede başarısız olabilir. '+
      'Mevcut appUrl (dahili fetch için):', appUrl
    );
  }
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (data: ContactMessage[]) => {
        try {
           if (controller.desiredSize === null || controller.desiredSize <= 0) {
            contactEmitter.off('update', sendUpdate);
            return;
          }
          const sortedData = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          controller.enqueue(`data: ${JSON.stringify(sortedData)}\n\n`);
        } catch (e: any) {
            console.error("[SSE İletişim] Veri kuyruğa eklenirken akış hatası:", e.message);
            try {
              if (controller.desiredSize !== null && controller.desiredSize > 0) { 
                controller.error(new Error(`SSE akış hatası (enqueue): ${e.message}`));
              }
            } catch (closeErr) {
              console.error("[SSE İletişim] Kuyruk hatası sonrası controller hatası sinyali verilirken hata:", closeErr);
            }
            contactEmitter.off('update', sendUpdate); 
        }
      };

      try {
        const response = await fetch(new URL('/api/contact', appUrl), { cache: 'no-store' });
        if (!response.ok) {
            const errorBody = await response.text().catch(() => "Bilinmeyen sunucu hatası");
            const errorMsg = `SSE İletişim Akışı: İlk iletişim mesajları ${response.url} adresinden alınamadı: ${response.status} ${response.statusText}. Gövde: ${errorBody}`;
            console.error(errorMsg);
            if (controller.desiredSize !== null && controller.desiredSize > 0) {
                controller.error(new Error(errorMsg));
            }
            return; 
        }
        const initialMessages: ContactMessage[] = await response.json();
        if (initialMessages && Array.isArray(initialMessages)) {
             sendUpdate(initialMessages);
        } else if (!initialMessages) {
             sendUpdate([]); 
        }
      } catch(e: any) {
        const fetchErrorMsg = `SSE İletişim Akışı: İlk iletişim mesajlarını alırken veya işlerken hata: ${e.message}`;
        console.error(fetchErrorMsg, e);
        try {
          if (controller.desiredSize !== null && controller.desiredSize > 0) { 
            controller.error(new Error(fetchErrorMsg));
          }
        } catch (closeError) {
          console.error("SSE İletişim Akışı: Fetch hatası sonrası controller hatası sinyali verilirken hata:", closeError);
        }
        contactEmitter.off('update', sendUpdate);
        return; 
      }

      contactEmitter.on('update', sendUpdate);

      controller.signal.addEventListener('abort', () => {
        contactEmitter.off('update', sendUpdate);
      });
    },
    cancel() {
      // As above
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

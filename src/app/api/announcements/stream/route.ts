
// src/app/api/announcements/stream/route.ts
import { NextResponse } from 'next/server';
import type { Announcement } from '@/hooks/use-announcements';
import announcementEmitter from '@/lib/announcement-emitter';

export const dynamic = 'force-dynamic'; // Ensures this route is not statically optimized

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

  // Removed Vercel-specific warning about NEXT_PUBLIC_APP_URL as user is deploying to Render
  // if (process.env.NODE_ENV === 'production' && appUrl.startsWith('http://localhost')) {
  //   console.warn(
  //     '[SSE Announcements Stream] WARNING: NEXT_PUBLIC_APP_URL is not set or is misconfigured for production. '+
  //     'The SSE stream may fail to fetch initial data if it relies on this URL to call its own API. '+
  //     'Current appUrl for internal fetch:', appUrl
  //   );
  // }

  const stream = new ReadableStream({
    start(controller) {
      const sendUpdate = (data: Announcement[]) => {
        try {
          // Check if controller is still usable before enqueuing
          if (controller.desiredSize === null || controller.desiredSize <= 0) {
            // console.warn("[SSE Announcements] Controller is not in a state to enqueue (stream likely closing or closed). Aborting sendUpdate and removing listener.");
            announcementEmitter.off('update', sendUpdate); // Clean up listener
            return;
          }
          // Sort by date descending before sending
          const sortedData = [...data].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          controller.enqueue(`data: ${JSON.stringify(sortedData)}\n\n`);
        } catch (e: any) {
            console.error("[SSE Announcements] Error enqueuing data to stream:", e.message, e.stack);
            try {
              if (controller.desiredSize !== null && controller.desiredSize > 0) { 
                controller.error(new Error(`SSE stream error while enqueuing data: ${e.message}`));
              }
            } catch (closeErr) {
                 console.error("[SSE Announcements] Error trying to signal controller error after enqueue failure:", closeErr);
            }
            announcementEmitter.off('update', sendUpdate); 
        }
      };
      
      fetch(new URL('/api/announcements', appUrl), { cache: 'no-store' })
        .then(res => {
            if (!res.ok) {
                const errorMsg = `SSE Announcements Stream: Failed to fetch initial announcements from ${res.url}: ${res.status} ${res.statusText}`;
                console.error(errorMsg); 
                throw new Error(errorMsg); 
            }
            return res.json();
        })
        .then((initialAnnouncements: Announcement[]) => {
            if (initialAnnouncements && Array.isArray(initialAnnouncements)) {
                 sendUpdate(initialAnnouncements);
            } else if (!initialAnnouncements) {
                 sendUpdate([]); 
            }
        }).catch(e => {
            console.error("SSE Announcements: Error during initial announcements fetch or processing:", e.message); 
            try {
              if (controller.desiredSize !== null && controller.desiredSize > 0) { 
                controller.error(new Error(`Failed to initialize announcements stream: Could not fetch initial data. Server error: ${e.message}`));
              }
            } catch (closeError) {
              console.error("SSE Announcements: Error trying to signal controller error after fetch failure:", closeError);
            }
            announcementEmitter.off('update', sendUpdate); 
        });


      announcementEmitter.on('update', sendUpdate);

      controller.signal.addEventListener('abort', () => {
        // console.log("SSE announcements client disconnected (abort signal). Removing listener.");
        announcementEmitter.off('update', sendUpdate);
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}


// src/app/api/gallery/stream/route.ts
import { NextResponse } from 'next/server';
import type { GalleryImage } from '../route'; // Assuming GalleryImage is exported from ../route
import galleryEmitter from '@/lib/gallery-emitter';

export const dynamic = 'force-dynamic';

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

  if (process.env.NODE_ENV === 'production' && appUrl.startsWith('http://localhost')) {
    console.warn(
      '[SSE Gallery Stream] WARNING: NEXT_PUBLIC_APP_URL is not set or is misconfigured for production. '+
      'The SSE stream may fail to fetch initial data if it relies on this URL to call its own API. '+
      'Current appUrl for internal fetch:', appUrl
    );
  }

  const stream = new ReadableStream({
    start(controller) {
      const sendUpdate = (data: GalleryImage[]) => {
        try {
          // Check if controller is still usable before enqueuing
          if (controller.desiredSize === null || controller.desiredSize <= 0) {
            console.warn("SSE Gallery: Controller is not in a state to enqueue (stream likely closing or closed). Aborting sendUpdate.");
            galleryEmitter.off('update', sendUpdate); // Clean up listener
            return;
          }
          const sortedData = [...data].sort((a,b) => {
            if (a.id.startsWith('seed_') && !b.id.startsWith('seed_')) return -1;
            if (!a.id.startsWith('seed_') && b.id.startsWith('seed_')) return 1;
            // Fallback to sorting by caption if ID prefixes are the same or both are not seeds
            // This ensures a consistent order for non-seed items as well.
            const idCompare = a.id.localeCompare(b.id); // Added for more stable sort with dynamic IDs
            return idCompare === 0 ? a.caption.localeCompare(b.caption) : idCompare;
          });
          controller.enqueue(`data: ${JSON.stringify(sortedData)}\n\n`);
        } catch (e: any) {
            console.error("SSE Gallery: Error enqueuing data to stream:", e.message, e.stack);
            try {
              if (controller.desiredSize !== null) { 
                controller.error(new Error(`SSE stream error while enqueuing data: ${e.message}`));
              }
            } catch (closeErr) {
                 console.error("SSE Gallery: Error trying to signal controller error after enqueue failure:", closeErr);
            }
            galleryEmitter.off('update', sendUpdate);
        }
      };

      let initialFetchFailed = false;

      fetch(new URL('/api/gallery', appUrl), { cache: 'no-store' }) // Added cache: 'no-store'
        .then(res => {
            if (!res.ok) {
                const errorMsg = `Failed to fetch initial gallery images from ${res.url}: ${res.status} ${res.statusText}`;
                console.error("SSE Gallery Stream Init Error:", errorMsg);
                throw new Error(errorMsg);
            }
            return res.json();
        })
        .then((initialGalleryImages: GalleryImage[]) => {
            if (initialGalleryImages && Array.isArray(initialGalleryImages)) {
                 sendUpdate(initialGalleryImages);
            } else if (!initialGalleryImages) {
                 sendUpdate([]);
            }
        }).catch(e => {
            console.error("SSE Gallery: Error during initial images fetch or processing:", e.message);
            initialFetchFailed = true;
            try {
              if (controller.desiredSize !== null) { 
                controller.error(new Error(`Failed to initialize gallery stream: Could not fetch initial data. Server error: ${e.message}`));
              }
            } catch (closeError) {
              console.error("SSE Gallery: Error trying to signal controller error after fetch failure:", closeError);
            }
            galleryEmitter.off('update', sendUpdate);
        });


      galleryEmitter.on('update', sendUpdate);

      return function cancel() {
        console.log("SSE gallery client disconnected. Removing listener.");
        galleryEmitter.off('update', sendUpdate);
      };
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

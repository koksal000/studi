
// src/app/api/gallery/stream/route.ts
import { NextResponse } from 'next/server';
import type { GalleryImage } from '../route'; // Assuming GalleryImage is exported from ../route
import galleryEmitter from '@/lib/gallery-emitter';

export const dynamic = 'force-dynamic';

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

  // Removed Vercel-specific warning about NEXT_PUBLIC_APP_URL as user is deploying to Render
  // if (process.env.NODE_ENV === 'production' && appUrl.startsWith('http://localhost')) {
  //   console.warn(
  //     '[SSE Gallery Stream] WARNING: NEXT_PUBLIC_APP_URL is not set or is misconfigured for production. '+
  //     'The SSE stream may fail to fetch initial data if it relies on this URL to call its own API. '+
  //     'Current appUrl for internal fetch:', appUrl
  //   );
  // }

  const stream = new ReadableStream({
    start(controller) {
      const sendUpdate = (data: GalleryImage[]) => {
        try {
          // Check if controller is still usable before enqueuing
          if (controller.desiredSize === null || controller.desiredSize <= 0) {
            // console.warn("[SSE Gallery] Controller is not in a state to enqueue (stream likely closing or closed). Aborting sendUpdate and removing listener.");
            galleryEmitter.off('update', sendUpdate); // Clean up listener
            return;
          }
          const sortedData = [...data].sort((a,b) => {
            if (a.id.startsWith('seed_') && !b.id.startsWith('seed_')) return -1;
            if (!a.id.startsWith('seed_') && b.id.startsWith('seed_')) return 1;
            // Fallback sort by id if both are seed or both are not seed
            // If you want user-uploaded images to appear first (after seeds), you might need a timestamp
            // For now, this keeps seeds first, then sorts by id.
            const idA = a.id.replace(/^(seed_|gal_)/, '');
            const idB = b.id.replace(/^(seed_|gal_)/, '');
            if (isNaN(parseInt(idA)) || isNaN(parseInt(idB))) { // if ids are not purely numeric after prefix removal
                return a.id.localeCompare(b.id);
            }
            return parseInt(idB) - parseInt(idA); // Sort by numeric part of ID descending for non-seeds
          });
          controller.enqueue(`data: ${JSON.stringify(sortedData)}\n\n`);
        } catch (e: any) {
            console.error("[SSE Gallery] Error enqueuing data to stream:", e.message, e.stack);
            try {
              if (controller.desiredSize !== null && controller.desiredSize > 0) { 
                controller.error(new Error(`SSE stream error while enqueuing data: ${e.message}`));
              }
            } catch (closeErr) {
                 console.error("[SSE Gallery] Error trying to signal controller error after enqueue failure:", closeErr);
            }
            galleryEmitter.off('update', sendUpdate);
        }
      };

      fetch(new URL('/api/gallery', appUrl), { cache: 'no-store' })
        .then(res => {
            if (!res.ok) {
                const errorMsg = `SSE Gallery Stream: Failed to fetch initial gallery images from ${res.url}: ${res.status} ${res.statusText}`;
                console.error(errorMsg);
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
            try {
              if (controller.desiredSize !== null && controller.desiredSize > 0) { 
                controller.error(new Error(`Failed to initialize gallery stream: Could not fetch initial data. Server error: ${e.message}`));
              }
            } catch (closeError) {
              console.error("SSE Gallery: Error trying to signal controller error after fetch failure:", closeError);
            }
            galleryEmitter.off('update', sendUpdate);
        });


      galleryEmitter.on('update', sendUpdate);

      controller.signal.addEventListener('abort', () => {
        // console.log("SSE gallery client disconnected (abort signal). Removing listener.");
        galleryEmitter.off('update', sendUpdate);
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

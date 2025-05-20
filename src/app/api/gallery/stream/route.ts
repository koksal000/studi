
// src/app/api/gallery/stream/route.ts
import { NextResponse } from 'next/server';
import type { GalleryImage } from '../route'; // Assuming GalleryImage is exported from ../route
import galleryEmitter from '@/lib/gallery-emitter';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const sendUpdate = (data: GalleryImage[]) => {
        try {
          // Sort by caption or some other logic if needed before sending
          const sortedData = [...data].sort((a,b) => {
            if (a.id.startsWith('seed_') && !b.id.startsWith('seed_')) return -1;
            if (!a.id.startsWith('seed_') && b.id.startsWith('seed_')) return 1;
            return a.caption.localeCompare(b.caption);
          });
          controller.enqueue(`data: ${JSON.stringify(sortedData)}\n\n`);
        } catch (e) {
            console.error("Error enqueuing data to gallery SSE stream:", e);
            // Attempt to close the controller if an error occurs during enqueueing
            try {
              if (controller.desiredSize !== null) { // Check if not already closed/errored
                controller.close();
              }
            } catch (_) {}
            galleryEmitter.off('update', sendUpdate);
        }
      };

      // Fetching from the main API route to get the current state
      // Ensure NEXT_PUBLIC_APP_URL is set in your .env for production/Vercel
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
      let initialFetchFailed = false;

      fetch(new URL('/api/gallery', appUrl))
        .then(res => {
            if (!res.ok) {
                // Log detailed error for server-side debugging
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
                 // Handle case where API returns valid but empty/nullish response
                 sendUpdate([]);
            }
        }).catch(e => {
            console.error("SSE Gallery: Error during initial images fetch or processing:", e.message);
            initialFetchFailed = true;
            // Explicitly signal an error to the client's EventSource
            try {
              if (controller.desiredSize !== null) { // Check if not already closed/errored
                controller.error(new Error("Failed to initialize gallery stream: Could not fetch initial data."));
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


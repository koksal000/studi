
// src/app/api/announcements/stream/route.ts
import { NextResponse } from 'next/server';
import type { Announcement } from '@/hooks/use-announcements';
import announcementEmitter from '@/lib/announcement-emitter';

// This is a simplified in-memory store of active SSE stream controllers.
// It's crucial to handle disconnections properly to avoid memory leaks.
// Note: This approach is best suited for single-instance server environments.
// For serverless or multi-instance deployments, a dedicated pub/sub system (like Redis)
// would be more robust for broadcasting messages to all connected clients.

export const dynamic = 'force-dynamic'; // Ensures this route is not statically optimized

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const sendUpdate = (data: Announcement[]) => {
        try {
          // Sort by date descending before sending
          const sortedData = [...data].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          controller.enqueue(`data: ${JSON.stringify(sortedData)}\n\n`);
        } catch (e) {
            console.error("Error enqueuing data to SSE stream:", e);
            // Potentially close the connection if there's an issue with the controller
            try { 
              if (controller.desiredSize !== null) { // Check if not already closed/errored
                controller.close(); 
              }
            } catch (_) {}
            announcementEmitter.off('update', sendUpdate); // Clean up listener
        }
      };

      // Send the current list of announcements immediately on connection
      // Fetching from the main API route to get the current state
      // Ensure NEXT_PUBLIC_APP_URL is set in your .env for production/Vercel
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
      let initialFetchFailed = false;

      fetch(new URL('/api/announcements', appUrl))
        .then(res => {
            if (!res.ok) {
                const errorMsg = `Failed to fetch initial announcements from ${res.url}: ${res.status} ${res.statusText}`;
                console.error("SSE Announcements Stream Init Error:", errorMsg);
                throw new Error(errorMsg); // This will be caught by the .catch block
            }
            return res.json();
        })
        .then((initialAnnouncements: Announcement[]) => {
            if (initialAnnouncements && Array.isArray(initialAnnouncements)) {
                 sendUpdate(initialAnnouncements);
            } else if (!initialAnnouncements) {
                 sendUpdate([]); // Send empty array if response is valid but nullish
            }
        }).catch(e => {
            console.error("SSE Announcements: Error during initial announcements fetch or processing:", e.message);
            initialFetchFailed = true;
            // Explicitly signal an error to the client's EventSource
            try {
              if (controller.desiredSize !== null) { // Check if not already closed/errored
                controller.error(new Error("Failed to initialize announcements stream: Could not fetch initial data."));
              }
            } catch (closeError) {
              console.error("SSE Announcements: Error trying to signal controller error after fetch failure:", closeError);
            }
            // No need to call controller.close() here as controller.error() does that.
            announcementEmitter.off('update', sendUpdate); // Clean up listener if fetch failed
        });


      announcementEmitter.on('update', sendUpdate);

      // Cleanup when client disconnects
      // Note: `req.on('close', ...)` is not available in Next.js App Router Edge/Node.js runtimes directly.
      // The ReadableStream's `cancel` method is the standard way to handle client disconnections.
      return function cancel() {
        console.log("SSE announcements client disconnected. Removing listener.");
        announcementEmitter.off('update', sendUpdate);
      };
    },
    // cancel(reason) { // This is implicitly handled by the return function in `start` for cleanup
    //   console.log("SSE stream cancelled by client:", reason);
    // }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      // Optional: CORS headers if your client is on a different domain
      // 'Access-Control-Allow-Origin': '*', 
    },
  });
}


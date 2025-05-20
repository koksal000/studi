// src/app/api/contact/stream/route.ts
import { NextResponse } from 'next/server';
import type { ContactMessage } from '../route'; // Adjust path if needed
import contactEmitter from '@/lib/contact-emitter';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const sendUpdate = (data: ContactMessage[]) => {
        try {
          // Data is already sorted by the API route, but good practice to ensure here too
          const sortedData = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          controller.enqueue(`data: ${JSON.stringify(sortedData)}\n\n`);
        } catch (e) {
            console.error("Error enqueuing data to contact SSE stream:", e);
            try {
              if (controller.desiredSize !== null) { // Check if not already closed/errored
                controller.close();
              }
            } catch (_) {}
            contactEmitter.off('update', sendUpdate); // Clean up listener on error
        }
      };

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
      fetch(new URL('/api/contact', appUrl))
        .then(res => {
            if (!res.ok) {
                const errorMsg = `Failed to fetch initial contact messages from ${res.url}: ${res.status} ${res.statusText}`;
                console.error("SSE Contact Stream Init Error:", errorMsg);
                throw new Error(errorMsg);
            }
            return res.json();
        })
        .then((initialMessages: ContactMessage[]) => {
            if (initialMessages && Array.isArray(initialMessages)) {
                 sendUpdate(initialMessages);
            } else if (!initialMessages) {
                 sendUpdate([]); // Send empty array if response is valid but nullish
            }
        }).catch(e => {
            console.error("SSE Contact: Error during initial messages fetch or processing:", e.message);
            try {
              if (controller.desiredSize !== null) { // Check if not already closed/errored
                controller.error(new Error("Failed to initialize contact messages stream: Could not fetch initial data."));
              }
            } catch (closeError) {
              console.error("SSE Contact: Error trying to signal controller error after fetch failure:", closeError);
            }
            contactEmitter.off('update', sendUpdate); // Clean up listener if fetch failed
        });

      contactEmitter.on('update', sendUpdate);

      // Cleanup when client disconnects
      return function cancel() {
        console.log("SSE contact messages client disconnected. Removing listener.");
        contactEmitter.off('update', sendUpdate);
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

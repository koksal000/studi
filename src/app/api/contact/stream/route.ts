// src/app/api/contact/stream/route.ts
import { NextResponse } from 'next/server';
import type { ContactMessage } from '../route'; 
import contactEmitter from '@/lib/contact-emitter';

export const dynamic = 'force-dynamic';

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

  if (process.env.NODE_ENV === 'production' && appUrl.startsWith('http://localhost')) {
    console.warn(
      '[SSE Contact Stream] WARNING: NEXT_PUBLIC_APP_URL is not set or is misconfigured for production. '+
      'The SSE stream may fail to fetch initial data if it relies on this URL to call its own API. '+
      'Current appUrl for internal fetch:', appUrl
    );
  }
  
  const stream = new ReadableStream({
    start(controller) {
      const sendUpdate = (data: ContactMessage[]) => {
        try {
           if (controller.desiredSize === null || controller.desiredSize <= 0) {
            console.warn("SSE Contact: Controller is not in a state to enqueue. Aborting sendUpdate.");
            contactEmitter.off('update', sendUpdate);
            return;
          }
          const sortedData = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          controller.enqueue(`data: ${JSON.stringify(sortedData)}\n\n`);
        } catch (e: any) {
            console.error("SSE Contact: Error enqueuing data to stream:", e.message, e.stack);
            try {
              if (controller.desiredSize !== null) { 
                controller.error(new Error(`SSE stream error while enqueuing data: ${e.message}`));
              }
            } catch (closeErr) {
              console.error("SSE Contact: Error trying to signal controller error after enqueue failure:", closeErr);
            }
            contactEmitter.off('update', sendUpdate); 
        }
      };

      fetch(new URL('/api/contact', appUrl), { cache: 'no-store' }) // Added cache: 'no-store'
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
                 sendUpdate([]); 
            }
        }).catch(e => {
            console.error("SSE Contact: Error during initial messages fetch or processing:", e.message);
            try {
              if (controller.desiredSize !== null) { 
                controller.error(new Error(`Failed to initialize contact messages stream: Could not fetch initial data. Server error: ${e.message}`));
              }
            } catch (closeError) {
              console.error("SSE Contact: Error trying to signal controller error after fetch failure:", closeError);
            }
            contactEmitter.off('update', sendUpdate); 
        });

      contactEmitter.on('update', sendUpdate);

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


// src/lib/gallery-emitter.ts
import { EventEmitter } from 'events';

// This emitter will be shared across API route instances (on the same server process)
// to notify SSE stream connections about updates to gallery images.
const galleryEmitter = new EventEmitter();

export default galleryEmitter;

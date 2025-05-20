// src/lib/announcement-emitter.ts
import { EventEmitter } from 'events';

// This emitter will be shared across API route instances (on the same server process)
// to notify SSE stream connections about updates to announcements.
// Note: This approach has limitations in serverless environments where each request
// might be handled by a different instance. For true multi-instance scalability,
// a dedicated pub/sub system (like Redis, Kafka, or a cloud provider's service) would be needed.
const announcementEmitter = new EventEmitter();

export default announcementEmitter;

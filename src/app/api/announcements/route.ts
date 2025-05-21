
// src/app/api/announcements/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Announcement, NewAnnouncementPayload } from '@/hooks/use-announcements';
import announcementEmitter from '@/lib/announcement-emitter';
// fs and path are no longer needed for persistence here
// import fs from 'fs';
// import path from 'path';

// const dataPath = process.env.DATA_PATH || process.cwd();
// const ANNOUNCEMENTS_FILE_PATH = path.join(dataPath, '_announcements.json');

// Data will be in-memory for each serverless function instance
let announcementsData: Announcement[] = [];
let initialized = false;

// Function to load initial data (e.g., from a seed file if it exists, one time per module instance)
// This is more relevant if you have a seed _announcements.json you want to load on cold starts
// For now, it will just ensure the array is initialized.
const loadInitialAnnouncements = () => {
  if (initialized) return;
  // console.log("[API/Announcements] Initializing in-memory announcements array.");
  // Example: try to read from a seed file if it exists in the project structure (read-only)
  // This part would require fs and path if you want to read a seed file.
  // For simplicity now, we'll start with an empty array.
  // If you have _announcements.json in your repo and want to seed, you'd re-add fs/path here.
  /*
  try {
    const seedFilePath = path.join(process.cwd(), '_announcements.json'); // Adjust path if needed
    if (fs.existsSync(seedFilePath)) {
      const fileData = fs.readFileSync(seedFilePath, 'utf-8');
      const parsedData = JSON.parse(fileData) as Announcement[];
      announcementsData = parsedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      console.log(`[API/Announcements] Successfully seeded ${announcementsData.length} announcements.`);
    } else {
      console.log(`[API/Announcements] Seed file _announcements.json not found. Starting with empty array.`);
    }
  } catch (error) {
    console.error("[API/Announcements] Error reading seed announcements file:", error);
  }
  */
  initialized = true;
};

loadInitialAnnouncements(); // Initialize when module loads

export async function GET() {
  try {
    return NextResponse.json([...announcementsData]);
  } catch (error) {
    console.error("[API/Announcements] Error fetching announcements (GET):", error);
    return NextResponse.json({ message: "Internal server error while fetching announcements." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Client now sends the full Announcement object including id, date, author
    const newAnnouncement: Announcement = await request.json();

    if (!newAnnouncement.id || !newAnnouncement.title || !newAnnouncement.content || !newAnnouncement.author || !newAnnouncement.date) {
      return NextResponse.json({ message: 'Invalid announcement payload. Missing required fields.' }, { status: 400 });
    }

    // Add to in-memory store for this instance
    // Check if announcement with same ID already exists to prevent duplicates from SSE echo
    if (!announcementsData.some(ann => ann.id === newAnnouncement.id)) {
        announcementsData.unshift(newAnnouncement);
        announcementsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
        // If it exists, maybe update it? For now, we assume IDs are unique and new if not present.
        // Or simply ignore if it's an echo.
    }
    
    // Emit update for SSE
    announcementEmitter.emit('update', [...announcementsData]);
    // console.log("[API/Announcements] New announcement processed for SSE broadcast.");

    return NextResponse.json(newAnnouncement, { status: 201 });
  } catch (error) {
    console.error("[API/Announcements] Error creating announcement (POST):", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
    }
    return NextResponse.json({ message: "Internal server error while creating announcement." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ message: 'Announcement ID is required for deletion' }, { status: 400 });
    }

    const initialLength = announcementsData.length;
    announcementsData = announcementsData.filter(ann => ann.id !== id);

    if (announcementsData.length === initialLength) {
      // This means the announcement wasn't in this instance's memory.
      // It might have been deleted by another instance or never existed here.
      // Still, we should emit an update so clients can sync.
    }
    
    // Emit update for SSE
    announcementEmitter.emit('update', [...announcementsData]);
    // console.log(`[API/Announcements] Announcement with ID ${id} processed for deletion for SSE broadcast.`);

    return NextResponse.json({ message: 'Announcement deletion processed' }, { status: 200 });
  } catch (error) {
    console.error("[API/Announcements] Error deleting announcement (DELETE):", error);
    return NextResponse.json({ message: "Internal server error while deleting announcement." }, { status: 500 });
  }
}

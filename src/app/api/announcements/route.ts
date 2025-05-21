
// src/app/api/announcements/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Announcement, NewAnnouncementPayload } from '@/hooks/use-announcements';
import announcementEmitter from '@/lib/announcement-emitter';
import fs from 'fs';
import path from 'path';

const dataPath = process.env.DATA_PATH || process.cwd();
const ANNOUNCEMENTS_FILE_PATH = path.join(dataPath, '_announcements.json');

// Function to read announcements from file
const loadAnnouncementsFromFile = (): Announcement[] => {
  try {
    if (fs.existsSync(ANNOUNCEMENTS_FILE_PATH)) {
      const fileData = fs.readFileSync(ANNOUNCEMENTS_FILE_PATH, 'utf-8');
      const parsedData = JSON.parse(fileData) as Announcement[];
      console.log(`[API/Announcements] Successfully loaded ${parsedData.length} announcements from ${ANNOUNCEMENTS_FILE_PATH}.`);
      return parsedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    console.warn(`[API/Announcements] Announcements file not found at ${ANNOUNCEMENTS_FILE_PATH}. Returning empty array. This is expected if starting with an empty Git repo.`);
    return [];
  } catch (error) {
    console.error("[API/Announcements] Error reading announcements file:", error);
    return [];
  }
};

// Function to save announcements to file
const saveAnnouncementsToFile = (data: Announcement[]) => {
  // This function is disabled for Render.com free tier compatibility with GitHub as data source.
  // Changes should be made by editing the JSON file in Git and redeploying.
  // console.log("[API/Announcements] File saving is disabled. Changes are in-memory only for this instance.");
  /*
  try {
    if (!fs.existsSync(dataPath) && dataPath !== process.cwd()) {
      fs.mkdirSync(dataPath, { recursive: true });
    }
    const sortedData = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    fs.writeFileSync(ANNOUNCEMENTS_FILE_PATH, JSON.stringify(sortedData, null, 2));
    console.log("[API/Announcements] Announcements saved to file:", ANNOUNCEMENTS_FILE_PATH);
  } catch (error) {
    console.error("[API/Announcements] Error writing announcements file:", error);
  }
  */
};

let announcementsData: Announcement[] = loadAnnouncementsFromFile();
if (announcementsData.length === 0) {
  console.log("[API/Announcements] Initialized with an empty announcements list (or file not found/read failed).")
}

export async function GET() {
  try {
    // If in-memory data is empty (e.g. after a serverless function cold start without file persistence)
    // and file exists (e.g. in local dev or if it was part of the deployment bundle), try to load it.
    // This helps in local dev if the file is manually changed.
    if (announcementsData.length === 0 && fs.existsSync(ANNOUNCEMENTS_FILE_PATH)) {
        announcementsData = loadAnnouncementsFromFile();
    }
    return NextResponse.json([...announcementsData]);
  } catch (error) {
    console.error("[API/Announcements] Error fetching announcements (GET):", error);
    return NextResponse.json({ message: "Internal server error while fetching announcements." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: NewAnnouncementPayload = await request.json();

    if (!body.title || !body.content || !body.author) {
      return NextResponse.json({ message: 'Missing required fields: title, content, or author' }, { status: 400 });
    }

    const newAnnouncement: Announcement = {
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      date: new Date().toISOString(),
      title: body.title,
      content: body.content,
      media: body.media || null,
      mediaType: body.mediaType || null,
      author: body.author,
    };

    announcementsData.unshift(newAnnouncement); // Add to in-memory array
    console.log("[API/Announcements] New announcement added to in-memory store. File saving is disabled; commit changes to Git for persistence.");
    // saveAnnouncementsToFile(announcementsData); // Disabled for GitHub as data source
    
    announcementEmitter.emit('update', [...announcementsData]);

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
    announcementsData = announcementsData.filter(ann => ann.id !== id); // Remove from in-memory array

    if (announcementsData.length === initialLength) {
      return NextResponse.json({ message: 'Announcement not found' }, { status: 404 });
    }
    console.log(`[API/Announcements] Announcement with ID ${id} deleted from in-memory store. File saving is disabled; commit changes to Git for persistence.`);
    // saveAnnouncementsToFile(announcementsData); // Disabled for GitHub as data source
    announcementEmitter.emit('update', [...announcementsData]);

    return NextResponse.json({ message: 'Announcement deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error("[API/Announcements] Error deleting announcement (DELETE):", error);
    return NextResponse.json({ message: "Internal server error while deleting announcement." }, { status: 500 });
  }
}

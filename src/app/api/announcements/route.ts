
// src/app/api/announcements/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Announcement } from '@/hooks/use-announcements';
import announcementEmitter from '@/lib/announcement-emitter';
import fs from 'fs';
import path from 'path';

const dataDir = process.env.DATA_PATH || process.cwd();
const ANNOUNCEMENTS_FILE_PATH = path.join(dataDir, '_announcements.json');
const MAX_ANNOUNCEMENT_BASE64_SIZE_API = Math.floor(5 * 1024 * 1024 * 1.37); // Approx 7MB for base64 from 5MB raw

let announcementsData: Announcement[] = [];
let initialized = false;

const loadAnnouncementsFromFile = () => {
  try {
    if (fs.existsSync(ANNOUNCEMENTS_FILE_PATH)) {
      const fileData = fs.readFileSync(ANNOUNCEMENTS_FILE_PATH, 'utf-8');
      const parsedData = JSON.parse(fileData) as Announcement[];
      announcementsData = parsedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      console.log(`[API/Announcements] Successfully loaded ${announcementsData.length} announcements from ${ANNOUNCEMENTS_FILE_PATH}`);
    } else {
      console.log(`[API/Announcements] File ${ANNOUNCEMENTS_FILE_PATH} not found. Starting with empty array.`);
      announcementsData = [];
    }
  } catch (error) {
    console.error("[API/Announcements] Error loading announcements from file:", error);
    announcementsData = []; 
  }
};

const saveAnnouncementsToFile = () => {
   try {
    const dir = path.dirname(ANNOUNCEMENTS_FILE_PATH);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    const sortedData = [...announcementsData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    fs.writeFileSync(ANNOUNCEMENTS_FILE_PATH, JSON.stringify(sortedData, null, 2));
    console.log(`[API/Announcements] Announcement data saved to ${ANNOUNCEMENTS_FILE_PATH}`);
  } catch (error) {
    console.error("[API/Announcements] Error saving announcements to file:", error);
  }
};

if (!initialized) {
  loadAnnouncementsFromFile();
  initialized = true;
}

export async function GET() {
  return NextResponse.json([...announcementsData]);
}

export async function POST(request: NextRequest) {
  try {
    const newAnnouncement: Announcement = await request.json();

    if (!newAnnouncement.id || !newAnnouncement.title?.trim() || !newAnnouncement.content?.trim() || !newAnnouncement.author || !newAnnouncement.date) {
      return NextResponse.json({ message: 'Invalid announcement payload. Missing required fields.' }, { status: 400 });
    }

    if (newAnnouncement.media && (newAnnouncement.media.startsWith("data:image/") || newAnnouncement.media.startsWith("data:video/")) && newAnnouncement.media.length > MAX_ANNOUNCEMENT_BASE64_SIZE_API) {
        return NextResponse.json({ message: `Medya içeriği çok büyük. Maksimum boyut yaklaşık ${Math.round(MAX_ANNOUNCEMENT_BASE64_SIZE_API / (1024*1024*1.37))}MB olmalıdır.` }, { status: 413 });
    }
    
    const existingIndex = announcementsData.findIndex(ann => ann.id === newAnnouncement.id);
    if (existingIndex !== -1) {
        announcementsData[existingIndex] = newAnnouncement; 
    } else {
        announcementsData.unshift(newAnnouncement); 
    }
    
    announcementsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    saveAnnouncementsToFile(); 
    announcementEmitter.emit('update', [...announcementsData]);
    return NextResponse.json(newAnnouncement, { status: 201 });
  } catch (error: any) {
    if (error.type === 'entity.too.large') { 
        console.error("[API/Announcements] POST Error: Payload too large.");
        return NextResponse.json({ message: `Duyuru verisi çok büyük. Sunucu limiti aşıldı.` }, { status: 413 });
    }
    console.error("[API/Announcements] Error creating announcement (POST):", error);
    if (error instanceof SyntaxError) { 
      return NextResponse.json({ message: "Invalid JSON payload. Medya verisi doğru formatta olmayabilir veya çok büyük olabilir." }, { status: 400 });
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

    if (announcementsData.length < initialLength) {
      saveAnnouncementsToFile();
      announcementEmitter.emit('update', [...announcementsData]);
      return NextResponse.json({ message: 'Announcement deleted successfully' }, { status: 200 });
    } else {
      announcementEmitter.emit('update', [...announcementsData]);
      return NextResponse.json({ message: 'Announcement not found' }, { status: 404 });
    }
  } catch (error) {
    console.error("[API/Announcements] Error deleting announcement (DELETE):", error);
    return NextResponse.json({ message: "Internal server error while deleting announcement." }, { status: 500 });
  }
}

    
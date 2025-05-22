
// src/app/api/announcements/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Announcement } from '@/hooks/use-announcements';
import announcementEmitter from '@/lib/announcement-emitter';
import fs from 'fs';
import path from 'path';

const dataDir = process.env.DATA_PATH || process.cwd();
const ANNOUNCEMENTS_FILE_PATH = path.join(dataDir, '_announcements.json');
const MAX_ANNOUNCEMENT_BASE64_SIZE_API = Math.floor(5 * 1024 * 1024 * 1.37); 

let announcementsData: Announcement[] = [];
let initialized = false;

const loadAnnouncementsFromFile = () => {
  try {
    console.log(`[API/Announcements] Attempting to load announcements from: ${ANNOUNCEMENTS_FILE_PATH}`);
    if (fs.existsSync(ANNOUNCEMENTS_FILE_PATH)) {
      const fileData = fs.readFileSync(ANNOUNCEMENTS_FILE_PATH, 'utf-8');
      if (fileData.trim() === '') {
        console.log(`[API/Announcements] File ${ANNOUNCEMENTS_FILE_PATH} is empty. Initializing with empty array.`);
        announcementsData = [];
      } else {
        const parsedData = JSON.parse(fileData) as Announcement[];
        announcementsData = parsedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        console.log(`[API/Announcements] Successfully loaded ${announcementsData.length} announcements.`);
      }
    } else {
      console.log(`[API/Announcements] File ${ANNOUNCEMENTS_FILE_PATH} not found. Initializing with empty array and attempting to create the file.`);
      announcementsData = [];
      saveAnnouncementsToFile(); // Attempt to create the file with an empty array
    }
  } catch (error) {
    console.error("[API/Announcements] Error loading announcements from file:", error);
    announcementsData = []; 
  }
};

const saveAnnouncementsToFile = (): boolean => {
   try {
    const dir = path.dirname(ANNOUNCEMENTS_FILE_PATH);
    if (!fs.existsSync(dir) && (process.env.DATA_PATH || process.env.NODE_ENV === 'development')){ 
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[API/Announcements] Created directory: ${dir}`);
    }
    const sortedData = [...announcementsData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    fs.writeFileSync(ANNOUNCEMENTS_FILE_PATH, JSON.stringify(sortedData, null, 2));
    // console.log(`[API/Announcements] Announcement data saved to ${ANNOUNCEMENTS_FILE_PATH}`);
    return true;
  } catch (error) {
    console.error("[API/Announcements] CRITICAL: Error saving announcements to file:", error);
    return false;
  }
};

if (!initialized) {
  loadAnnouncementsFromFile();
  initialized = true;
}

export async function GET() {
  // Ensure data is loaded if it wasn't for some reason (e.g., another serverless instance)
  // This can be removed if confident about `initialized` behavior in your deployment
  if (!initialized || announcementsData.length === 0 && fs.existsSync(ANNOUNCEMENTS_FILE_PATH)) {
    loadAnnouncementsFromFile();
  }
  return NextResponse.json([...announcementsData]);
}

export async function POST(request: NextRequest) {
  let newAnnouncement: Announcement;
  try {
    newAnnouncement = await request.json();
  } catch (error) {
    console.error("[API/Announcements] POST Error: Invalid JSON payload.", error);
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  if (!newAnnouncement.id || !newAnnouncement.title?.trim() || !newAnnouncement.content?.trim() || !newAnnouncement.author || !newAnnouncement.date) {
    return NextResponse.json({ message: 'Invalid announcement payload. Missing required fields.' }, { status: 400 });
  }

  if (newAnnouncement.media && (newAnnouncement.media.startsWith("data:image/") || newAnnouncement.media.startsWith("data:video/")) && newAnnouncement.media.length > MAX_ANNOUNCEMENT_BASE64_SIZE_API) {
      return NextResponse.json({ message: `Medya içeriği çok büyük. Maksimum boyut yaklaşık ${Math.round(MAX_ANNOUNCEMENT_BASE64_SIZE_API / (1024*1024*1.37))}MB olmalıdır.` }, { status: 413 });
  }
    
  // Read current data from file to ensure we have the latest version
  loadAnnouncementsFromFile(); 

  const tempAnnouncements = [...announcementsData];
  const existingIndex = tempAnnouncements.findIndex(ann => ann.id === newAnnouncement.id);
  if (existingIndex !== -1) {
      tempAnnouncements[existingIndex] = newAnnouncement; 
  } else {
      tempAnnouncements.unshift(newAnnouncement); 
  }
  tempAnnouncements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  announcementsData = tempAnnouncements; // Temporarily update in-memory for save function
  if (saveAnnouncementsToFile()) {
    // announcementsData is already updated
    announcementEmitter.emit('update', [...announcementsData]);
    console.log(`[API/Announcements] Announcement ${newAnnouncement.id} processed and saved. Total: ${announcementsData.length}`);
    return NextResponse.json(newAnnouncement, { status: 201 });
  } else {
    // Revert in-memory change if save failed
    loadAnnouncementsFromFile(); 
    console.error(`[API/Announcements] Failed to save announcement ${newAnnouncement.id}. Operation rolled back from memory.`);
    return NextResponse.json({ message: "Sunucu hatası: Duyuru kaydedilemedi." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'Announcement ID is required for deletion' }, { status: 400 });
  }

  loadAnnouncementsFromFile(); 
  const initialLength = announcementsData.length;
  const filteredAnnouncements = announcementsData.filter(ann => ann.id !== id);

  if (filteredAnnouncements.length < initialLength) {
    announcementsData = filteredAnnouncements; // Update in-memory for save
    if (saveAnnouncementsToFile()) {
      // announcementsData is already updated
      announcementEmitter.emit('update', [...announcementsData]);
      console.log(`[API/Announcements] Announcement ${id} deleted and saved. Total: ${announcementsData.length}`);
      return NextResponse.json({ message: 'Duyuru başarıyla silindi' }, { status: 200 });
    } else {
      loadAnnouncementsFromFile(); // Revert in-memory change
      console.error(`[API/Announcements] Failed to save after deleting announcement ${id}. Operation rolled back from memory.`);
      return NextResponse.json({ message: 'Sunucu hatası: Duyuru silindikten sonra değişiklikler kaydedilemedi.' }, { status: 500 });
    }
  } else {
    // announcementEmitter.emit('update', [...announcementsData]); // Not strictly necessary if not found
    return NextResponse.json({ message: 'Silinecek duyuru bulunamadı' }, { status: 404 });
  }
}

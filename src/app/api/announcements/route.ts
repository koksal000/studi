
// src/app/api/announcements/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Announcement } from '@/hooks/use-announcements';
import announcementEmitter from '@/lib/announcement-emitter';
import fs from 'fs';
import path from 'path';
import { STATIC_GALLERY_IMAGES_FOR_SEEDING } from '@/lib/constants'; // Only for type reference if needed, not direct use

const dataDir = process.env.DATA_PATH || process.cwd();
const ANNOUNCEMENTS_FILE_PATH = path.join(dataDir, '_announcements.json');
const MAX_ANNOUNCEMENT_BASE64_SIZE_API = Math.floor(5 * 1024 * 1024 * 1.37); 

let announcementsData: Announcement[] = [];
let initialized = false;

const loadAnnouncementsFromFile = () => {
  try {
    console.log(`[API/Announcements] DATA_PATH: ${dataDir}`);
    console.log(`[API/Announcements] Attempting to load announcements from: ${ANNOUNCEMENTS_FILE_PATH}`);
    if (fs.existsSync(ANNOUNCEMENTS_FILE_PATH)) {
      const fileData = fs.readFileSync(ANNOUNCEMENTS_FILE_PATH, 'utf-8');
      if (fileData.trim() === '') {
        announcementsData = [];
      } else {
        const parsedData = JSON.parse(fileData) as Announcement[];
        announcementsData = parsedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
      console.log(`[API/Announcements] Successfully loaded ${announcementsData.length} announcements from file.`);
    } else {
      announcementsData = [];
      console.log(`[API/Announcements] File ${ANNOUNCEMENTS_FILE_PATH} not found. Initializing with empty array and attempting to create the file.`);
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
    if (!fs.existsSync(dir) && process.env.DATA_PATH){ // Only create dir if DATA_PATH is set
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[API/Announcements] Created directory: ${dir}`);
    }
    const sortedData = [...announcementsData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    fs.writeFileSync(ANNOUNCEMENTS_FILE_PATH, JSON.stringify(sortedData, null, 2));
    console.log(`[API/Announcements] Announcement data saved to ${ANNOUNCEMENTS_FILE_PATH}`);
    return true;
  } catch (error) {
    console.error("[API/Announcements] CRITICAL: Error saving announcements to file:", error);
    // Do not alert the user here, this is a server-side issue.
    // The calling function should handle the response to the client.
    return false;
  }
};

if (!initialized) {
  loadAnnouncementsFromFile();
  initialized = true;
}

export async function GET() {
  // No need to reload from file here as it's done on init and after every modification.
  // However, for serverless environments where instances might differ, it might be safer.
  // For now, relying on the single `initialized` load and `saveAnnouncementsToFile` after POST/DELETE.
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
    
  // Optimistically update in-memory data first
  const currentAnnouncements = [...announcementsData];
  const existingIndex = currentAnnouncements.findIndex(ann => ann.id === newAnnouncement.id);
  if (existingIndex !== -1) {
      currentAnnouncements[existingIndex] = newAnnouncement; 
  } else {
      currentAnnouncements.unshift(newAnnouncement); 
  }
  currentAnnouncements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  announcementsData = currentAnnouncements; // Update in-memory

  if (saveAnnouncementsToFile()) { // Attempt to save to file
    announcementEmitter.emit('update', [...announcementsData]);
    console.log(`[API/Announcements] Announcement ${newAnnouncement.id} processed and saved. Total: ${announcementsData.length}`);
    return NextResponse.json(newAnnouncement, { status: 201 });
  } else {
    // If saving to file fails, revert the in-memory change and inform the client
    loadAnnouncementsFromFile(); // Re-load from the last known good state (or empty if file was corrupted)
    console.error(`[API/Announcements] Failed to save announcement ${newAnnouncement.id} to file. In-memory change reverted.`);
    return NextResponse.json({ message: "Sunucu hatası: Duyuru kalıcı olarak kaydedilemedi." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'Announcement ID is required for deletion' }, { status: 400 });
  }

  const initialLength = announcementsData.length;
  const filteredAnnouncements = announcementsData.filter(ann => ann.id !== id);

  if (filteredAnnouncements.length < initialLength) {
    announcementsData = filteredAnnouncements; // Update in-memory
    if (saveAnnouncementsToFile()) { // Attempt to save to file
      announcementEmitter.emit('update', [...announcementsData]);
      console.log(`[API/Announcements] Announcement ${id} deleted and saved. Total: ${announcementsData.length}`);
      return NextResponse.json({ message: 'Duyuru başarıyla silindi' }, { status: 200 });
    } else {
      // If saving to file fails, revert in-memory change
      loadAnnouncementsFromFile();
      console.error(`[API/Announcements] Failed to save after deleting announcement ${id} from file. In-memory change reverted.`);
      return NextResponse.json({ message: 'Sunucu hatası: Duyuru silindikten sonra değişiklikler kalıcı olarak kaydedilemedi.' }, { status: 500 });
    }
  } else {
    return NextResponse.json({ message: 'Silinecek duyuru bulunamadı' }, { status: 404 });
  }
}

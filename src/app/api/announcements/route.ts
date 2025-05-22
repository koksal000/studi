
// src/app/api/announcements/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Announcement } from '@/hooks/use-announcements';
import announcementEmitter from '@/lib/announcement-emitter';
import fs from 'fs';
import path from 'path';
import { STATIC_GALLERY_IMAGES_FOR_SEEDING } from '@/lib/constants'; 

const dataDir = process.env.DATA_PATH || process.cwd();
const ANNOUNCEMENTS_FILE_PATH = path.join(dataDir, '_announcements.json');

// Approx base64 size for 10MB image, and 5MB video (raw)
const MAX_IMAGE_PAYLOAD_SIZE_API = Math.floor(10 * 1024 * 1024 * 1.37); 
const MAX_VIDEO_PAYLOAD_SIZE_API = Math.floor(5 * 1024 * 1024 * 1.37); 

let announcementsData: Announcement[] = [];
let initialized = false;

const loadAnnouncementsFromFile = () => {
  try {
    console.log(`[API/Announcements] DATA_PATH for announcements: ${dataDir}, Full Path: ${ANNOUNCEMENTS_FILE_PATH}`);
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
      saveAnnouncementsToFile(); 
    }
  } catch (error) {
    console.error("[API/Announcements] Error loading announcements from file:", error);
    announcementsData = []; 
  }
};

const saveAnnouncementsToFile = (): boolean => {
   try {
    const dir = path.dirname(ANNOUNCEMENTS_FILE_PATH);
    if (!fs.existsSync(dir) && process.env.DATA_PATH){ 
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[API/Announcements] Created directory for data: ${dir}`);
    }
    const sortedData = [...announcementsData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    fs.writeFileSync(ANNOUNCEMENTS_FILE_PATH, JSON.stringify(sortedData, null, 2));
    console.log(`[API/Announcements] Announcement data saved to ${ANNOUNCEMENTS_FILE_PATH}`);
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
  return NextResponse.json([...announcementsData]);
}

export async function POST(request: NextRequest) {
  let newAnnouncement: Announcement;
  try {
    newAnnouncement = await request.json();
  } catch (error) {
    console.error("[API/Announcements] POST Error: Invalid JSON payload.", error);
    return NextResponse.json({ message: "Geçersiz JSON yükü." }, { status: 400 });
  }

  if (!newAnnouncement.id || !newAnnouncement.title?.trim() || !newAnnouncement.content?.trim() || !newAnnouncement.author || !newAnnouncement.date) {
    return NextResponse.json({ message: 'Geçersiz duyuru yükü. Gerekli alanlar eksik.' }, { status: 400 });
  }

  if (newAnnouncement.media && newAnnouncement.media.startsWith("data:")) {
      if (newAnnouncement.mediaType?.startsWith("image/") && newAnnouncement.media.length > MAX_IMAGE_PAYLOAD_SIZE_API) {
          return NextResponse.json({ message: `Resim içeriği çok büyük. Maksimum boyut yaklaşık ${MAX_IMAGE_RAW_SIZE_MB}MB olmalıdır.` }, { status: 413 });
      }
      if (newAnnouncement.mediaType?.startsWith("video/") && newAnnouncement.media.length > MAX_VIDEO_PAYLOAD_SIZE_API) {
          return NextResponse.json({ message: `Video içeriği çok büyük. Doğrudan yükleme için maksimum boyut yaklaşık ${MAX_VIDEO_DATA_URI_CONVERSION_LIMIT_RAW_MB}MB olmalıdır. Daha büyük videolar için URL kullanın.` }, { status: 413 });
      }
  }
    
  const currentDataFromFile = [...announcementsData]; // Use current in-memory state as proxy for "file"
  const existingIndex = currentDataFromFile.findIndex(ann => ann.id === newAnnouncement.id);
  if (existingIndex !== -1) {
      currentDataFromFile[existingIndex] = newAnnouncement; 
  } else {
      currentDataFromFile.unshift(newAnnouncement); 
  }
  currentDataFromFile.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  announcementsData = currentDataFromFile; // Update in-memory for SSE

  if (saveAnnouncementsToFile()) { 
    announcementEmitter.emit('update', [...announcementsData]);
    console.log(`[API/Announcements] Announcement ${newAnnouncement.id} processed and saved. Total: ${announcementsData.length}`);
    return NextResponse.json(newAnnouncement, { status: 201 });
  } else {
    // Attempt to revert in-memory change if save failed, though this is complex
    // Best to rely on next startup to reload from the last known good file state.
    // For now, we'll just log the severe error.
    // To be more robust, we'd ideally not update announcementsData until save is confirmed
    // or implement a transactional save.
    loadAnnouncementsFromFile(); // Revert to last saved state
    announcementEmitter.emit('update', [...announcementsData]); // Notify clients of reverted state
    console.error(`[API/Announcements] Failed to save announcement ${newAnnouncement.id} to file. In-memory change attempted to be reverted.`);
    return NextResponse.json({ message: "Sunucu hatası: Duyuru kalıcı olarak kaydedilemedi." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'Duyuru IDsi silme için gerekli' }, { status: 400 });
  }

  const currentDataFromFile = [...announcementsData];
  const filteredAnnouncements = currentDataFromFile.filter(ann => ann.id !== id);

  if (filteredAnnouncements.length < currentDataFromFile.length) {
    announcementsData = filteredAnnouncements; // Update in-memory for SSE
    if (saveAnnouncementsToFile()) { 
      announcementEmitter.emit('update', [...announcementsData]);
      console.log(`[API/Announcements] Announcement ${id} deleted and saved. Total: ${announcementsData.length}`);
      return NextResponse.json({ message: 'Duyuru başarıyla silindi' }, { status: 200 });
    } else {
      loadAnnouncementsFromFile(); // Revert
      announcementEmitter.emit('update', [...announcementsData]);
      console.error(`[API/Announcements] Failed to save after deleting announcement ${id} from file. In-memory change reverted.`);
      return NextResponse.json({ message: 'Sunucu hatası: Duyuru silindikten sonra değişiklikler kalıcı olarak kaydedilemedi.' }, { status: 500 });
    }
  } else {
    return NextResponse.json({ message: 'Silinecek duyuru bulunamadı' }, { status: 404 });
  }
}

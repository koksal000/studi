
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

// Max base64 payload size for API:
// Image: 5MB raw * 1.37 (base64 overhead) approx 6.9MB. Let's use 7.2MB for safety.
const MAX_IMAGE_PAYLOAD_SIZE_API = Math.floor(5 * 1024 * 1024 * 1.37 * 1.05); // ~7.2MB
// Video: 7MB raw (practical conversion limit) * 1.37 approx 9.6MB. Let's use 10MB for safety.
const MAX_VIDEO_PAYLOAD_SIZE_API = Math.floor(7 * 1024 * 1024 * 1.37 * 1.05);  // ~10MB

let announcementsData: Announcement[] = [];
let initialized = false;

const loadAnnouncementsFromFile = () => {
  try {
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
      console.log(`[API/Announcements] File ${ANNOUNCEMENTS_FILE_PATH} not found. Initializing with empty array.`);
      // Attempt to create the file if it doesn't exist, especially if DATA_PATH is custom
      if (dataDir !== process.cwd() || !ANNOUNCEMENTS_FILE_PATH.startsWith(process.cwd())) {
        saveAnnouncementsToFile(); // This will try to create dir and file
      }
    }
  } catch (error) {
    console.error("[API/Announcements] Error loading announcements from file:", error);
    announcementsData = []; 
  }
};

const saveAnnouncementsToFile = (dataToSave: Announcement[] = announcementsData): boolean => {
   try {
    const dir = path.dirname(ANNOUNCEMENTS_FILE_PATH);
    if (!fs.existsSync(dir) && dataDir !== process.cwd()){ // Only create if DATA_PATH is custom and doesn't exist
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[API/Announcements] Created directory for data: ${dir}`);
    }
    const sortedData = [...dataToSave].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
  // Always ensure data is loaded on GET, in case of serverless cold starts
  if (!initialized) { // Should not happen if top-level init works, but as a safeguard
      loadAnnouncementsFromFile();
      initialized = true;
  }
  return NextResponse.json([...announcementsData]);
}

export async function POST(request: NextRequest) {
  let newAnnouncement: Announcement;
  try {
    const rawBody = await request.text();
    // console.log("[API/Announcements] POST Raw Body Length:", rawBody.length); // Log raw body length for debugging
    newAnnouncement = JSON.parse(rawBody);
  } catch (error) {
    console.error("[API/Announcements] POST Error: Invalid JSON payload.", error);
    return NextResponse.json({ message: "Geçersiz JSON yükü." }, { status: 400 });
  }

  if (!newAnnouncement.id || !newAnnouncement.title?.trim() || !newAnnouncement.content?.trim() || !newAnnouncement.author || !newAnnouncement.date) {
    return NextResponse.json({ message: 'Geçersiz duyuru yükü. Gerekli alanlar eksik.' }, { status: 400 });
  }

  if (newAnnouncement.media && newAnnouncement.media.startsWith("data:")) {
      if (newAnnouncement.mediaType?.startsWith("image/") && newAnnouncement.media.length > MAX_IMAGE_PAYLOAD_SIZE_API) {
          const limitMB = (MAX_IMAGE_PAYLOAD_SIZE_API / (1.37 * 1024 * 1024)).toFixed(1);
          return NextResponse.json({ message: `Resim içeriği çok büyük. Maksimum boyut yaklaşık ${MAX_IMAGE_RAW_SIZE_MB}MB ham dosya olmalıdır (işlenmiş veri ~${limitMB}MB).` }, { status: 413 });
      }
      if (newAnnouncement.mediaType?.startsWith("video/") && newAnnouncement.media.length > MAX_VIDEO_PAYLOAD_SIZE_API) {
           const limitMB = (MAX_VIDEO_PAYLOAD_SIZE_API / (1.37 * 1024 * 1024)).toFixed(1);
          return NextResponse.json({ message: `Video içeriği çok büyük. Doğrudan yükleme için maksimum boyut yaklaşık ${MAX_VIDEO_DATA_URI_CONVERSION_LIMIT_RAW_MB}MB ham dosya olmalıdır (işlenmiş veri ~${limitMB}MB).` }, { status: 413 });
      }
  }
    
  const currentDataFromFile = [...announcementsData]; 
  const existingIndex = currentDataFromFile.findIndex(ann => ann.id === newAnnouncement.id);
  
  let updatedAnnouncements;
  if (existingIndex !== -1) {
      currentDataFromFile[existingIndex] = newAnnouncement; 
      updatedAnnouncements = currentDataFromFile;
  } else {
      updatedAnnouncements = [newAnnouncement, ...currentDataFromFile]; 
  }
  updatedAnnouncements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  if (saveAnnouncementsToFile(updatedAnnouncements)) { 
    announcementsData = updatedAnnouncements; // Update in-memory after successful save
    announcementEmitter.emit('update', [...announcementsData]);
    console.log(`[API/Announcements] Announcement ${newAnnouncement.id} processed and saved. Total: ${announcementsData.length}`);
    return NextResponse.json(newAnnouncement, { status: 201 });
  } else {
    console.error(`[API/Announcements] Failed to save announcement ${newAnnouncement.id} to file.`);
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
    if (saveAnnouncementsToFile(filteredAnnouncements)) { 
      announcementsData = filteredAnnouncements; // Update in-memory after successful save
      announcementEmitter.emit('update', [...announcementsData]);
      console.log(`[API/Announcements] Announcement ${id} deleted and saved. Total: ${announcementsData.length}`);
      return NextResponse.json({ message: 'Duyuru başarıyla silindi' }, { status: 200 });
    } else {
      console.error(`[API/Announcements] Failed to save after deleting announcement ${id} from file.`);
      return NextResponse.json({ message: 'Sunucu hatası: Duyuru silindikten sonra değişiklikler kalıcı olarak kaydedilemedi.' }, { status: 500 });
    }
  } else {
    return NextResponse.json({ message: 'Silinecek duyuru bulunamadı' }, { status: 404 });
  }
}


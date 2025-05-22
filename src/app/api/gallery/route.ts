
// src/app/api/gallery/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import galleryEmitter from '@/lib/gallery-emitter';
import { STATIC_GALLERY_IMAGES_FOR_SEEDING } from '@/lib/constants';

export interface GalleryImage {
  id: string;
  src: string; 
  alt: string;
  caption: string;
  hint: string;
}

const dataDir = process.env.DATA_PATH || process.cwd();
const GALLERY_FILE_PATH = path.join(dataDir, '_gallery.json');
// MAX_BASE64_SIZE_API for 5MB raw image: 5 * 1024 * 1024 * 1.37 (base64 encoding) * 1.05 (safety margin)
const MAX_BASE64_SIZE_API = Math.floor(5 * 1024 * 1024 * 1.37 * 1.05); // Approx 7.2MB 

let galleryImagesData: GalleryImage[] = [];
let initialized = false;

const gallerySortFnInMemory = (a: GalleryImage, b: GalleryImage): number => {
  const aIsSeed = a.id.startsWith('seed_');
  const bIsSeed = b.id.startsWith('seed_');
  
  if (aIsSeed && !bIsSeed) return -1;
  if (!aIsSeed && bIsSeed) return 1;

  const extractNumericPart = (id: string) => {
    const match = id.match(/\d+$/); 
    return match ? parseInt(match[0]) : null;
  };

  const numA = extractNumericPart(a.id);
  const numB = extractNumericPart(b.id);

  if (numA !== null && numB !== null) {
    if (a.id.startsWith('gal_') && b.id.startsWith('gal_')) {
      return numB - numA; 
    }
    if (a.id.startsWith('seed_') && b.id.startsWith('seed_')) {
      return numA - numB; 
    }
  }
  
  if (a.id.startsWith('gal_') && b.id.startsWith('seed_')) return -1; 
  if (a.id.startsWith('seed_') && b.id.startsWith('gal_')) return 1;
  
  return a.id.localeCompare(b.id); 
};

const loadGalleryFromFile = () => {
  try {
    console.log(`[API/Gallery] DATA_PATH used for gallery: ${dataDir}`);
    if (fs.existsSync(GALLERY_FILE_PATH)) {
      const fileData = fs.readFileSync(GALLERY_FILE_PATH, 'utf-8');
      if (fileData.trim() === '' || fileData.trim() === '[]') {
        // File is empty or just an empty array, seed with static images
        console.log(`[API/Gallery] File ${GALLERY_FILE_PATH} is empty. Initializing with seed images.`);
        galleryImagesData = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFnInMemory);
        saveGalleryToFile(); // Attempt to save the seeded data
      } else {
        galleryImagesData = (JSON.parse(fileData) as GalleryImage[]).sort(gallerySortFnInMemory);
        console.log(`[API/Gallery] Successfully loaded ${galleryImagesData.length} images from ${GALLERY_FILE_PATH}`);
      }
    } else {
      // File does not exist, seed with static images and try to create the file
      console.log(`[API/Gallery] File ${GALLERY_FILE_PATH} not found. Initializing with seed images and attempting to create.`);
      galleryImagesData = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFnInMemory);
      saveGalleryToFile();
    }
  } catch (error) {
    console.error("[API/Gallery] Error loading gallery from file, attempting to use static seeds as fallback:", error);
    galleryImagesData = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFnInMemory);
  }
};

const saveGalleryToFile = (): boolean => {
   try {
    const dir = path.dirname(GALLERY_FILE_PATH);
    if (!fs.existsSync(dir) && dataDir !== process.cwd()){ 
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[API/Gallery] Created directory for data: ${dir}`);
    }
    const sortedData = [...galleryImagesData].sort(gallerySortFnInMemory);
    fs.writeFileSync(GALLERY_FILE_PATH, JSON.stringify(sortedData, null, 2));
    console.log(`[API/Gallery] Gallery data saved to ${GALLERY_FILE_PATH} (${sortedData.length} images)`);
    return true;
  } catch (error) {
    console.error("[API/Gallery] CRITICAL: Error saving gallery to file:", error);
    return false;
  }
};

if (!initialized) {
  loadGalleryFromFile();
  initialized = true;
}

export async function GET() {
  // No need to load from file on every GET if using SSE to keep in-memory up to date
  // loadGalleryFromFile(); // This might cause race conditions if save is slow
  return NextResponse.json([...galleryImagesData]);
}

export async function POST(request: NextRequest) {
  let newImage: GalleryImage;
  try {
    newImage = await request.json();
  } catch (error) {
    console.error("[API/Gallery] POST Error: Invalid JSON payload.", error);
    return NextResponse.json({ message: "Geçersiz JSON yükü." }, { status: 400 });
  }
    
  if (!newImage.id || !newImage.src || !newImage.caption?.trim() || !newImage.alt?.trim() || !newImage.hint?.trim()) {
    return NextResponse.json({ message: 'Geçersiz resim yükü. Gerekli alanlar eksik.' }, { status: 400 });
  }

  if (!newImage.src.startsWith('data:image/')) {
      return NextResponse.json({ message: 'Geçersiz resim veri formatı. "data:image/" ile başlamalıdır.' }, { status: 400 });
  }

  if (newImage.src.length > MAX_BASE64_SIZE_API) { 
      const limitMB = (MAX_BASE64_SIZE_API / (1024*1024)).toFixed(1); // e.g. 7.2MB
      const rawEquivalentMB = (MAX_BASE64_SIZE_API / (1.37 * 1.05 * 1024 * 1024)).toFixed(1); // e.g. 5MB
      return NextResponse.json({ message: `Resim verisi çok büyük. Maksimum işlenmiş veri boyutu ~${limitMB}MB olmalıdır (yaklaşık ~${rawEquivalentMB}MB ham dosya).` }, { status: 413 });
  }

  // Thread-safe update: Load current data from file, modify, then save
  loadGalleryFromFile(); // Load the absolute latest from disk
  const currentGalleryFromFile = [...galleryImagesData]; 
  
  const existingImageIndex = currentGalleryFromFile.findIndex(img => img.id === newImage.id);

  if (existingImageIndex !== -1) {
    currentGalleryFromFile[existingImageIndex] = newImage; 
  } else {
    currentGalleryFromFile.unshift(newImage); // Add to the beginning
  }
  galleryImagesData = currentGalleryFromFile.sort(gallerySortFnInMemory); // Update in-memory version

  if (saveGalleryToFile()) { // This saves the updated galleryImagesData
    galleryEmitter.emit('update', [...galleryImagesData]);
    console.log(`[API/Gallery] Image ${newImage.id} processed and saved. Total images: ${galleryImagesData.length}`);
    return NextResponse.json(newImage, { status: 201 });
  } else {
    // Attempt to revert in-memory change if save failed, and reload from file to be safe
    loadGalleryFromFile(); 
    console.error(`[API/Gallery] Failed to save image ${newImage.id} to file. In-memory change might be partially reverted or state could be inconsistent until next load.`);
    return NextResponse.json({ message: "Sunucu hatası: Galeri resmi kalıcı olarak kaydedilemedi." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'Silme için resim IDsi gerekli.' }, { status: 400 });
  }
    
  loadGalleryFromFile(); // Load latest from disk
  const currentDataFromFile = [...galleryImagesData];
  const initialLength = currentDataFromFile.length;
  const filteredGallery = currentDataFromFile.filter(img => img.id !== id);

  if (filteredGallery.length < initialLength) {
    galleryImagesData = filteredGallery.sort(gallerySortFnInMemory); // Update in-memory version
    if (saveGalleryToFile()) { // This saves the updated galleryImagesData
      galleryEmitter.emit('update', [...galleryImagesData]);
      console.log(`[API/Gallery] Image ${id} deleted and saved. Total images: ${galleryImagesData.length}`);
      return NextResponse.json({ message: 'Resim başarıyla silindi' }, { status: 200 });
    } else {
      loadGalleryFromFile(); // Revert to last known good state from file
      console.error(`[API/Gallery] Failed to save after deleting image ${id} from file. In-memory change reverted.`);
      return NextResponse.json({ message: 'Sunucu hatası: Resim silindikten sonra değişiklikler kalıcı olarak kaydedilemedi.' }, { status: 500 });
    }
  } else {
    return NextResponse.json({ message: 'Silinecek resim bulunamadı' }, { status: 404 });
  }
}

    
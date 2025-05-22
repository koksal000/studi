
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
const MAX_BASE64_SIZE_API = 4 * 1024 * 1024; 

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
  
  // Fallback for non-standard IDs or if one is seed and other is not (already handled)
  // If both are gal_ or both are seed_ and numeric parts are equal, sort by full ID
  return a.id.localeCompare(b.id); 
};

const loadGalleryFromFile = () => {
  try {
    console.log(`[API/Gallery] Attempting to load gallery from: ${GALLERY_FILE_PATH}`);
    if (fs.existsSync(GALLERY_FILE_PATH)) {
      const fileData = fs.readFileSync(GALLERY_FILE_PATH, 'utf-8');
      if (fileData.trim() === '' || fileData.trim() === '[]') {
        console.log(`[API/Gallery] File ${GALLERY_FILE_PATH} is empty or '[]'. Initializing with seed images.`);
        galleryImagesData = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFnInMemory);
        saveGalleryToFile(); // Save seeded data
      } else {
        const parsedData = JSON.parse(fileData) as GalleryImage[];
        galleryImagesData = parsedData.sort(gallerySortFnInMemory);
        console.log(`[API/Gallery] Successfully loaded ${galleryImagesData.length} images.`);
      }
    } else {
      console.log(`[API/Gallery] File ${GALLERY_FILE_PATH} not found. Initializing with seed images and attempting to create the file.`);
      galleryImagesData = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFnInMemory);
      saveGalleryToFile(); 
    }
  } catch (error) {
    console.error("[API/Gallery] Error loading gallery from file, using static seeds as fallback:", error);
    galleryImagesData = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFnInMemory);
  }
};

const saveGalleryToFile = (): boolean => {
   try {
    const dir = path.dirname(GALLERY_FILE_PATH);
    if (!fs.existsSync(dir) && (process.env.DATA_PATH || process.env.NODE_ENV === 'development')){
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[API/Gallery] Created directory: ${dir}`);
    }
    const sortedData = [...galleryImagesData].sort(gallerySortFnInMemory);
    fs.writeFileSync(GALLERY_FILE_PATH, JSON.stringify(sortedData, null, 2));
    // console.log(`[API/Gallery] Gallery data saved to ${GALLERY_FILE_PATH}`);
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
  if (!initialized || (galleryImagesData.length === 0 && fs.existsSync(GALLERY_FILE_PATH) && fs.readFileSync(GALLERY_FILE_PATH, 'utf-8').trim() !== '[]')) {
    loadGalleryFromFile(); // Ensure data is loaded
  }
  return NextResponse.json([...galleryImagesData]);
}

export async function POST(request: NextRequest) {
  let newImage: GalleryImage;
  try {
    newImage = await request.json();
  } catch (error) {
    console.error("[API/Gallery] POST Error: Invalid JSON payload.", error);
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }
    
  if (!newImage.id || !newImage.src || !newImage.caption || !newImage.alt || !newImage.hint) {
    return NextResponse.json({ message: 'Invalid image payload. Missing required fields.' }, { status: 400 });
  }

  if (!newImage.src.startsWith('data:image/')) {
      return NextResponse.json({ message: 'Invalid image data URI format. Must start with "data:image/".' }, { status: 400 });
  }

  if (newImage.src.length > MAX_BASE64_SIZE_API) { 
      return NextResponse.json({ message: `Resim verisi çok büyük. Maksimum boyut yaklaşık ${Math.floor(MAX_BASE64_SIZE_API / (1024*1024))}MB olmalıdır (işlenmiş veri).` }, { status: 413 });
  }

  loadGalleryFromFile();
  const tempGallery = [...galleryImagesData];
  const existingImageIndex = tempGallery.findIndex(img => img.id === newImage.id);

  if (existingImageIndex !== -1) {
    tempGallery[existingImageIndex] = newImage; 
  } else {
    tempGallery.unshift(newImage); 
  }
  tempGallery.sort(gallerySortFnInMemory); 
  
  galleryImagesData = tempGallery; // Temporarily update for save
  if (saveGalleryToFile()) {
    // galleryImagesData is already updated
    galleryEmitter.emit('update', [...galleryImagesData]);
    console.log(`[API/Gallery] Image ${newImage.id} processed and saved. Total images: ${galleryImagesData.length}`);
    return NextResponse.json(newImage, { status: 201 });
  } else {
    loadGalleryFromFile(); // Revert in-memory change
    console.error(`[API/Gallery] Failed to save image ${newImage.id}. Operation rolled back from memory.`);
    return NextResponse.json({ message: "Sunucu hatası: Galeri resmi kaydedilemedi." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'Image ID is required for deletion' }, { status: 400 });
  }
    
  loadGalleryFromFile();
  const initialLength = galleryImagesData.length;
  const filteredGallery = galleryImagesData.filter(img => img.id !== id);

  if (filteredGallery.length < initialLength) {
    galleryImagesData = filteredGallery; // Update in-memory for save
    if (saveGalleryToFile()) {
      // galleryImagesData is already updated
      galleryEmitter.emit('update', [...galleryImagesData]);
      console.log(`[API/Gallery] Image ${id} deleted and saved. Total images: ${galleryImagesData.length}`);
      return NextResponse.json({ message: 'Resim başarıyla silindi' }, { status: 200 });
    } else {
      loadGalleryFromFile(); // Revert in-memory change
      console.error(`[API/Gallery] Failed to save after deleting image ${id}. Operation rolled back from memory.`);
      return NextResponse.json({ message: 'Sunucu hatası: Resim silindikten sonra değişiklikler kaydedilemedi.' }, { status: 500 });
    }
  } else {
    return NextResponse.json({ message: 'Silinecek resim bulunamadı' }, { status: 404 });
  }
}

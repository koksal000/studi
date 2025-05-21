
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
    if (id.startsWith('gal_') && match) return parseInt(match[0]);
    if (id.startsWith('seed_') && id.length > 5) return parseInt(id.substring(5)); 
    return null;
  };

  const numA = extractNumericPart(a.id);
  const numB = extractNumericPart(b.id);

  if (numA !== null && numB !== null) {
    if (a.id.startsWith('gal_') && b.id.startsWith('gal_')) {
      return numB - numA; 
    }
    return numA - numB; 
  }
  
  if (a.id.startsWith('gal_') && !b.id.startsWith('gal_')) return -1; 
  if (!a.id.startsWith('gal_') && b.id.startsWith('gal_')) return 1;
  
  return b.id.localeCompare(a.id); 
};

const loadGalleryFromFile = () => {
  try {
    if (fs.existsSync(GALLERY_FILE_PATH)) {
      const fileData = fs.readFileSync(GALLERY_FILE_PATH, 'utf-8');
      const parsedData = JSON.parse(fileData) as GalleryImage[];
      galleryImagesData = parsedData.sort(gallerySortFnInMemory);
      console.log(`[API/Gallery] Successfully loaded ${galleryImagesData.length} images from ${GALLERY_FILE_PATH}`);
    } else {
      galleryImagesData = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFnInMemory);
      saveGalleryToFile(); // Attempt to create the file on first run if it doesn't exist, with seed data
      console.log(`[API/Gallery] Initialized with ${galleryImagesData.length} seed images. File ${GALLERY_FILE_PATH} created.`);
    }
  } catch (error) {
    console.error("[API/Gallery] Error loading gallery from file, using static seeds as fallback:", error);
    galleryImagesData = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFnInMemory);
  }
};

const saveGalleryToFile = () => {
  try {
    const dir = path.dirname(GALLERY_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const sortedData = [...galleryImagesData].sort(gallerySortFnInMemory);
    fs.writeFileSync(GALLERY_FILE_PATH, JSON.stringify(sortedData, null, 2));
    console.log(`[API/Gallery] Gallery data saved to ${GALLERY_FILE_PATH}`);
  } catch (error) {
    console.error("[API/Gallery] Error saving gallery to file:", error);
  }
};

if (!initialized) {
  loadGalleryFromFile();
  initialized = true;
}

export async function GET() {
  return NextResponse.json([...galleryImagesData]);
}

export async function POST(request: NextRequest) {
  try {
    const newImage: GalleryImage = await request.json();
    
    if (!newImage.id || !newImage.src || !newImage.caption) {
      return NextResponse.json({ message: 'Invalid image payload. Missing required fields.' }, { status: 400 });
    }

    if (!newImage.src.startsWith('data:image/')) {
        return NextResponse.json({ message: 'Invalid image data URI format.' }, { status: 400 });
    }

    if (newImage.src.length > MAX_BASE64_SIZE_API) { 
        return NextResponse.json({ message: `Resim verisi çok büyük. Maksimum boyut yaklaşık ${MAX_BASE64_SIZE_API / (1024*1024)}MB olmalıdır (işlenmiş veri).` }, { status: 413 });
    }

    const existingImageIndex = galleryImagesData.findIndex(img => img.id === newImage.id);
    if (existingImageIndex !== -1) {
      galleryImagesData[existingImageIndex] = newImage; 
    } else {
      galleryImagesData.unshift(newImage); 
    }
    galleryImagesData.sort(gallerySortFnInMemory); 
    
    saveGalleryToFile(); 

    galleryEmitter.emit('update', [...galleryImagesData]);
    return NextResponse.json(newImage, { status: 201 });
  } catch (error: any) {
    if (error.type === 'entity.too.large') {
        console.error("[API/Gallery] POST Error: Payload too large, exceeded Next.js body parser limit.");
        return NextResponse.json({ message: `Resim dosyası çok büyük. Sunucu limiti aşıldı. Lütfen daha küçük bir dosya kullanın.` }, { status: 413 });
    }
    console.error("[API/Gallery] Error creating gallery image (POST):", error);
    if (error instanceof SyntaxError) { 
      return NextResponse.json({ message: "Invalid JSON payload. Resim verisi doğru formatta olmayabilir veya çok büyük olabilir." }, { status: 400 });
    }
    return NextResponse.json({ message: "Internal server error while creating gallery image." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ message: 'Image ID is required for deletion' }, { status: 400 });
    }
    
    const initialLength = galleryImagesData.length;
    galleryImagesData = galleryImagesData.filter(img => img.id !== id);

    if (galleryImagesData.length < initialLength) {
      saveGalleryToFile(); 
      galleryEmitter.emit('update', [...galleryImagesData]);
      return NextResponse.json({ message: 'Image deleted successfully' }, { status: 200 });
    } else {
      galleryEmitter.emit('update', [...galleryImagesData]); 
      return NextResponse.json({ message: 'Image not found' }, { status: 404 });
    }
  } catch (error) {
    console.error("[API/Gallery] Error deleting image (DELETE):", error);
    return NextResponse.json({ message: "Internal server error while deleting image." }, { status: 500 });
  }
}

    
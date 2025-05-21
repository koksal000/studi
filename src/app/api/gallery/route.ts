
// src/app/api/gallery/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import galleryEmitter from '@/lib/gallery-emitter';
import { STATIC_GALLERY_IMAGES_FOR_SEEDING } from '@/lib/constants';

export interface GalleryImage {
  id: string;
  src: string; // base64 data URI or URL for seeded images
  alt: string;
  caption: string;
  hint: string;
}

const dataDir = process.env.DATA_PATH || process.cwd();
const GALLERY_FILE_PATH = path.join(dataDir, '_gallery.json');
// Next.js default body parser limit is 1MB. Base64 is ~33% larger.
// A 700KB file can become ~1MB base64.
// Vercel Hobby plan serverless function request payload limit is 4.5MB.
// Let's set a practical limit for the base64 string itself.
const MAX_BASE64_SIZE_API = 4 * 1024 * 1024; // Approx 4MB for the base64 string.

let galleryImagesData: GalleryImage[] = [];
let initialized = false;

const loadGalleryFromFile = () => {
  try {
    if (fs.existsSync(GALLERY_FILE_PATH)) {
      const fileData = fs.readFileSync(GALLERY_FILE_PATH, 'utf-8');
      const parsedData = JSON.parse(fileData) as GalleryImage[];
      galleryImagesData = parsedData.sort((a,b) => {
        const aIsSeed = a.id.startsWith('seed_');
        const bIsSeed = b.id.startsWith('seed_');
        if (aIsSeed && !bIsSeed) return -1;
        if (!aIsSeed && bIsSeed) return 1;
        const idA = a.id.replace(/^(seed_|gal_)/, '');
        const idB = b.id.replace(/^(seed_|gal_)/, '');
        if (isNaN(parseInt(idA)) || isNaN(parseInt(idB))) {
            return a.id.localeCompare(b.id);
        }
        return parseInt(idB) - parseInt(idA);
      });
      console.log(`[API/Gallery] Successfully loaded ${galleryImagesData.length} images from ${GALLERY_FILE_PATH}`);
    } else {
      galleryImagesData = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort((a,b) => {
        const aIsSeed = a.id.startsWith('seed_');
        const bIsSeed = b.id.startsWith('seed_');
        if (aIsSeed && !bIsSeed) return -1;
        if (!aIsSeed && bIsSeed) return 1;
        return 0;
      });
      saveGalleryToFile();
      console.log(`[API/Gallery] Initialized with ${galleryImagesData.length} seed images and saved to ${GALLERY_FILE_PATH}`);
    }
  } catch (error) {
    console.error("[API/Gallery] Error loading gallery from file, using static seeds as fallback:", error);
    galleryImagesData = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort((a,b) => {
        const aIsSeed = a.id.startsWith('seed_');
        const bIsSeed = b.id.startsWith('seed_');
        if (aIsSeed && !bIsSeed) return -1;
        if (!aIsSeed && bIsSeed) return 1;
        return 0;
      });
  }
};

const saveGalleryToFile = () => {
  try {
    const dir = path.dirname(GALLERY_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const sortedData = [...galleryImagesData].sort((a,b) => {
        const aIsSeed = a.id.startsWith('seed_');
        const bIsSeed = b.id.startsWith('seed_');
        if (aIsSeed && !bIsSeed) return -1;
        if (!aIsSeed && bIsSeed) return 1;
        const idA = a.id.replace(/^(seed_|gal_)/, '');
        const idB = b.id.replace(/^(seed_|gal_)/, '');
        if (isNaN(parseInt(idA)) || isNaN(parseInt(idB))) return a.id.localeCompare(b.id);
        return parseInt(idB) - parseInt(idA);
    });
    fs.writeFileSync(GALLERY_FILE_PATH, JSON.stringify(sortedData, null, 2));
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
    // Note: Next.js default body parser limit is 1MB.
    // If request body is larger, it might not even reach this handler or be truncated.
    // The MAX_BASE64_SIZE_API check below is an additional safeguard.
    const newImage: GalleryImage = await request.json();
    
    if (!newImage.id || !newImage.src || !newImage.caption) {
      return NextResponse.json({ message: 'Invalid image payload. Missing required fields.' }, { status: 400 });
    }

    if (!newImage.src.startsWith('data:image/')) {
        return NextResponse.json({ message: 'Invalid image data URI format.' }, { status: 400 });
    }

    // Check size of base64 string
    if (newImage.src.length > MAX_BASE64_SIZE_API) { 
        return NextResponse.json({ message: `Resim verisi çok büyük. Maksimum boyut yaklaşık ${MAX_BASE64_SIZE_API / (1024*1024)}MB olmalıdır (işlenmiş veri).` }, { status: 413 });
    }

    const existingImageIndex = galleryImagesData.findIndex(img => img.id === newImage.id);
    if (existingImageIndex !== -1) {
      galleryImagesData[existingImageIndex] = newImage; 
    } else {
      galleryImagesData.unshift(newImage); 
    }
    
    saveGalleryToFile();
    galleryEmitter.emit('update', [...galleryImagesData]);
    return NextResponse.json(newImage, { status: 201 });
  } catch (error: any) {
    // Check if error is due to payload size exceeding Next.js body parser limit
    if (error.type === 'entity.too.large') {
        console.error("[API/Gallery] POST Error: Payload too large, exceeded Next.js body parser limit.");
        return NextResponse.json({ message: `Resim dosyası çok büyük. Sunucu limiti aşıldı. Lütfen daha küçük bir dosya kullanın.` }, { status: 413 });
    }
    console.error("[API/Gallery] Error creating gallery image (POST):", error);
    if (error instanceof SyntaxError) { // JSON parsing error
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
      return NextResponse.json({ message: 'Image not found' }, { status: 404 });
    }
  } catch (error) {
    console.error("[API/Gallery] Error deleting image (DELETE):", error);
    return NextResponse.json({ message: "Internal server error while deleting image." }, { status: 500 });
  }
}

    
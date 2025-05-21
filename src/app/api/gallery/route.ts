
// src/app/api/gallery/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import galleryEmitter from '@/lib/gallery-emitter';
import { STATIC_GALLERY_IMAGES_FOR_SEEDING } from '@/lib/constants';
import fs from 'fs';
import path from 'path';

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  caption: string;
  hint: string;
}

const GALLERY_FILE_PATH = path.join(process.cwd(), '_gallery.json');

// Function to read gallery from file
const loadGalleryFromFile = (): GalleryImage[] => {
  try {
    if (fs.existsSync(GALLERY_FILE_PATH)) {
      const fileData = fs.readFileSync(GALLERY_FILE_PATH, 'utf-8');
      return JSON.parse(fileData) as GalleryImage[];
    }
    console.warn(`[API/Gallery] Gallery file not found at ${GALLERY_FILE_PATH}. Returning seed data or empty array.`);
    return STATIC_GALLERY_IMAGES_FOR_SEEDING.length > 0 ? [...STATIC_GALLERY_IMAGES_FOR_SEEDING] : [];
  } catch (error) {
    console.error("[API/Gallery] Error reading gallery file:", error);
    return STATIC_GALLERY_IMAGES_FOR_SEEDING.length > 0 ? [...STATIC_GALLERY_IMAGES_FOR_SEEDING] : [];
  }
};

// Function to save gallery to file (REMOVED USAGE FOR VERCEL COMPATIBILITY)
// const saveGalleryToFile = (data: GalleryImage[]) => {
//   try {
//     fs.writeFileSync(GALLERY_FILE_PATH, JSON.stringify(data, null, 2));
//   } catch (error) {
//     console.warn("[API/Gallery] Error writing gallery file (this is expected on Vercel/serverless):", error);
//   }
// };

// Initialize in-memory store
let galleryImagesData: GalleryImage[] = loadGalleryFromFile();

if (galleryImagesData.length === 0 && STATIC_GALLERY_IMAGES_FOR_SEEDING.length > 0) {
  galleryImagesData = [...STATIC_GALLERY_IMAGES_FOR_SEEDING];
  // saveGalleryToFile(galleryImagesData); // REMOVED: Not Vercel compatible for persistence
  console.log("[API/Gallery] Initialized gallery with seed data (in-memory).");
} else if (galleryImagesData.length === 0) {
  console.log("[API/Gallery] Initialized with an empty gallery list (in-memory).")
}


export async function GET() {
  try {
    return NextResponse.json([...galleryImagesData].sort((a,b) => {
        const aIsSeed = a.id.startsWith('seed_');
        const bIsSeed = b.id.startsWith('seed_');
        if (aIsSeed && !bIsSeed) return -1;
        if (!aIsSeed && bIsSeed) return 1;
        return 0; 
    }));
  } catch (error) {
    console.error("[API/Gallery] Error fetching gallery images (GET):", error);
    return NextResponse.json({ message: "Internal server error while fetching gallery images." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageDataUri, caption, alt, hint } = body;

    if (!imageDataUri || !caption) {
      return NextResponse.json({ message: 'Missing required fields: imageDataUri or caption' }, { status: 400 });
    }

    if (!imageDataUri.startsWith('data:image/')) {
        return NextResponse.json({ message: 'Invalid image data URI format.' }, { status: 400 });
    }
    if (imageDataUri.length > 4 * 1024 * 1024) { 
        return NextResponse.json({ message: 'Resim verisi çok büyük (maks ~3MB dosya). Lütfen daha küçük resimler kullanın.' }, { status: 413 });
    }

    const newImage: GalleryImage = {
      id: `gal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      src: imageDataUri,
      alt: alt || caption,
      caption: caption,
      hint: hint || 'uploaded image',
    };

    galleryImagesData.unshift(newImage); 
    // saveGalleryToFile(galleryImagesData); // REMOVED: Not Vercel compatible for persistence
    
    galleryEmitter.emit('update', [...galleryImagesData]);

    return NextResponse.json(newImage, { status: 201 });
  } catch (error) {
    console.error("[API/Gallery] Error creating gallery image (POST):", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
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

    if (galleryImagesData.length === initialLength) {
      return NextResponse.json({ message: 'Image not found' }, { status: 404 });
    }

    // saveGalleryToFile(galleryImagesData); // REMOVED: Not Vercel compatible for persistence
    galleryEmitter.emit('update', [...galleryImagesData]);

    return NextResponse.json({ message: 'Image deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error("[API/Gallery] Error deleting image (DELETE):", error);
    return NextResponse.json({ message: "Internal server error while deleting image." }, { status: 500 });
  }
}

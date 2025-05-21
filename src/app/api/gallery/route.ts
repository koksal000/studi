
// src/app/api/gallery/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import galleryEmitter from '@/lib/gallery-emitter';
import { STATIC_GALLERY_IMAGES_FOR_SEEDING } from '@/lib/constants';
// fs and path are no longer needed for persistence here

// Data will be in-memory for each serverless function instance
let galleryImagesData: GalleryImage[] = [];
let initialized = false;

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  caption: string;
  hint: string;
}

const loadInitialGallery = () => {
  if (initialized) return;
  // Seed with static images if the in-memory array is empty
  if (STATIC_GALLERY_IMAGES_FOR_SEEDING.length > 0) {
    galleryImagesData = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort((a,b) => {
        const aIsSeed = a.id.startsWith('seed_');
        const bIsSeed = b.id.startsWith('seed_');
        if (aIsSeed && !bIsSeed) return -1;
        if (!aIsSeed && bIsSeed) return 1;
        return 0; 
    });
    // console.log(`[API/Gallery] Initialized in-memory gallery with ${galleryImagesData.length} seed images.`);
  } else {
    // console.log(`[API/Gallery] Initialized in-memory gallery as empty (no seed images).`);
  }
  initialized = true;
};

loadInitialGallery(); // Initialize when module loads

export async function GET() {
  try {
    return NextResponse.json([...galleryImagesData]);
  } catch (error) {
    console.error("[API/Gallery] Error fetching gallery images (GET):", error);
    return NextResponse.json({ message: "Internal server error while fetching gallery images." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Client now sends the full GalleryImage object including id, src (imageDataUri)
    const newImage: GalleryImage = await request.json();
    
    // The 'src' from client is the imageDataUri for new uploads
    // For API consistency, we can rename it or ensure the client sends 'src' as the imageDataUri
    if (!newImage.id || !newImage.src || !newImage.caption) {
      return NextResponse.json({ message: 'Invalid image payload. Missing required fields.' }, { status: 400 });
    }
    if (!newImage.src.startsWith('data:image/')) {
        return NextResponse.json({ message: 'Invalid image data URI format.' }, { status: 400 });
    }
    if (newImage.src.length > 4 * 1024 * 1024) { 
        return NextResponse.json({ message: 'Resim verisi çok büyük (maks ~3MB dosya). Lütfen daha küçük resimler kullanın.' }, { status: 413 });
    }

    // Add to in-memory store for this instance
    if (!galleryImagesData.some(img => img.id === newImage.id)) {
        galleryImagesData.unshift(newImage); // Add to the beginning
        // No specific sort order for gallery after adding, could be chronological (newest first)
    }
    
    galleryEmitter.emit('update', [...galleryImagesData]);
    // console.log("[API/Gallery] New image processed for SSE broadcast.");

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

    galleryImagesData = galleryImagesData.filter(img => img.id !== id);
    
    galleryEmitter.emit('update', [...galleryImagesData]);
    // console.log(`[API/Gallery] Image with ID ${id} processed for deletion for SSE broadcast.`);

    return NextResponse.json({ message: 'Image deletion processed' }, { status: 200 });
  } catch (error) {
    console.error("[API/Gallery] Error deleting image (DELETE):", error);
    return NextResponse.json({ message: "Internal server error while deleting image." }, { status: 500 });
  }
}

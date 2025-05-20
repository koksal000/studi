
// src/app/api/gallery/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import galleryEmitter from '@/lib/gallery-emitter';
import { STATIC_GALLERY_IMAGES_FOR_SEEDING } from '@/lib/constants';

export interface GalleryImage {
  id: string;
  src: string; // For uploaded images, this will be a data URI
  alt: string;
  caption: string;
  hint: string;
}

// In-memory store for gallery images.
// WARNING: This data will be lost if the server restarts.
let galleryImagesData: GalleryImage[] = [];

// Initial seeding from constants if the in-memory store is empty
if (galleryImagesData.length === 0 && STATIC_GALLERY_IMAGES_FOR_SEEDING.length > 0) {
  galleryImagesData = [...STATIC_GALLERY_IMAGES_FOR_SEEDING];
}


export async function GET() {
  try {
    return NextResponse.json([...galleryImagesData].sort((a,b) => {
        // Basic sort: seed images first, then by caption. Could be more sophisticated.
        if (a.id.startsWith('seed_') && !b.id.startsWith('seed_')) return -1;
        if (!a.id.startsWith('seed_') && b.id.startsWith('seed_')) return 1;
        return a.caption.localeCompare(b.caption);
    }));
  } catch (error) {
    console.error("Error fetching gallery images:", error);
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

    // Basic validation for data URI (very basic)
    if (!imageDataUri.startsWith('data:image/')) {
        return NextResponse.json({ message: 'Invalid image data URI format.' }, { status: 400 });
    }
    // Rudimentary size check for base64 string (approx 1.37 * actual size)
    // 5MB limit for base64 string (approx 3.6MB actual file size)
    if (imageDataUri.length > 5 * 1024 * 1024 * 1.37) { 
        return NextResponse.json({ message: 'Image data is too large (max ~3.5MB file). Please use smaller images.' }, { status: 413 });
    }


    const newImage: GalleryImage = {
      id: `gal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      src: imageDataUri,
      alt: alt || caption,
      caption: caption,
      hint: hint || 'uploaded image',
    };

    galleryImagesData.unshift(newImage); 
    
    galleryEmitter.emit('update', [...galleryImagesData]);

    return NextResponse.json(newImage, { status: 201 });
  } catch (error) {
    console.error("Error creating gallery image:", error);
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

    galleryEmitter.emit('update', [...galleryImagesData]);

    return NextResponse.json({ message: 'Image deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json({ message: "Internal server error while deleting image." }, { status: 500 });
  }
}

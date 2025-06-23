
// src/app/api/gallery/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
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
const MAX_BASE64_SIZE_API = Math.floor(5 * 1024 * 1024 * 1.37 * 1.05); // Approx 7.2MB 

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

const readGalleryFromFile = (): GalleryImage[] => {
  try {
    if (fs.existsSync(GALLERY_FILE_PATH)) {
      const fileData = fs.readFileSync(GALLERY_FILE_PATH, 'utf-8');
      if (fileData.trim() === '' || fileData.trim() === '[]') {
        return [];
      }
      return (JSON.parse(fileData) as GalleryImage[]).sort(gallerySortFnInMemory);
    }
    return [];
  } catch (error) {
    console.error("[API/Gallery] Error reading gallery from file:", error);
    return [];
  }
};

const writeGalleryToFile = (images: GalleryImage[]): boolean => {
   try {
    const dir = path.dirname(GALLERY_FILE_PATH);
    if (!fs.existsSync(dir) && dataDir !== process.cwd()){ 
        fs.mkdirSync(dir, { recursive: true });
    }
    const sortedData = [...images].sort(gallerySortFnInMemory);
    fs.writeFileSync(GALLERY_FILE_PATH, JSON.stringify(sortedData, null, 2));
    return true;
  } catch (error) {
    console.error("[API/Gallery] CRITICAL: Error saving gallery to file:", error);
    return false;
  }
};

export async function GET() {
    let images = readGalleryFromFile();
    // If the gallery is empty (e.g., first run), seed it from constants.
    if (images.length === 0) {
        console.log("[API/Gallery] Gallery is empty, seeding with static images.");
        images = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFnInMemory);
        writeGalleryToFile(images);
    }
    return NextResponse.json(images);
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
      const limitMB = (MAX_BASE64_SIZE_API / (1024*1024)).toFixed(1);
      const rawEquivalentMB = (MAX_BASE64_SIZE_API / (1.37 * 1.05 * 1024 * 1024)).toFixed(1);
      return NextResponse.json({ message: `Resim verisi çok büyük. Maksimum işlenmiş veri boyutu ~${limitMB}MB olmalıdır (yaklaşık ~${rawEquivalentMB}MB ham dosya).` }, { status: 413 });
  }

  const images = readGalleryFromFile();
  
  const existingImageIndex = images.findIndex(img => img.id === newImage.id);

  if (existingImageIndex !== -1) {
    images[existingImageIndex] = newImage; 
  } else {
    images.unshift(newImage); // Add to the beginning
  }
  
  if (writeGalleryToFile(images)) {
    console.log(`[API/Gallery] Image ${newImage.id} processed and saved. Total images: ${images.length}`);
    return NextResponse.json(newImage, { status: 201 });
  } else {
    console.error(`[API/Gallery] Failed to save image ${newImage.id} to file.`);
    return NextResponse.json({ message: "Sunucu hatası: Galeri resmi kalıcı olarak kaydedilemedi." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'Silme için resim IDsi gerekli.' }, { status: 400 });
  }
    
  const images = readGalleryFromFile();
  const initialLength = images.length;
  const filteredGallery = images.filter(img => img.id !== id);

  if (filteredGallery.length < initialLength) {
    if (writeGalleryToFile(filteredGallery)) {
      console.log(`[API/Gallery] Image ${id} deleted and saved. Total images: ${filteredGallery.length}`);
      return NextResponse.json({ message: 'Resim başarıyla silindi' }, { status: 200 });
    } else {
      console.error(`[API/Gallery] Failed to save after deleting image ${id} from file.`);
      return NextResponse.json({ message: 'Sunucu hatası: Resim silindikten sonra değişiklikler kalıcı olarak kaydedilemedi.' }, { status: 500 });
    }
  } else {
    return NextResponse.json({ message: 'Silinecek resim bulunamadı' }, { status: 404 });
  }
}

    
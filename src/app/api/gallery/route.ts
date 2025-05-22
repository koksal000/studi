
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
  
  return a.id.localeCompare(b.id); 
};

const loadGalleryFromFile = () => {
  try {
    console.log(`[API/Gallery] DATA_PATH used: ${dataDir}`);
    console.log(`[API/Gallery] Attempting to load gallery from: ${GALLERY_FILE_PATH}`);
    if (fs.existsSync(GALLERY_FILE_PATH)) {
      const fileData = fs.readFileSync(GALLERY_FILE_PATH, 'utf-8');
      if (fileData.trim() === '' || fileData.trim() === '[]') {
        galleryImagesData = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFnInMemory);
        console.log(`[API/Gallery] File ${GALLERY_FILE_PATH} is empty or '[]'. Initializing with ${galleryImagesData.length} seed images and attempting to create/save.`);
        saveGalleryToFile(); 
      } else {
        const parsedData = JSON.parse(fileData) as GalleryImage[];
        galleryImagesData = parsedData.sort(gallerySortFnInMemory);
        console.log(`[API/Gallery] Successfully loaded ${galleryImagesData.length} images from file.`);
      }
    } else {
      galleryImagesData = [...STATIC_GALLERY_IMAGES_FOR_SEEDING].sort(gallerySortFnInMemory);
      console.log(`[API/Gallery] File ${GALLERY_FILE_PATH} not found. Initializing with ${galleryImagesData.length} seed images and attempting to create/save.`);
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
    if (!fs.existsSync(dir) && process.env.DATA_PATH){ 
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[API/Gallery] Created directory for data: ${dir}`);
    }
    const sortedData = [...galleryImagesData].sort(gallerySortFnInMemory);
    fs.writeFileSync(GALLERY_FILE_PATH, JSON.stringify(sortedData, null, 2));
    console.log(`[API/Gallery] Gallery data saved to ${GALLERY_FILE_PATH}`);
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

  const currentGalleryInMemory = [...galleryImagesData];
  const existingImageIndex = currentGalleryInMemory.findIndex(img => img.id === newImage.id);

  if (existingImageIndex !== -1) {
    currentGalleryInMemory[existingImageIndex] = newImage; 
  } else {
    currentGalleryInMemory.unshift(newImage); 
  }
  currentGalleryInMemory.sort(gallerySortFnInMemory); 
  
  galleryImagesData = currentGalleryInMemory; // Update in-memory first for SSE

  if (saveGalleryToFile()) {
    galleryEmitter.emit('update', [...galleryImagesData]);
    console.log(`[API/Gallery] Image ${newImage.id} processed and saved. Total images: ${galleryImagesData.length}`);
    return NextResponse.json(newImage, { status: 201 });
  } else {
    loadGalleryFromFile(); 
    console.error(`[API/Gallery] Failed to save image ${newImage.id} to file. In-memory change has been reverted.`);
    return NextResponse.json({ message: "Sunucu hatası: Galeri resmi kalıcı olarak kaydedilemedi. Değişiklik geri alındı." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'Image ID is required for deletion' }, { status: 400 });
  }
    
  const initialLength = galleryImagesData.length;
  const filteredGalleryInMemory = galleryImagesData.filter(img => img.id !== id);

  if (filteredGalleryInMemory.length < initialLength) {
    galleryImagesData = filteredGalleryInMemory; // Update in-memory first for SSE
    if (saveGalleryToFile()) {
      galleryEmitter.emit('update', [...galleryImagesData]);
      console.log(`[API/Gallery] Image ${id} deleted and saved. Total images: ${galleryImagesData.length}`);
      return NextResponse.json({ message: 'Resim başarıyla silindi' }, { status: 200 });
    } else {
      loadGalleryFromFile();
      console.error(`[API/Gallery] Failed to save after deleting image ${id} from file. In-memory change reverted.`);
      return NextResponse.json({ message: 'Sunucu hatası: Resim silindikten sonra değişiklikler kalıcı olarak kaydedilemedi. Değişiklik geri alındı.' }, { status: 500 });
    }
  } else {
    return NextResponse.json({ message: 'Silinecek resim bulunamadı' }, { status: 404 });
  }
}


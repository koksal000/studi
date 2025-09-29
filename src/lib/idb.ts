
// src/lib/idb.ts
import { openDB, type DBSchema } from 'idb';
import type { Announcement } from '@/hooks/use-announcements';
import type { GalleryImage } from '@/hooks/use-gallery';
import type { ContactMessage } from '@/hooks/use-contact-messages';

const DB_NAME = 'CamlicaKoyuDB';
const DB_VERSION = 1;
const ANNOUNCEMENTS_STORE = 'announcements';
const GALLERY_STORE = 'gallery';
const CONTACT_STORE = 'contact_messages';

interface CamlicaDBSchema extends DBSchema {
  [ANNOUNCEMENTS_STORE]: {
    key: string;
    value: Announcement;
    indexes: { 'date': string };
  };
  [GALLERY_STORE]: {
    key: string;
    value: GalleryImage;
  };
  [CONTACT_STORE]: {
    key: string;
    value: ContactMessage;
    indexes: { 'date': string };
  };
}

const dbPromise = openDB<CamlicaDBSchema>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(ANNOUNCEMENTS_STORE)) {
      const store = db.createObjectStore(ANNOUNCEMENTS_STORE, { keyPath: 'id' });
      store.createIndex('date', 'date');
    }
    if (!db.objectStoreNames.contains(GALLERY_STORE)) {
      db.createObjectStore(GALLERY_STORE, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(CONTACT_STORE)) {
        const store = db.createObjectStore(CONTACT_STORE, { keyPath: 'id' });
        store.createIndex('date', 'date');
    }
  },
});

// Generic CRUD operations
async function getAll<T extends keyof CamlicaDBSchema>(storeName: T): Promise<CamlicaDBSchema[T]['value'][]> {
  return (await dbPromise).getAll(storeName);
}

async function clearAndPutAll<T extends keyof CamlicaDBSchema>(storeName: T, data: CamlicaDBSchema[T]['value'][]): Promise<void> {
  const db = await dbPromise;
  const tx = db.transaction(storeName, 'readwrite');
  await tx.objectStore(storeName).clear();
  await Promise.all(data.map(item => tx.objectStore(storeName).put(item)));
  await tx.done;
}

// Announcements specific functions
export const getAnnouncementsFromDB = async (): Promise<Announcement[]> => {
  const announcements = await getAll(ANNOUNCEMENTS_STORE);
  return announcements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const cacheAnnouncementsToDB = async (announcements: Announcement[]): Promise<void> => {
  if (announcements && announcements.length > 0) {
    await clearAndPutAll(ANNOUNCEMENTS_STORE, announcements);
  }
};

// Gallery specific functions
export const getGalleryFromDB = async (): Promise<GalleryImage[]> => {
  return await getAll(GALLERY_STORE);
};

export const cacheGalleryToDB = async (images: GalleryImage[]): Promise<void> => {
   if (images && images.length > 0) {
    await clearAndPutAll(GALLERY_STORE, images);
   }
};

// Contact messages specific functions
export const getContactMessagesFromDB = async (): Promise<ContactMessage[]> => {
  const messages = await getAll(CONTACT_STORE);
  return messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const cacheContactMessagesToDB = async (messages: ContactMessage[]): Promise<void> => {
    if (messages && messages.length > 0) {
        await clearAndPutAll(CONTACT_STORE, messages);
    }
};

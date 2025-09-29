
// src/lib/idb.ts
import { openDB, type DBSchema } from 'idb';
import type { Announcement } from '@/hooks/use-announcements';
import type { GalleryImage } from '@/hooks/use-gallery';
import type { ContactMessage } from '@/hooks/use-contact-messages';

const DB_NAME = 'CamlicaKoyuDB';
const DB_VERSION = 2; // Version incremented for new stores
const ANNOUNCEMENTS_STORE = 'announcements';
const GALLERY_STORE = 'gallery';
const CONTACT_STORE = 'contact_messages';
// New stores for admin backup
const BACKUP_ANNOUNCEMENTS_STORE = 'backup-announcements';
const BACKUP_GALLERY_STORE = 'backup-gallery';
const BACKUP_META_STORE = 'backup-meta';

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
  [BACKUP_ANNOUNCEMENTS_STORE]: {
    key: string;
    value: Announcement;
  };
  [BACKUP_GALLERY_STORE]: {
    key: string;
    value: GalleryImage;
  };
  [BACKUP_META_STORE]: {
    key: string;
    value: any;
  };
}

const dbPromise = openDB<CamlicaDBSchema>(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion) {
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
    // Create new stores for backup if they don't exist
    if (oldVersion < 2) {
      if (!db.objectStoreNames.contains(BACKUP_ANNOUNCEMENTS_STORE)) {
        db.createObjectStore(BACKUP_ANNOUNCEMENTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(BACKUP_GALLERY_STORE)) {
        db.createObjectStore(BACKUP_GALLERY_STORE, { keyPath: 'id' });
      }
       if (!db.objectStoreNames.contains(BACKUP_META_STORE)) {
        db.createObjectStore(BACKUP_META_STORE, { keyPath: 'key' });
      }
    }
  },
});

// Generic CRUD operations
async function getAll<T extends keyof CamlicaDBSchema>(storeName: T): Promise<CamlicaDBSchema[T]['value'][]> {
  try {
    return (await dbPromise).getAll(storeName);
  } catch (error) {
    console.error(`[IDB] Error getting all from ${storeName}:`, error);
    return [];
  }
}

async function clearAndPutAll<T extends keyof CamlicaDBSchema>(storeName: T, data: CamlicaDBSchema[T]['value'][]): Promise<void> {
  try {
    const db = await dbPromise;
    const tx = db.transaction(storeName, 'readwrite');
    await tx.objectStore(storeName).clear();
    await Promise.all(data.map(item => tx.objectStore(storeName).put(item)));
    await tx.done;
  } catch (error) {
     console.error(`[IDB] Error in clearAndPutAll for ${storeName}:`, error);
  }
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

// --- Exported functions for Backup/Restore ---
export const getBackupAnnouncements = async (): Promise<Announcement[]> => getAll(BACKUP_ANNOUNCEMENTS_STORE);
export const cacheBackupAnnouncements = async (data: Announcement[]): Promise<void> => clearAndPutAll(BACKUP_ANNOUNCEMENTS_STORE, data);

export const getBackupGallery = async (): Promise<GalleryImage[]> => getAll(BACKUP_GALLERY_STORE);
export const cacheBackupGallery = async (data: GalleryImage[]): Promise<void> => clearAndPutAll(BACKUP_GALLERY_STORE, data);

export const getBackupMeta = async (): Promise<any> => (await dbPromise).get(BACKUP_META_STORE, 'backupInfo');
export const setBackupMeta = async (data: any): Promise<void> => {
  const db = await dbPromise;
  await db.put(BACKUP_META_STORE, { key: 'backupInfo', ...data });
};

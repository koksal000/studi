"use client";

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { Announcement } from '@/hooks/use-announcements';
import type { GalleryImage } from '@/hooks/use-gallery';
import type { ContactMessage } from '@/hooks/use-contact-messages';


export const DB_NAME = 'CamlicaKoyuDB';
export const DB_VERSION = 1;

export const STORES = {
  announcements: 'announcements',
  gallery: 'gallery',
  contactMessages: 'contactMessages',
} as const;

type StoreName = typeof STORES[keyof typeof STORES];

interface CamlicaKoyuDBSchema extends DBSchema {
  [STORES.announcements]: {
    key: string;
    value: Announcement;
  };
  [STORES.gallery]: {
    key: string;
    value: GalleryImage;
  };
  [STORES.contactMessages]: {
    key: string;
    value: ContactMessage;
  };
}

let dbPromise: Promise<IDBPDatabase<CamlicaKoyuDBSchema>> | null = null;

const getDb = (): Promise<IDBPDatabase<CamlicaKoyuDBSchema>> => {
  if (typeof window === 'undefined') {
    return new Promise(() => {});
  }
  if (!dbPromise) {
    dbPromise = openDB<CamlicaKoyuDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const storeName of Object.values(STORES)) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
      },
    });
  }
  return dbPromise;
};

export const idbGetAll = async <T>(storeName: StoreName): Promise<T[]> => {
  try {
    const db = await getDb();
    return await db.getAll(storeName);
  } catch (error) {
    console.error(`[idb] Failed to get all from ${storeName}:`, error);
    return [];
  }
};

export const idbSetAll = async <T extends { id: string }>(storeName: StoreName, items: T[]): Promise<void> => {
  try {
    const db = await getDb();
    const tx = db.transaction(storeName, 'readwrite');
    await Promise.all([
      tx.store.clear(),
      ...items.map(item => tx.store.put(item)),
      tx.done
    ]);
  } catch (error) {
    console.error(`[idb] Failed to set all in ${storeName}:`, error);
  }
};

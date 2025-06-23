// src/lib/idb.ts
"use client";

const DB_NAME = 'CamlicaKoyuDB_v1';
const DB_VERSION = 1;

// Define store names in one place
export const STORES = {
    ANNOUNCEMENTS: 'announcements',
    GALLERY: 'gallery',
    CONTACT_MESSAGES: 'contact-messages',
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB is not supported in this environment.');
      // Rejecting might be better to signal that caching is not possible.
      return reject(new Error('IndexedDB not supported.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.ANNOUNCEMENTS)) {
        // We will store the entire array of announcements as a single entry.
        db.createObjectStore(STORES.ANNOUNCEMENTS);
      }
      if (!db.objectStoreNames.contains(STORES.GALLERY)) {
        db.createObjectStore(STORES.GALLERY);
      }
       if (!db.objectStoreNames.contains(STORES.CONTACT_MESSAGES)) {
        db.createObjectStore(STORES.CONTACT_MESSAGES);
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
      dbPromise = null; // Reset promise on error
    };
  });
  return dbPromise;
}

export async function idbGet<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result as T | undefined);
      };
      request.onerror = () => {
        console.error(`Error getting item with key ${key} from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error(`Failed to open DB for get operation on ${storeName}:`, error);
    return undefined;
  }
}

export async function idbSet<T>(storeName: string, key: IDBValidKey, value: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value, key);

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        console.error(`Error setting item with key ${key} in ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error(`Failed to open DB for set operation on ${storeName}:`, error);
  }
}

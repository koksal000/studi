// src/lib/idb.ts
const DB_NAME = 'CamlicaKoyuDB';
const DB_VERSION = 1;
const USER_PROFILE_STORE = 'userProfileStore';
const APP_STATE_STORE = 'appStateStore';

interface UserProfile {
  id: string; // 'currentUser'
  name: string;
  surname: string;
}

interface AppStateItem {
  key: string;
  value: any;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB is not supported or not available in this environment.');
      // Create a mock DB interface that always fails or returns defaults for SSR/unsupported envs
      // This is a simplified fallback. A more robust solution might involve a different strategy.
      const mockDb = {
        transaction: () => ({
            objectStore: () => ({
                get: () => ({ then: (cb: any) => cb(undefined) } as unknown as IDBRequest),
                put: () => ({ then: (cb: any) => cb(undefined) } as unknown as IDBRequest),
                delete: () => ({ then: (cb: any) => cb(undefined) } as unknown as IDBRequest),
            }),
            oncomplete: null,
            onerror: null,
            onabort: null,
        }),
        close: () => {},
        // Add other necessary IDBDatabase methods if your functions use them directly
      } as unknown as IDBDatabase;
      // In a real app, you might want to reject or handle this case differently.
      // For now, we resolve with a mock that will likely lead to 'undefined' data.
      return resolve(mockDb); 
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(USER_PROFILE_STORE)) {
        db.createObjectStore(USER_PROFILE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(APP_STATE_STORE)) {
        db.createObjectStore(APP_STATE_STORE, { keyPath: 'key' });
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
     if (typeof db.transaction !== 'function') { // Check if it's the mock DB
      return undefined;
    }
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
    return undefined; // Or rethrow, depending on desired error handling
  }
}

export async function idbSet<T>(storeName: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    if (typeof db.transaction !== 'function') { // Check if it's the mock DB
      return;
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value);

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        console.error(`Error setting item in ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error(`Failed to open DB for set operation on ${storeName}:`, error);
    // Or rethrow
  }
}

export async function idbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  try {
    const db = await openDB();
     if (typeof db.transaction !== 'function') { // Check if it's the mock DB
      return;
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        console.error(`Error deleting item with key ${key} from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error(`Failed to open DB for delete operation on ${storeName}:`, error);
    // Or rethrow
  }
}

// Specific helpers
export const getUserProfile = async (): Promise<UserProfile | undefined> => {
  const profile = await idbGet<UserProfile>(USER_PROFILE_STORE, 'currentUser');
  return profile;
};

export const setUserProfile = async (name: string, surname: string): Promise<void> => {
  const profile: UserProfile = { id: 'currentUser', name, surname };
  await idbSet<UserProfile>(USER_PROFILE_STORE, profile);
};

export const deleteUserProfile = async (): Promise<void> => {
  await idbDelete(USER_PROFILE_STORE, 'currentUser');
};

export const getAppState = async <T>(key: string): Promise<T | undefined> => {
  const item = await idbGet<{key: string, value: T}>(APP_STATE_STORE, key);
  return item?.value;
};

export const setAppState = async <T>(key: string, value: T): Promise<void> => {
  await idbSet<{key: string, value: T}>(APP_STATE_STORE, { key, value });
};

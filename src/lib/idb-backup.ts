
// src/lib/idb-backup.ts
'use client';

import { 
    cacheBackupAnnouncements, 
    cacheBackupGallery, 
    getBackupAnnouncements, 
    getBackupGallery,
    getBackupMeta,
    setBackupMeta
} from './idb';
import type { Announcement } from '@/hooks/use-announcements';
import type { GalleryImage } from '@/hooks/use-gallery';


/**
 * Fetches all current data from server APIs and saves it to IndexedDB backup stores.
 */
export async function backupDataToIDB() {
    try {
        // Fetch announcements
        const annResponse = await fetch('/api/announcements');
        if (!annResponse.ok) throw new Error('Duyurular sunucudan alınamadı.');
        const announcements: Announcement[] = await annResponse.json();

        // Fetch gallery
        const galResponse = await fetch('/api/gallery');
        if (!galResponse.ok) throw new Error('Galeri sunucudan alınamadı.');
        const gallery: GalleryImage[] = await galResponse.json();
        
        // Save to backup stores
        await cacheBackupAnnouncements(announcements);
        await cacheBackupGallery(gallery);

        // Save metadata about the backup
        await setBackupMeta({
            date: new Date().toISOString(),
            announcementCount: announcements.length,
            galleryCount: gallery.length,
        });

    } catch (error: any) {
        console.error('[IDB Backup] Backup failed:', error);
        throw new Error(error.message || 'Yedekleme sırasında bir hata oluştu.');
    }
}


/**
 * Reads data from IndexedDB backup stores and posts it back to the server APIs.
 */
export async function restoreDataFromIDB(): Promise<{ announcements: number, gallery: number }> {
    try {
        const announcementsToRestore = await getBackupAnnouncements();
        const galleryToRestore = await getBackupGallery();

        if (announcementsToRestore.length === 0 && galleryToRestore.length === 0) {
            throw new Error('Geri yüklenecek yedek veri bulunamadı.');
        }

        // Restore announcements
        for (const announcement of announcementsToRestore) {
            // We post them one by one to recreate them on the server
            const response = await fetch('/api/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(announcement),
            });
            if (!response.ok) {
                console.warn(`[IDB Restore] Failed to restore announcement: ${announcement.id}`);
            }
            // Small delay to prevent overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 50)); 
        }

        // Restore gallery images
        for (const image of galleryToRestore) {
             const payload = {
                imageDataUri: image.src,
                caption: image.caption,
                alt: image.alt,
                hint: image.hint
             };
            const response = await fetch('/api/gallery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
             if (!response.ok) {
                console.warn(`[IDB Restore] Failed to restore gallery image: ${image.caption}`);
            }
            await new Promise(resolve => setTimeout(resolve, 100)); // Longer delay for uploads
        }

        return {
            announcements: announcementsToRestore.length,
            gallery: galleryToRestore.length,
        };

    } catch (error: any) {
        console.error('[IDB Restore] Restore failed:', error);
        throw new Error(error.message || 'Geri yükleme sırasında bir hata oluştu.');
    }
}

/**
 * Gets metadata about the last backup from IndexedDB.
 */
export async function getBackupInfo(): Promise<{ date: Date; announcementCount: number; galleryCount: number } | null> {
    try {
        const meta = await getBackupMeta();
        if (meta && meta.date) {
            return {
                date: new Date(meta.date),
                announcementCount: meta.announcementCount || 0,
                galleryCount: meta.galleryCount || 0,
            };
        }
        return null;
    } catch (error) {
        console.error('[IDB Backup] Could not get backup info:', error);
        return null;
    }
}

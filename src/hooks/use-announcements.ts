
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { usePeer, ADMIN_PEER_ID_PREFIX } from '@/contexts/peer-context';
import { useSettings } from '@/contexts/settings-context'; // Added import for useSettings

export interface Announcement {
  id: string;
  title: string;
  content: string;
  media?: string | null; // URL or base64
  mediaType?: string | null; // e.g., 'image/png', 'video/mp4', 'url'
  date: string; // ISO string
  author: string; // Name Surname
  authorId?: string; // Optional: ID of the author for precise control
}

const ANNOUNCEMENTS_KEY = 'camlicaKoyuAnnouncements';

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const { user, isAdmin } = useUser();
  const peerContext = usePeer();
  const { notificationsEnabled: siteNotificationsPreference } = useSettings(); // Get notification preference

  // Load initial announcements from localStorage
  useEffect(() => {
    try {
      const storedAnnouncements = localStorage.getItem(ANNOUNCEMENTS_KEY);
      if (storedAnnouncements) {
        const parsedAnnouncements: Announcement[] = JSON.parse(storedAnnouncements);
        parsedAnnouncements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAnnouncements(parsedAnnouncements);
      }
    } catch (error) {
      console.error("Failed to parse announcements from localStorage", error);
      setAnnouncements([]);
    }
  }, []);
  
  useEffect(() => {
    if (peerContext && peerContext.registerDataHandler && typeof window !== 'undefined' && window.Notification) {
      peerContext.registerDataHandler((data: any, fromPeerId: string) => {
        console.log("useAnnouncements received data from peer:", data, "from:", fromPeerId);
        if (data.type === 'NEW_ANNOUNCEMENT') {
          const newAnnouncement = data.payload as Announcement;
          setAnnouncements(prev => {
            if (prev.find(ann => ann.id === newAnnouncement.id)) return prev;
            const newAnnouncements = [newAnnouncement, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(newAnnouncements));
            return newAnnouncements;
          });

          // Show notification if enabled and permission granted
          if (siteNotificationsPreference && Notification.permission === 'granted') {
            const notificationBody = newAnnouncement.content.length > 120 
              ? newAnnouncement.content.substring(0, 120) + "..." 
              : newAnnouncement.content;
            
            const notification = new Notification(newAnnouncement.title, {
              body: notificationBody,
              tag: newAnnouncement.id, // Use ID as tag to prevent multiple notifications for the same announcement if re-broadcasted
            });
             // Optional: Handle click to focus window/tab and navigate
            notification.onclick = () => {
              window.focus();
              // You might want to navigate to the announcements page or the specific announcement
              // For simplicity, this is commented out, but you can use Next.js router here
              // import { useRouter } from 'next/navigation'; (at top)
              // const router = useRouter(); (at top of hook, careful with hook rules)
              // router.push('/announcements'); 
            };
          }

        } else if (data.type === 'DELETE_ANNOUNCEMENT') {
          setAnnouncements(prev => {
            const updatedAnnouncements = prev.filter(ann => ann.id !== data.payload.id);
            localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
            return updatedAnnouncements;
          });
        } else if (data.type === 'REQUEST_INITIAL_ANNOUNCEMENTS' && isAdmin && user) {
           console.log(`Admin ${peerContext.peerId} received request for initial announcements from ${fromPeerId}`);
           const currentAnnouncements = JSON.parse(localStorage.getItem(ANNOUNCEMENTS_KEY) || '[]');
           peerContext.sendDataToPeer(fromPeerId, { type: 'INITIAL_ANNOUNCEMENTS', payload: currentAnnouncements });
        } else if (data.type === 'INITIAL_ANNOUNCEMENTS') {
           console.log(`Client ${peerContext.peerId} received initial announcements from ${fromPeerId}`);
           const receivedAnnouncements: Announcement[] = data.payload;
           receivedAnnouncements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
           setAnnouncements(receivedAnnouncements);
           localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(receivedAnnouncements));
        }
      });
    }
  }, [peerContext, user, isAdmin, announcements.length, siteNotificationsPreference]);

  const addAnnouncement = useCallback((newAnnouncementData: Omit<Announcement, 'id' | 'date' | 'author' | 'authorId'>) => {
    if (!user) return; 

    const announcement: Announcement = {
      ...newAnnouncementData,
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: new Date().toISOString(),
      author: `${user.name} ${user.surname}`,
    };

    setAnnouncements(prev => {
      const updatedAnnouncements = [announcement, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
      return updatedAnnouncements;
    });

    if (isAdmin && peerContext && peerContext.broadcastData) {
      console.log("Admin broadcasting new announcement:", announcement);
      peerContext.broadcastData({ type: 'NEW_ANNOUNCEMENT', payload: announcement });
    }
    return announcement; 
  }, [user, isAdmin, peerContext]);

  const deleteAnnouncement = useCallback((id: string) => {
    setAnnouncements(prev => {
      const updatedAnnouncements = prev.filter(ann => ann.id !== id);
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
      return updatedAnnouncements;
    });

    if (isAdmin && peerContext && peerContext.broadcastData) {
      console.log("Admin broadcasting delete announcement:", id);
      peerContext.broadcastData({ type: 'DELETE_ANNOUNCEMENT', payload: { id } });
    }
  }, [isAdmin, peerContext]);
  
  const getAnnouncementById = useCallback((id: string) => {
    return announcements.find(ann => ann.id === id);
  }, [announcements]);

  const syncAnnouncementsFromPeer = useCallback((peerAnnouncements: Announcement[]) => {
    const sortedAnnouncements = [...peerAnnouncements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setAnnouncements(sortedAnnouncements);
    localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(sortedAnnouncements));
    console.log("Announcements explicitly synced and saved to localStorage.");
  }, []);


  return { announcements, addAnnouncement, deleteAnnouncement, getAnnouncementById, syncAnnouncementsFromPeer };
}

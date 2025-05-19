
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { usePeer, ADMIN_PEER_ID_PREFIX } from '@/contexts/peer-context'; // Import usePeer

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
  const peerContext = usePeer(); // Get peer context

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
  
  // Effect to register data handler with PeerContext and request initial announcements
  useEffect(() => {
    if (peerContext && peerContext.registerDataHandler) {
      peerContext.registerDataHandler((data: any, fromPeerId: string) => {
        console.log("useAnnouncements received data from peer:", data, "from:", fromPeerId);
        if (data.type === 'NEW_ANNOUNCEMENT') {
          // Avoid adding if it already exists (e.g., admin's own broadcast)
          setAnnouncements(prev => {
            if (prev.find(ann => ann.id === data.payload.id)) return prev;
            const newAnnouncements = [data.payload, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(newAnnouncements));
            return newAnnouncements;
          });
        } else if (data.type === 'DELETE_ANNOUNCEMENT') {
          setAnnouncements(prev => {
            const updatedAnnouncements = prev.filter(ann => ann.id !== data.payload.id);
            localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
            return updatedAnnouncements;
          });
        } else if (data.type === 'REQUEST_INITIAL_ANNOUNCEMENTS' && isAdmin && user) {
           // Admin receives a request and sends all current announcements back
           console.log(`Admin ${peerContext.peerId} received request for initial announcements from ${fromPeerId}`);
           const currentAnnouncements = JSON.parse(localStorage.getItem(ANNOUNCEMENTS_KEY) || '[]');
           peerContext.sendDataToPeer(fromPeerId, { type: 'INITIAL_ANNOUNCEMENTS', payload: currentAnnouncements });
        } else if (data.type === 'INITIAL_ANNOUNCEMENTS') {
           // Client receives the full list of announcements
           console.log(`Client ${peerContext.peerId} received initial announcements from ${fromPeerId}`);
           const receivedAnnouncements: Announcement[] = data.payload;
           receivedAnnouncements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
           setAnnouncements(receivedAnnouncements);
           localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(receivedAnnouncements));
        }
      });
    }

    // If not admin and peer is initialized, request initial announcements
    // This check is now primarily handled within PeerProvider upon connection to admin.
    // However, an explicit call here can be a fallback if needed or if connection logic changes.
    if (peerContext && peerContext.peerId && !isAdmin && announcements.length === 0) {
        // Check if already connected to an admin, if not, PeerProvider's connectToPeer will try to connect.
        // The request for initial announcements is now triggered within connectToPeer in PeerProvider
        // when a non-admin successfully connects to an admin.
        // So, an explicit call to peerContext.requestInitialAnnouncements() here might be redundant
        // if PeerProvider handles it. However, it can serve as a fallback.
        // Let's rely on PeerProvider's connection logic for the initial request.
    }

  }, [peerContext, user, isAdmin, announcements.length]); // Added announcements.length to dependencies for initial request logic

  const addAnnouncement = useCallback((newAnnouncementData: Omit<Announcement, 'id' | 'date' | 'author' | 'authorId'>) => {
    if (!user) return; 

    const announcement: Announcement = {
      ...newAnnouncementData,
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: new Date().toISOString(),
      author: `${user.name} ${user.surname}`,
    };

    // Update local state and localStorage immediately
    setAnnouncements(prev => {
      const updatedAnnouncements = [announcement, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
      return updatedAnnouncements;
    });

    // Broadcast to peers if admin
    if (isAdmin && peerContext && peerContext.broadcastData) {
      console.log("Admin broadcasting new announcement:", announcement);
      peerContext.broadcastData({ type: 'NEW_ANNOUNCEMENT', payload: announcement });
    }
    return announcement; 
  }, [user, isAdmin, peerContext]);

  const deleteAnnouncement = useCallback((id: string) => {
    // Update local state and localStorage immediately
    setAnnouncements(prev => {
      const updatedAnnouncements = prev.filter(ann => ann.id !== id);
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
      return updatedAnnouncements;
    });

    // Broadcast to peers if admin
    if (isAdmin && peerContext && peerContext.broadcastData) {
      console.log("Admin broadcasting delete announcement:", id);
      peerContext.broadcastData({ type: 'DELETE_ANNOUNCEMENT', payload: { id } });
    }
  }, [isAdmin, peerContext]);
  
  const getAnnouncementById = useCallback((id: string) => {
    return announcements.find(ann => ann.id === id);
  }, [announcements]);

  // This function is now conceptually replaced by the data handler registered with PeerContext.
  const syncAnnouncementsFromPeer = useCallback((peerAnnouncements: Announcement[]) => {
    const sortedAnnouncements = [...peerAnnouncements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setAnnouncements(sortedAnnouncements);
    localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(sortedAnnouncements));
    console.log("Announcements explicitly synced and saved to localStorage.");
  }, []);


  return { announcements, addAnnouncement, deleteAnnouncement, getAnnouncementById, syncAnnouncementsFromPeer };
}

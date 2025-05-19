
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { usePeer, ADMIN_PEER_ID_PREFIX } from '@/contexts/peer-context';
import { useSettings } from '@/contexts/settings-context'; 

export interface Announcement {
  id: string;
  title: string;
  content: string;
  media?: string | null; 
  mediaType?: string | null; 
  date: string; 
  author: string; 
  authorId?: string; 
}

// Payload for delete announcement broadcast
interface DeleteAnnouncementPayload {
  id: string;
  authorId?: string; // Who initiated the delete
}


const ANNOUNCEMENTS_KEY = 'camlicaKoyuAnnouncements';

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const { user, isAdmin } = useUser();
  const peerContext = usePeer();
  const { notificationsEnabled: siteNotificationsPreference } = useSettings(); 

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
    if (!peerContext || !peerContext.registerDataHandler || typeof window === 'undefined') {
      return;
    }

    const handleData = (data: any, fromPeerId: string) => {
      console.log("useAnnouncements received data from peer:", data, "from:", fromPeerId);
      if (data.type === 'NEW_ANNOUNCEMENT') {
        const newAnnouncement = data.payload as Announcement;
        
        // Avoid adding if already exists (e.g., re-broadcast from admin)
        if (announcements.find(ann => ann.id === newAnnouncement.id)) {
          console.log("Announcement already exists, not adding:", newAnnouncement.id);
          return;
        }

        setAnnouncements(prev => {
          const updatedAnnouncements = [newAnnouncement, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
          return updatedAnnouncements;
        });

        if (siteNotificationsPreference && Notification.permission === 'granted') {
          const notificationBody = newAnnouncement.content.length > 120 
            ? newAnnouncement.content.substring(0, 120) + "..." 
            : newAnnouncement.content;
          
          const notification = new Notification(newAnnouncement.title, {
            body: notificationBody,
            tag: newAnnouncement.id, 
          });
          notification.onclick = () => {
            window.focus();
          };
        }

        // If current user is admin AND the announcement did not originate from this admin, re-broadcast it.
        if (isAdmin && peerContext.peerId && newAnnouncement.authorId !== peerContext.peerId) {
            console.log(`Admin ${peerContext.peerId} re-broadcasting new announcement from ${newAnnouncement.authorId}`);
            peerContext.broadcastData({ type: 'NEW_ANNOUNCEMENT', payload: newAnnouncement });
        }

      } else if (data.type === 'DELETE_ANNOUNCEMENT') {
        const deletePayload = data.payload as DeleteAnnouncementPayload;
        setAnnouncements(prev => {
          const updatedAnnouncements = prev.filter(ann => ann.id !== deletePayload.id);
          localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
          return updatedAnnouncements;
        });

        // If current user is admin AND the delete request did not originate from this admin, re-broadcast it.
        if (isAdmin && peerContext.peerId && deletePayload.authorId !== peerContext.peerId) {
            console.log(`Admin ${peerContext.peerId} re-broadcasting delete request for ID ${deletePayload.id} from ${deletePayload.authorId}`);
            peerContext.broadcastData({ type: 'DELETE_ANNOUNCEMENT', payload: deletePayload });
        }

      } else if (data.type === 'REQUEST_INITIAL_ANNOUNCEMENTS' && user) { // Any user can serve initial announcements if they have them
         if (peerContext.peerId && peerContext.sendDataToPeer) {
            console.log(`Peer ${peerContext.peerId} received request for initial announcements from ${fromPeerId}. Sending local announcements.`);
            const currentAnnouncements = JSON.parse(localStorage.getItem(ANNOUNCEMENTS_KEY) || '[]');
            peerContext.sendDataToPeer(fromPeerId, { type: 'INITIAL_ANNOUNCEMENTS', payload: currentAnnouncements });
         }
      } else if (data.type === 'INITIAL_ANNOUNCEMENTS') {
         if (peerContext.peerId) { 
            console.log(`Client ${peerContext.peerId} received initial announcements from ${fromPeerId}`);
            const receivedAnnouncements: Announcement[] = data.payload;
             // Merge carefully to avoid duplicates and respect newer data if possible (simple overwrite for now)
            const localAnnouncements = JSON.parse(localStorage.getItem(ANNOUNCEMENTS_KEY) || '[]') as Announcement[];
            const combinedAnnouncements = [...localAnnouncements];
            receivedAnnouncements.forEach(receivedAnn => {
                if(!combinedAnnouncements.find(localAnn => localAnn.id === receivedAnn.id)) {
                    combinedAnnouncements.push(receivedAnn);
                }
            });

            combinedAnnouncements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setAnnouncements(combinedAnnouncements);
            localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(combinedAnnouncements));
         } else {
            console.warn("Client received initial announcements but peerId is not available yet.");
         }
      }
    };

    peerContext.registerDataHandler(handleData);

  }, [peerContext, isAdmin, user, siteNotificationsPreference, announcements]); // Added announcements to dependency array for the duplicate check

  const addAnnouncement = useCallback((newAnnouncementData: Omit<Announcement, 'id' | 'date' | 'author' | 'authorId'>) => {
    if (!user) return; 

    const announcement: Announcement = {
      ...newAnnouncementData,
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: new Date().toISOString(),
      author: `${user.name} ${user.surname}`,
      authorId: peerContext.peerId || 'unknown_author_peer_id' 
    };

    // Update local state and localStorage first
    setAnnouncements(prev => {
      const updatedAnnouncements = [announcement, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
      return updatedAnnouncements;
    });

    // Then broadcast to other peers
    if (peerContext && peerContext.broadcastData) {
      console.log(`User ${peerContext.peerId || 'unknown'} broadcasting new announcement:`, announcement);
      peerContext.broadcastData({ type: 'NEW_ANNOUNCEMENT', payload: announcement });
    }
    return announcement; 
  }, [user, peerContext, setAnnouncements]);

  const deleteAnnouncement = useCallback((id: string) => {
    // Update local state and localStorage first
    setAnnouncements(prev => {
      const updatedAnnouncements = prev.filter(ann => ann.id !== id);
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
      return updatedAnnouncements;
    });

    // Then broadcast to other peers
    if (peerContext && peerContext.broadcastData) {
      const deletePayload: DeleteAnnouncementPayload = {
        id,
        authorId: peerContext.peerId || 'unknown_author_peer_id'
      };
      console.log(`User ${peerContext.peerId || 'unknown'} broadcasting delete announcement:`, deletePayload);
      peerContext.broadcastData({ type: 'DELETE_ANNOUNCEMENT', payload: deletePayload });
    }
  }, [peerContext, setAnnouncements]);
  
  const getAnnouncementById = useCallback((id: string) => {
    return announcements.find(ann => ann.id === id);
  }, [announcements]);

  // This function can be called if a peer explicitly wants to resync from another
  const syncAnnouncementsFromPeer = useCallback((peerAnnouncements: Announcement[]) => {
    const sortedAnnouncements = [...peerAnnouncements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setAnnouncements(sortedAnnouncements);
    localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(sortedAnnouncements));
    console.log("Announcements explicitly synced and saved to localStorage.");
  }, [setAnnouncements]);


  return { announcements, addAnnouncement, deleteAnnouncement, getAnnouncementById, syncAnnouncementsFromPeer };
}


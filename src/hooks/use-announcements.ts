
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { usePeer } from '@/contexts/peer-context';
import { useSettings } from '@/contexts/settings-context'; 

export interface Announcement {
  id: string;
  title: string;
  content: string;
  media?: string | null; 
  mediaType?: string | null; 
  date: string; 
  author: string; 
  authorId: string;
}

interface DeleteAnnouncementPayload {
  id: string;
  authorId: string;
}

const ANNOUNCEMENTS_KEY = 'camlicaKoyuAnnouncements';

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const { user } = useUser();
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
    if (!peerContext || !peerContext.registerDataHandler || typeof window === 'undefined' || !peerContext.peerId) {
      return;
    }

    const handleData = (data: any, fromPeerId: string) => {
      console.log("useAnnouncements received data from peer:", data, "from:", fromPeerId);
      
      if (data.type === 'NEW_ANNOUNCEMENT') {
        const newAnnouncement = data.payload as Announcement;
        
        const isDuplicate = announcements.some(ann => ann.id === newAnnouncement.id);
        if (isDuplicate) {
            console.log("New announcement is already present, skipping. Author:", newAnnouncement.authorId, "My ID:", peerContext.peerId);
            return;
        }
        
        // Process locally
        setAnnouncements(prev => {
          const updatedAnnouncements = [newAnnouncement, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
          return updatedAnnouncements;
        });

        if (newAnnouncement.authorId !== peerContext.peerId && siteNotificationsPreference && Notification.permission === 'granted') {
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

        // Re-broadcast to other connected peers (excluding the sender) if this peer is not the original author
        if (newAnnouncement.authorId !== peerContext.peerId) {
            console.log(`Peer ${peerContext.peerId} re-broadcasting new announcement (originated by ${newAnnouncement.authorId}, received from ${fromPeerId}).`);
            peerContext.broadcastData({ type: 'NEW_ANNOUNCEMENT', payload: newAnnouncement }, fromPeerId);
        }

      } else if (data.type === 'DELETE_ANNOUNCEMENT') {
        const deletePayload = data.payload as DeleteAnnouncementPayload;
        
        let wasDeleted = false;
        setAnnouncements(prev => {
          const initialLength = prev.length;
          const updatedAnnouncements = prev.filter(ann => ann.id !== deletePayload.id);
          if (updatedAnnouncements.length < initialLength) {
            wasDeleted = true;
            localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
          }
          return updatedAnnouncements;
        });

        if(wasDeleted && deletePayload.authorId !== peerContext.peerId){
            console.log(`Peer ${peerContext.peerId} re-broadcasting delete request for ID ${deletePayload.id} (originated by ${deletePayload.authorId}, received from ${fromPeerId}).`);
            peerContext.broadcastData({ type: 'DELETE_ANNOUNCEMENT', payload: deletePayload }, fromPeerId);
        }

      } else if (data.type === 'REQUEST_INITIAL_ANNOUNCEMENTS' && user && peerContext.peerId) {
         console.log(`Peer ${peerContext.peerId} received request for initial announcements from ${fromPeerId}. Sending local announcements.`);
         const currentAnnouncements = JSON.parse(localStorage.getItem(ANNOUNCEMENTS_KEY) || '[]');
         peerContext.sendDataToPeer(fromPeerId, { type: 'INITIAL_ANNOUNCEMENTS', payload: currentAnnouncements });
      
      } else if (data.type === 'INITIAL_ANNOUNCEMENTS') {
         if (peerContext.peerId) { 
            console.log(`Client ${peerContext.peerId} received initial announcements from ${fromPeerId}.`);
            const receivedAnnouncements: Announcement[] = data.payload;
            
            setAnnouncements(prevLocalAnnouncements => {
                const combinedAnnouncementsMap = new Map<string, Announcement>();
                // Add local announcements first
                prevLocalAnnouncements.forEach(ann => combinedAnnouncementsMap.set(ann.id, ann));
                // Then add received announcements, overwriting if ID exists (though unlikely to differ if IDs are unique)
                // or adding if new.
                receivedAnnouncements.forEach(receivedAnn => {
                    if (!combinedAnnouncementsMap.has(receivedAnn.id)) {
                        combinedAnnouncementsMap.set(receivedAnn.id, receivedAnn);
                    }
                });
                
                const combinedAnnouncements = Array.from(combinedAnnouncementsMap.values());
                combinedAnnouncements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(combinedAnnouncements));
                return combinedAnnouncements;
            });
         } else {
            console.warn("Client received initial announcements but peerId is not available yet.");
         }
      }
    };

    peerContext.registerDataHandler(handleData);
    // No explicit cleanup needed for registerDataHandler if it just overwrites the ref.

  }, [peerContext, user, siteNotificationsPreference, announcements]); 

  const addAnnouncement = useCallback((newAnnouncementData: Omit<Announcement, 'id' | 'date' | 'author' | 'authorId'>) => {
    if (!user || !peerContext.peerId) {
      console.warn("Cannot add announcement: User or PeerID not available.", user, peerContext.peerId);
      return; 
    }

    const announcement: Announcement = {
      ...newAnnouncementData,
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: new Date().toISOString(),
      author: `${user.name} ${user.surname}`,
      authorId: peerContext.peerId 
    };

    // Process locally first
    setAnnouncements(prev => {
      const updatedAnnouncements = [announcement, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
      return updatedAnnouncements;
    });

    // Broadcast to connected peers
    console.log(`Peer ${peerContext.peerId} broadcasting new announcement locally:`, announcement);
    peerContext.broadcastData({ type: 'NEW_ANNOUNCEMENT', payload: announcement });
    
    return announcement; 
  }, [user, peerContext, setAnnouncements]);

  const deleteAnnouncement = useCallback((id: string) => {
     if (!user || !peerContext.peerId) {
      console.warn("Cannot delete announcement: User or PeerID not available.");
      return; 
    }
    
    // Process locally first
    setAnnouncements(prev => {
      const updatedAnnouncements = prev.filter(ann => ann.id !== id);
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
      return updatedAnnouncements;
    });

    // Broadcast deletion to connected peers
    const deletePayload: DeleteAnnouncementPayload = {
      id,
      authorId: peerContext.peerId
    };
    console.log(`Peer ${peerContext.peerId} broadcasting delete announcement locally:`, deletePayload);
    peerContext.broadcastData({ type: 'DELETE_ANNOUNCEMENT', payload: deletePayload });

  }, [user, peerContext, setAnnouncements]);
  
  const getAnnouncementById = useCallback((id: string) => {
    return announcements.find(ann => ann.id === id);
  }, [announcements]);

  // This function might be called if a more authoritative set of announcements is received
  const syncAnnouncementsFromPeer = useCallback((peerAnnouncements: Announcement[]) => {
    const sortedAnnouncements = [...peerAnnouncements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setAnnouncements(sortedAnnouncements);
    localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(sortedAnnouncements));
    console.log("Announcements explicitly synced and saved to localStorage.");
  }, [setAnnouncements]);


  return { announcements, addAnnouncement, deleteAnnouncement, getAnnouncementById, syncAnnouncementsFromPeer };
}

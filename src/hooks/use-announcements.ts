"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';

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
  const { user } = useUser();

  useEffect(() => {
    try {
      const storedAnnouncements = localStorage.getItem(ANNOUNCEMENTS_KEY);
      if (storedAnnouncements) {
        const parsedAnnouncements: Announcement[] = JSON.parse(storedAnnouncements);
        // Sort by date descending
        parsedAnnouncements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAnnouncements(parsedAnnouncements);
      }
    } catch (error) {
      console.error("Failed to parse announcements from localStorage", error);
      setAnnouncements([]);
    }
  }, []);

  const addAnnouncement = useCallback((newAnnouncementData: Omit<Announcement, 'id' | 'date' | 'author' | 'authorId'>) => {
    if (!user) return; // Should not happen if UI restricts properly

    const announcement: Announcement = {
      ...newAnnouncementData,
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: new Date().toISOString(),
      author: `${user.name} ${user.surname}`,
      // authorId: user.id, // If you have a unique user ID
    };

    setAnnouncements(prev => {
      const updatedAnnouncements = [announcement, ...prev];
      // Sort by date descending (though prepending already does this if list was sorted)
      updatedAnnouncements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
      return updatedAnnouncements;
    });
    return announcement;
  }, [user]);

  const deleteAnnouncement = useCallback((id: string) => {
    setAnnouncements(prev => {
      const updatedAnnouncements = prev.filter(ann => ann.id !== id);
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
      return updatedAnnouncements;
    });
  }, []);
  
  const getAnnouncementById = useCallback((id: string) => {
    return announcements.find(ann => ann.id === id);
  }, [announcements]);

  return { announcements, addAnnouncement, deleteAnnouncement, getAnnouncementById };
}

"use client";

import type { Announcement } from '@/hooks/use-announcements';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Image from 'next/image';
import { UserCircle, CalendarDays, Link2 } from 'lucide-react';

interface AnnouncementDetailDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  announcement: Announcement | null;
}

export function AnnouncementDetailDialog({ isOpen, onOpenChange, announcement }: AnnouncementDetailDialogProps) {
  if (!announcement) {
    return null;
  }

  const formattedDate = new Date(announcement.date).toLocaleDateString('tr-TR', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const renderMedia = () => {
    if (!announcement.media) return null;

    if (announcement.mediaType?.startsWith('image/')) { // Catches 'image/png', 'image/jpeg', 'image/url'
      return (
        <div className="my-4 rounded-md overflow-hidden aspect-video relative bg-muted">
          <Image
            src={announcement.media}
            alt={announcement.title}
            layout="fill"
            objectFit="contain"
            data-ai-hint="announcement media detail"
          />
        </div>
      );
    }
    if (announcement.mediaType?.startsWith('video/')) { // Catches 'video/mp4', 'video/url' (including YouTube if identified as video/url)
      // Basic YouTube embed logic (can be improved with a proper library)
      if (announcement.media.includes("youtube.com/watch?v=") || announcement.media.includes("youtu.be/")) {
        const videoId = announcement.media.includes("youtu.be/") 
          ? announcement.media.split("youtu.be/")[1].split("?")[0]
          : new URL(announcement.media).searchParams.get("v");
        if (videoId) {
          return (
            <div className="my-4 rounded-md overflow-hidden aspect-video relative bg-muted">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute top-0 left-0 w-full h-full"
              ></iframe>
            </div>
          );
        }
      }
      // Fallback for other video URLs
      return (
        <video src={announcement.media} controls className="my-4 w-full rounded-md max-h-[400px]" />
      );
    }
    if (announcement.mediaType === 'url/link') { // Generic link
        return (
            <div className="my-4 p-3 bg-muted rounded-md">
                <a
                    href={announcement.media}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center"
                >
                    <Link2 className="h-4 w-4 mr-2"/>
                    Medyayı Görüntüle: {announcement.media.substring(0,50)}{announcement.media.length > 50 ? "..." : ""}
                </a>
            </div>
        );
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b flex-shrink-0">
          <DialogTitle className="text-xl sm:text-2xl">{announcement.title}</DialogTitle>
          <DialogDescription asChild className="text-xs pt-1">
            <div className="text-muted-foreground"> {/* Wrapper div */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 items-center mt-1 text-muted-foreground">
                  <span className="flex items-center"><CalendarDays className="h-3.5 w-3.5 mr-1" /> {formattedDate}</span>
                  <span className="flex items-center"><UserCircle className="h-3.5 w-3.5 mr-1" /> {announcement.author}</span>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-4">
          {renderMedia()}
          <p className="text-sm text-foreground/90 whitespace-pre-wrap">
            {announcement.content}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

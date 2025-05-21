
"use client";

import type { Announcement } from '@/hooks/use-announcements';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Image from 'next/image';
import { UserCircle, CalendarDays, Link2 } from 'lucide-react'; // Link2 eklendi

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

    if (announcement.mediaType?.startsWith('image/')) {
      return (
        <div className="my-4 rounded-md overflow-hidden aspect-video relative bg-muted">
          <Image
            src={announcement.media}
            alt={announcement.title}
            layout="fill"
            objectFit="contain"
            data-ai-hint="announcement image detail"
          />
        </div>
      );
    }
    if (announcement.mediaType?.startsWith('video/')) {
      return (
        <video src={announcement.media} controls className="my-4 w-full rounded-md max-h-[400px]" />
      );
    }
    if (announcement.mediaType === 'url') { // Check if it's a generic URL
      // Attempt to render if it's an image or video URL
      if (/\.(jpeg|jpg|gif|png)$/i.test(announcement.media)) {
        return (
          <div className="my-4 rounded-md overflow-hidden aspect-video relative bg-muted">
            <Image
              src={announcement.media}
              alt={announcement.title}
              layout="fill"
              objectFit="contain"
              data-ai-hint="announcement image detail"
            />
          </div>
        );
      } else if (/\.(mp4|webm|ogg)$/i.test(announcement.media)) {
        return <video src={announcement.media} controls className="my-4 w-full rounded-md max-h-[400px]" />;
      } else {
        // If it's a generic URL that's not an image or video, display a link
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
              <div className="flex flex-wrap gap-x-3 gap-y-1 items-center mt-1">
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

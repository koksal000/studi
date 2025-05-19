"use client";

import type { Announcement } from '@/hooks/use-announcements';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, UserCircle, CalendarDays, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { useUser } from '@/contexts/user-context';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AnnouncementCardProps {
  announcement: Announcement;
  isCompact?: boolean; // For home page recent announcements
}

export function AnnouncementCard({ announcement, isCompact = false }: AnnouncementCardProps) {
  const { user, isAdmin } = useUser();
  const { deleteAnnouncement: removeAnnouncement } = useAnnouncements();
  const { toast } = useToast();

  const canDelete = isAdmin || (user && announcement.author === `${user.name} ${user.surname}`);

  const handleDelete = () => {
    removeAnnouncement(announcement.id);
    toast({
      title: "Duyuru Silindi",
      description: `"${announcement.title}" başlıklı duyuru başarıyla silindi.`,
    });
  };

  const formattedDate = new Date(announcement.date).toLocaleDateString('tr-TR', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const renderMedia = () => {
    if (!announcement.media) return null;

    if (announcement.mediaType?.startsWith('image/')) {
      // Base64 image or direct image URL
      return (
        <div className="my-4 rounded-md overflow-hidden aspect-video relative bg-muted">
          <Image 
            src={announcement.media} 
            alt={announcement.title} 
            layout="fill"
            objectFit="contain" 
            data-ai-hint="announcement image"
          />
        </div>
      );
    }
    if (announcement.mediaType?.startsWith('video/')) {
      // Base64 video or direct video URL
      return (
        <video src={announcement.media} controls className="my-4 w-full rounded-md max-h-[400px]" />
      );
    }
    if (announcement.mediaType === 'url') { // Assuming URL is for image or video
        if (/\.(jpeg|jpg|gif|png)$/i.test(announcement.media)) {
             return (
                <div className="my-4 rounded-md overflow-hidden aspect-video relative bg-muted">
                  <Image 
                    src={announcement.media} 
                    alt={announcement.title} 
                    layout="fill"
                    objectFit="contain" 
                    data-ai-hint="announcement image"
                   />
                </div>
             );
        } else if (/\.(mp4|webm|ogg)$/i.test(announcement.media)) {
            return <video src={announcement.media} controls className="my-4 w-full rounded-md max-h-[400px]" />;
        }
    }
    return null;
  };
  
  const contentToShow = isCompact 
    ? (announcement.content.length > 150 ? announcement.content.substring(0, 147) + "..." : announcement.content)
    : announcement.content;


  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader>
        <CardTitle className={isCompact ? "text-xl" : "text-2xl"}>{announcement.title}</CardTitle>
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 items-center mt-1">
          <span className="flex items-center"><CalendarDays className="h-3.5 w-3.5 mr-1" /> {formattedDate}</span>
          <span className="flex items-center"><UserCircle className="h-3.5 w-3.5 mr-1" /> {announcement.author}</span>
           {announcement.media && (
            <span className="flex items-center">
              {announcement.mediaType?.startsWith('image/') || (announcement.mediaType === 'url' && /\.(jpeg|jpg|gif|png)$/i.test(announcement.media)) ? <ImageIcon className="h-3.5 w-3.5 mr-1" /> : <VideoIcon className="h-3.5 w-3.5 mr-1" />}
              Medya İçerir
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!isCompact && renderMedia()}
        <p className={`text-foreground/90 ${isCompact ? 'text-sm' : 'text-base'} whitespace-pre-wrap`}>
          {contentToShow}
        </p>
      </CardContent>
      <CardFooter className="flex justify-end items-center">
        {canDelete && !isCompact && (
           <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" /> Sil
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                <AlertDialogDescription>
                  Bu duyuruyu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>İptal</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                  Evet, Sil
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardFooter>
    </Card>
  );
}
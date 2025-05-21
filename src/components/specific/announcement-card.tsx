
"use client";

import type { Announcement } from '@/hooks/use-announcements';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, UserCircle, CalendarDays, Image as ImageIcon, Video as VideoIcon, Link2 } from 'lucide-react';
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
import { AdminPasswordDialog } from '@/components/specific/admin-password-dialog';
import { useState } from 'react';
import { AnnouncementDetailDialog } from '@/components/specific/announcement-detail-dialog';

interface AnnouncementCardProps {
  announcement: Announcement;
  isCompact?: boolean;
  allowDelete?: boolean;
}

export function AnnouncementCard({ announcement, isCompact = false, allowDelete = false }: AnnouncementCardProps) {
  const { user } = useUser();
  const { deleteAnnouncement: removeAnnouncement } = useAnnouncements();
  const { toast } = useToast();
  const [isAdminPasswordDialogOpen, setIsAdminPasswordDialogOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const canAttemptDelete = !!user;

  const performDelete = () => {
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

    if (announcement.mediaType?.startsWith('image/')) { // Catches 'image/png', 'image/jpeg', 'image/url'
      return (
        <div className="my-4 rounded-md overflow-hidden aspect-video relative bg-muted">
          <Image
            src={announcement.media}
            alt={announcement.title}
            layout="fill"
            objectFit="contain"
            data-ai-hint="announcement media"
          />
        </div>
      );
    }
    if (announcement.mediaType?.startsWith('video/')) { // Catches 'video/mp4', 'video/url'
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

  const contentToShow = isCompact
    ? (announcement.content.length > 150 ? announcement.content.substring(0, 147) + "..." : announcement.content)
    : announcement.content;

  const getCompactMediaIndicator = () => {
    if (!announcement.media) return null;
    if (announcement.mediaType?.startsWith('image/')) return <><ImageIcon className="h-3.5 w-3.5 mr-1 text-primary" /> Resim</>;
    if (announcement.mediaType?.startsWith('video/')) return <><VideoIcon className="h-3.5 w-3.5 mr-1 text-primary" /> Video</>;
    if (announcement.mediaType === 'url/link') return <><Link2 className="h-3.5 w-3.5 mr-1 text-primary" /> Bağlantı</>;
    return <><Link2 className="h-3.5 w-3.5 mr-1 text-primary" /> Medya</>; // Fallback
  };

  return (
    <>
      <Card
        className={`shadow-md hover:shadow-lg transition-shadow duration-300 ${isCompact ? 'cursor-pointer' : ''}`}
        onClick={isCompact ? () => setIsDetailModalOpen(true) : undefined}
      >
        <CardHeader>
          <CardTitle className={isCompact ? "text-xl" : "text-2xl"}>{announcement.title}</CardTitle>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 items-center mt-1">
            <span className="flex items-center"><CalendarDays className="h-3.5 w-3.5 mr-1" /> {formattedDate}</span>
            <span className="flex items-center"><UserCircle className="h-3.5 w-3.5 mr-1" /> {announcement.author}</span>
            {isCompact && announcement.media && (
              <span className="flex items-center">
                {getCompactMediaIndicator()}
              </span>
            )}
             {!isCompact && announcement.media && announcement.mediaType === 'url/link' && (
                <span className="flex items-center">
                    <Link2 className="h-3.5 w-3.5 mr-1 text-primary" /> Medya Bağlantısı
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
          {canAttemptDelete && !isCompact && allowDelete && (
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" /> Sil
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Duyuruyu Silmeyi Onayla</AlertDialogTitle>
                  <AlertDialogDescription>
                    "{announcement.title}" başlıklı duyuruyu kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>İptal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => setIsAdminPasswordDialogOpen(true)}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Evet, Sil
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardFooter>
      </Card>

      <AdminPasswordDialog
        isOpen={isAdminPasswordDialogOpen}
        onOpenChange={setIsAdminPasswordDialogOpen}
        onVerified={() => {
          performDelete();
          setIsAdminPasswordDialogOpen(false);
        }}
      />
      {isCompact && (
        <AnnouncementDetailDialog
            isOpen={isDetailModalOpen}
            onOpenChange={setIsDetailModalOpen}
            announcement={announcement}
        />
      )}
    </>
  );
}

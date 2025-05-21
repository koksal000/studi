
"use client";

import type { Announcement } from '@/hooks/use-announcements';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Newspaper } from 'lucide-react';

interface AnnouncementPopoverContentProps {
  announcements: Announcement[];
  onClose?: () => void; // Popover'ı kapatmak için isteğe bağlı fonksiyon
}

export function AnnouncementPopoverContent({ announcements, onClose }: AnnouncementPopoverContentProps) {
  if (!announcements || announcements.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Yeni duyuru bulunmamaktadır.</p>;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  return (
    <div className="flex flex-col">
      <ScrollArea className="max-h-[300px] w-[300px] sm:w-[350px]">
        <div className="p-1">
          {announcements.slice(0, 5).map((ann, index) => ( // En son 5 duyuruyu göster
            <React.Fragment key={ann.id}>
              <Link href="/announcements" passHref legacyBehavior>
                <a
                  onClick={onClose}
                  className="block p-3 hover:bg-accent rounded-md transition-colors"
                >
                  <h4 className="text-sm font-semibold truncate">{ann.title}</h4>
                  <p className="text-xs text-muted-foreground truncate">
                    {ann.content.substring(0, 60)}{ann.content.length > 60 ? '...' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground/80 mt-1">{formatDate(ann.date)}</p>
                </a>
              </Link>
              {index < announcements.slice(0, 5).length - 1 && <Separator className="my-1" />}
            </React.Fragment>
          ))}
        </div>
      </ScrollArea>
      {announcements.length > 0 && (
         <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full" asChild onClick={onClose}>
              <Link href="/announcements" className="flex items-center justify-center">
                <Newspaper className="mr-2 h-4 w-4" /> Tüm Duyuruları Gör
              </Link>
            </Button>
          </div>
      )}
    </div>
  );
}

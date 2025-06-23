"use client";

import React from 'react';
import type { Announcement } from '@/hooks/use-announcements';
import type { AppNotification } from '@/hooks/use-notifications';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Newspaper, MessageSquare, BellOff, UserCircle } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';


interface MergedNotification {
    id: string;
    type: 'announcement' | 'reply';
    date: string;
    data: Announcement | AppNotification;
}

interface NotificationPopoverContentProps {
  announcements: Announcement[];
  replyNotifications: AppNotification[];
  onClose?: () => void; 
}

export function NotificationPopoverContent({ announcements, replyNotifications, onClose }: NotificationPopoverContentProps) {
  
  const getInitials = (name: string) => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const mergedNotifications: MergedNotification[] = [
    ...announcements.map((ann): MergedNotification => ({
      id: `ann-${ann.id}`,
      type: 'announcement',
      date: ann.date,
      data: ann,
    })),
    ...replyNotifications.map((reply): MergedNotification => ({
      id: `reply-${reply.id}`,
      type: 'reply',
      date: reply.date,
      data: reply,
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());


  if (mergedNotifications.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center p-6 text-center w-[300px] sm:w-[350px]">
             <BellOff className="h-10 w-10 text-muted-foreground mb-3" />
             <h4 className="font-semibold text-sm">Hiç bildirim yok</h4>
             <p className="p-4 text-xs text-muted-foreground">Yeni duyurular veya yorumlarınıza gelen yanıtlar burada görünecektir.</p>
        </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffSeconds < 60) return `${diffSeconds} san önce`;
    if (diffMinutes < 60) return `${diffMinutes} dk önce`;
    if (diffHours < 24) return `${diffHours} sa önce`;
    if (diffDays <= 7) return `${diffDays} g önce`;
    
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  return (
    <div className="flex flex-col w-[320px] sm:w-[380px]">
      <div className="p-2 border-b">
        <h3 className="font-semibold px-2 text-base">Bildirimler</h3>
      </div>
      <div className="overflow-y-auto max-h-[350px]">
        <div className="p-1">
          {mergedNotifications.slice(0, 10).map((item, index) => {
             const isUnread = item.type === 'reply' ? !(item.data as AppNotification).read : false; // Announcements are handled by timestamp
            return (
              <React.Fragment key={item.id}>
                <Link href="/announcements" passHref legacyBehavior>
                  <a
                    onClick={onClose}
                    className={`block p-2.5 hover:bg-accent rounded-md transition-colors relative ${isUnread ? 'bg-primary/10' : ''}`}
                  >
                   <div className="flex items-start gap-3">
                       <div className="mt-1">
                           {item.type === 'announcement' ? (
                               <Newspaper className="h-5 w-5 text-primary" />
                           ) : (
                             <Avatar className="h-7 w-7">
                               <AvatarFallback className="bg-accent text-accent-foreground text-xs">
                                 {getInitials((item.data as AppNotification).senderUserName)}
                               </AvatarFallback>
                             </Avatar>
                           )}
                       </div>
                       <div className="flex-1">
                            {item.type === 'announcement' ? (
                                <p className="text-sm">
                                <span className="font-semibold">Yeni Duyuru:</span> {(item.data as Announcement).title}
                                </p>
                            ) : (
                                <p className="text-sm">
                                <span className="font-semibold">{(item.data as AppNotification).senderUserName}</span>, yorumunuza yanıt verdi.
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(item.date)}</p>
                       </div>
                        {isUnread && <div className="absolute right-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-primary" />}
                   </div>
                  </a>
                </Link>
                {index < mergedNotifications.slice(0, 10).length - 1 && <Separator className="my-0" />}
              </React.Fragment>
            )
          })}
        </div>
      </div>
      {announcements.length > 0 && (
         <div className="p-2 border-t flex-shrink-0">
            <Button variant="ghost" size="sm" className="w-full" asChild onClick={onClose}>
              <Link href="/announcements" className="flex items-center justify-center">
                Tüm Duyuruları Gör
              </Link>
            </Button>
          </div>
      )}
    </div>
  );
}

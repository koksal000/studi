
"use client";

import { useAnnouncements } from '@/hooks/use-announcements';
import { useUser } from '@/contexts/user-context';
import { AnnouncementCard } from '@/components/specific/announcement-card';
import { EntryForm } from '@/components/specific/entry-form';
import { Loader2 } from 'lucide-react';

export default function AnnouncementsPage() {
  const { announcements, isLoading } = useAnnouncements();
  const { user, showEntryForm } = useUser();

  if (showEntryForm || !user) {
    return <EntryForm />;
  }

  const pinnedAnnouncements = announcements.filter(a => a.isPinned);
  const regularAnnouncements = announcements.filter(a => !a.isPinned);

  return (
    <div className="space-y-8 content-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Duyurular</h1>
      </div>

      {isLoading && announcements.length === 0 && (
         <div className="flex flex-col justify-center items-center py-20 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Duyurular yükleniyor...</p>
          <p className="text-xs text-muted-foreground mt-1">Bu işlem internet hızınıza bağlı olarak birkaç saniye sürebilir.</p>
        </div>
      )}

      {!isLoading && announcements.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl text-muted-foreground">Henüz yayınlanmış bir duyuru bulunmamaktadır.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
          {pinnedAnnouncements.map((ann) => (
            <AnnouncementCard key={ann.id} announcement={ann} allowDelete={false} />
          ))}
          {regularAnnouncements.map((ann) => (
            <AnnouncementCard key={ann.id} announcement={ann} allowDelete={false} />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from 'react';
import { useAnnouncements, type Announcement } from '@/hooks/use-announcements';
import { useUser } from '@/contexts/user-context';
import { AnnouncementCard } from '@/components/specific/announcement-card';
import { AddAnnouncementDialog } from '@/components/specific/add-announcement-dialog';
import { AdminPasswordDialog } from '@/components/specific/admin-password-dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { EntryForm } from '@/components/specific/entry-form';

export default function AnnouncementsPage() {
  const { announcements } = useAnnouncements();
  const { user, isAdmin, showEntryForm } = useUser();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAdminPasswordDialogOpen, setIsAdminPasswordDialogOpen] = useState(false);

  const handleOpenAddDialog = () => {
    if (isAdmin) {
      setIsAddDialogOpen(true);
    } else {
      setIsAdminPasswordDialogOpen(true);
    }
  };

  const onAdminVerified = () => {
    setIsAdminPasswordDialogOpen(false);
    setIsAddDialogOpen(true);
  };

  if (showEntryForm || !user) {
    return <EntryForm />;
  }

  return (
    <div className="space-y-8 content-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Duyurular</h1>
        {user && (
          <Button onClick={handleOpenAddDialog} className="shadow-md">
            <PlusCircle className="h-5 w-5 mr-2" />
            Yeni Duyuru Ekle
          </Button>
        )}
      </div>

      {announcements.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1"> {/* Changed to single column for better readability of announcements */}
          {announcements.map((ann) => (
            <AnnouncementCard key={ann.id} announcement={ann} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-xl text-muted-foreground">Henüz yayınlanmış bir duyuru bulunmamaktadır.</p>
          <p className="text-muted-foreground mt-2">İlk duyuruyu eklemek için yukarıdaki butonu kullanabilirsiniz.</p>
        </div>
      )}

      <AddAnnouncementDialog isOpen={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
      <AdminPasswordDialog 
        isOpen={isAdminPasswordDialogOpen} 
        onOpenChange={setIsAdminPasswordDialogOpen}
        onVerified={onAdminVerified}
      />
    </div>
  );
}
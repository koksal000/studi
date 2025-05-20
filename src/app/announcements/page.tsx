
"use client";

import { useAnnouncements, type Announcement } from '@/hooks/use-announcements';
import { useUser } from '@/contexts/user-context';
import { AnnouncementCard } from '@/components/specific/announcement-card';
// import { AddAnnouncementDialog } from '@/components/specific/add-announcement-dialog'; // Kaldırıldı
// import { AdminPasswordDialog } from '@/components/specific/admin-password-dialog'; // Kaldırıldı
// import { Button } from '@/components/ui/button'; // Kaldırıldı
// import { PlusCircle } from 'lucide-react'; // Kaldırıldı
import { EntryForm } from '@/components/specific/entry-form';

export default function AnnouncementsPage() {
  const { announcements } = useAnnouncements();
  const { user, showEntryForm } = useUser(); // isAdmin kaldırıldı, kullanılmıyor
  // const [isAddDialogOpen, setIsAddDialogOpen] = useState(false); // Kaldırıldı
  // const [isAdminPasswordDialogOpen, setIsAdminPasswordDialogOpen] = useState(false); // Kaldırıldı

  // const handleOpenAddDialog = () => { // Kaldırıldı
  //   if (isAdmin) {
  //     setIsAddDialogOpen(true);
  //   } else {
  //     setIsAdminPasswordDialogOpen(true);
  //   }
  // };

  // const onAdminVerified = () => { // Kaldırıldı
  //   setIsAdminPasswordDialogOpen(false);
  //   setIsAddDialogOpen(true);
  // };

  if (showEntryForm || !user) {
    return <EntryForm />;
  }

  return (
    <div className="space-y-8 content-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Duyurular</h1>
        {/* Yeni Duyuru Ekle butonu kaldırıldı */}
      </div>

      {announcements.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
          {announcements.map((ann) => (
            <AnnouncementCard key={ann.id} announcement={ann} allowDelete={false} /> // allowDelete={false} eklendi
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-xl text-muted-foreground">Henüz yayınlanmış bir duyuru bulunmamaktadır.</p>
          {/* <p className="text-muted-foreground mt-2">İlk duyuruyu eklemek için yukarıdaki butonu kullanabilirsiniz.</p> */}
        </div>
      )}

      {/* Dialoglar kaldırıldı */}
      {/* <AddAnnouncementDialog isOpen={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} /> */}
      {/* <AdminPasswordDialog 
        isOpen={isAdminPasswordDialogOpen} 
        onOpenChange={setIsAdminPasswordDialogOpen}
        onVerified={onAdminVerified}
      /> */}
    </div>
  );
}

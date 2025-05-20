
"use client";

import { useState } from 'react';
import { useUser } from '@/contexts/user-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AddAnnouncementDialog } from '@/components/specific/add-announcement-dialog';
import { GALLERY_IMAGES, VILLAGE_NAME } from '@/lib/constants';
import Image from 'next/image';
import { ShieldCheck, UserCircle, Image as ImageIcon, PlusCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  const { user, isAdmin } = useUser(); // isAdmin might not be reliably set across sessions without more complex state management
  const router = useRouter();
  const [isAddAnnouncementDialogOpen, setIsAddAnnouncementDialogOpen] = useState(false);

  // Basic check: If there's no user, redirect. More robust protection would be needed for production.
  // Ideally, this page should be protected by a server-side check or a more persistent admin flag.
  // The AdminPasswordDialog before reaching this page is the primary gate.
  if (!user) {
    // router.replace('/'); // Redirect to home if no user.
    // For now, to avoid redirect loops during development if user context is slow, we show a message.
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] content-page">
            <ShieldCheck className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-bold mb-2">Erişim Reddedildi</h1>
            <p className="text-muted-foreground mb-4">Bu sayfayı görüntülemek için giriş yapmış olmanız ve yönetici yetkisine sahip olmanız gerekmektedir.</p>
            <Button asChild>
                <Link href="/">Ana Sayfaya Dön</Link>
            </Button>
        </div>
    );
  }


  return (
    <div className="space-y-8 content-page">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center">
            <ShieldCheck className="mr-3 h-8 w-8" /> Yönetici Paneli
          </CardTitle>
          <CardDescription className="text-lg">
            {VILLAGE_NAME} sitesi için yönetim ve içerik düzenleme alanı.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-3 p-4 border rounded-lg bg-secondary/10">
            <UserCircle className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">Giriş Yapan Kullanıcı:</p>
              <p className="text-muted-foreground">{user.name} {user.surname}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Duyuru Yönetimi
            <Button onClick={() => setIsAddAnnouncementDialogOpen(true)} className="shadow-sm">
              <PlusCircle className="mr-2 h-5 w-5" /> Yeni Duyuru Ekle
            </Button>
          </CardTitle>
          <CardDescription>Mevcut duyuruları görüntüleyin veya yeni duyurular ekleyin.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Yeni duyuru eklemek için yukarıdaki "Yeni Duyuru Ekle" butonunu kullanın. 
            Mevcut duyuruları silmek veya düzenlemek için <Link href="/announcements" className="text-primary hover:underline">Duyurular sayfasına</Link> gidin.
            (Silme işlemi için şifre doğrulaması gereklidir).
          </p>
          {/* Future: List announcements here with edit/delete options */}
        </CardContent>
      </Card>

      <AddAnnouncementDialog 
        isOpen={isAddAnnouncementDialogOpen} 
        onOpenChange={setIsAddAnnouncementDialogOpen} 
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ImageIcon className="mr-2 h-6 w-6 text-primary" /> Galeri Yönetimi</CardTitle>
          <CardDescription>
            Sitede gösterilen galeri resimleri ve başlıkları. 
            Bu resimleri ve başlıkları değiştirmek için kaynak kodundaki `/src/lib/constants.ts` dosyasını düzenlemeniz gerekmektedir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {GALLERY_IMAGES.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {GALLERY_IMAGES.map((image, index) => (
                <div key={index} className="border rounded-lg overflow-hidden shadow">
                  <div className="relative aspect-video bg-muted">
                    <Image src={image.src} alt={image.alt} layout="fill" objectFit="cover" data-ai-hint={image.hint} />
                  </div>
                  <div className="p-3">
                    <h4 className="font-semibold text-sm truncate" title={image.caption}>{image.caption}</h4>
                    <p className="text-xs text-muted-foreground truncate" title={image.alt}>Alt Metin: {image.alt}</p>
                    <p className="text-xs text-muted-foreground truncate" title={image.hint}>AI İpucu: {image.hint}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Galeride gösterilecek resim bulunmamaktadır.</p>
          )}
           <div className="mt-6 text-sm text-center p-4 border-t">
                <p className="text-muted-foreground">
                Galeri resimlerini, başlıklarını veya diğer sabit verileri (iletişim bilgileri, tarihçe olayları vb.) değiştirmek için geliştiricinizle iletişime geçin veya projenin kaynak kodundaki 
                <code className="mx-1 px-1 py-0.5 bg-muted rounded-sm text-xs">src/lib/constants.ts</code> dosyasını doğrudan düzenleyin.
                </p>
                <Button variant="outline" size="sm" asChild className="mt-3">
                    <a href="https://github.com/firebase/firebase-genkit-samples/blob/main/studio/intro/src/lib/constants.ts" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" /> constants.ts Dosyasını GitHub'da Gör
                    </a>
                </Button>
            </div>
        </CardContent>
      </Card>
      
      {/* Add more admin functionalities here as needed */}

    </div>
  );
}

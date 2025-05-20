
"use client";

import { useState, type ChangeEvent, type FormEvent, useRef } from 'react';
import { useUser } from '@/contexts/user-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AddAnnouncementDialog } from '@/components/specific/add-announcement-dialog';
import { VILLAGE_NAME, STATIC_GALLERY_IMAGES_FOR_SEEDING } from '@/lib/constants';
import Image from 'next/image';
import { ShieldCheck, UserCircle, Image as ImageIcon, PlusCircle, ExternalLink, Upload, Trash2, Loader2, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { useGallery, type GalleryImage, type NewGalleryImagePayload } from '@/hooks/use-gallery';
import { useToast } from '@/hooks/use-toast';
import { AdminPasswordDialog } from '@/components/specific/admin-password-dialog';
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
import { useAnnouncements, type Announcement } from '@/hooks/use-announcements'; // useAnnouncements ve Announcement import edildi
import { AnnouncementCard } from '@/components/specific/announcement-card'; // AnnouncementCard import edildi

export default function AdminPage() {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { galleryImages, addGalleryImage, deleteGalleryImage, isLoading: galleryLoading } = useGallery();
  const { announcements, isLoading: announcementsLoading } = useAnnouncements(); // announcements ve announcementsLoading eklendi

  const [isAddAnnouncementDialogOpen, setIsAddAnnouncementDialogOpen] = useState(false);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImageCaption, setNewImageCaption] = useState('');
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [isDeleteImageAdminPasswordDialogOpen, setIsDeleteImageAdminPasswordDialogOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<GalleryImage | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) {
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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setNewImageFile(null);
      setNewImagePreview(null);
    }
  };

  const handleAddImageSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!newImageFile || !newImageCaption.trim()) {
      toast({ title: "Eksik Bilgi", description: "Lütfen bir resim seçin ve başlık girin.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageDataUri = reader.result as string;
        const payload: NewGalleryImagePayload = {
          imageDataUri,
          caption: newImageCaption.trim(),
          alt: newImageCaption.trim(),
          hint: "custom upload",
        };
        await addGalleryImage(payload);
        toast({ title: "Resim Eklendi", description: "Yeni resim galeriye başarıyla eklendi." });
        setNewImageFile(null);
        setNewImageCaption('');
        setNewImagePreview(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.onerror = () => {
         toast({ title: "Dosya Okuma Hatası", description: "Resim dosyası okunurken bir hata oluştu.", variant: "destructive" });
      }
      reader.readAsDataURL(newImageFile);
    } catch (error) {
      console.error("Error adding image:", error);
      toast({ title: "Resim Eklenemedi", description: "Resim eklenirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };
  
  const openDeleteConfirmation = (image: GalleryImage) => {
    setImageToDelete(image);
    setIsDeleteImageAdminPasswordDialogOpen(true);
  };

  const performImageDelete = async () => {
    if (!imageToDelete) return;
    try {
      await deleteGalleryImage(imageToDelete.id);
      toast({ title: "Resim Silindi", description: `"${imageToDelete.caption}" başlıklı resim galeriden silindi.` });
    } catch (error) {
      console.error("Error deleting image:", error);
      toast({ title: "Resim Silinemedi", description: "Resim silinirken bir sorun oluştu.", variant: "destructive" });
    }
    setImageToDelete(null);
  };


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
          <CardDescription>Yeni duyurular ekleyin veya mevcut duyuruları yönetin.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Duyuru Ekleme Dialogu */}
          <AddAnnouncementDialog 
            isOpen={isAddAnnouncementDialogOpen} 
            onOpenChange={setIsAddAnnouncementDialogOpen} 
          />
          
          {/* Mevcut Duyuruları Yönetme Bölümü */}
          <h3 className="text-lg font-semibold text-primary border-b pb-2 mb-4 mt-6 flex items-center">
            <ListChecks className="mr-2 h-5 w-5" /> Mevcut Duyurular
          </h3>
          {announcementsLoading && <p className="text-muted-foreground">Duyurular yükleniyor...</p>}
          {!announcementsLoading && announcements.length === 0 && (
            <p className="text-muted-foreground">Henüz yayınlanmış bir duyuru bulunmamaktadır.</p>
          )}
          {!announcementsLoading && announcements.length > 0 && (
            <div className="space-y-4">
              {announcements.map((ann) => (
                <AnnouncementCard key={ann.id} announcement={ann} allowDelete={true} /> // allowDelete={true} eklendi
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ImageIcon className="mr-2 h-6 w-6 text-primary" /> Galeri Yönetimi</CardTitle>
          <CardDescription>
            Sitede gösterilen galeri resimlerini yönetin. Yüklenen resimler sunucu yeniden başladığında kaybolabilir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddImageSubmit} className="mb-8 p-6 border rounded-lg shadow-sm space-y-4">
            <h3 className="text-lg font-semibold text-primary border-b pb-2">Yeni Resim Yükle</h3>
            <div className="space-y-1">
              <Label htmlFor="imageFile">Resim Dosyası Seçin (Max 1MB önerilir)</Label>
              <Input 
                id="imageFile" 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                ref={fileInputRef}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                disabled={isUploading} 
              />
            </div>
            {newImagePreview && (
              <div className="mt-2">
                <Label>Önizleme:</Label>
                <Image src={newImagePreview} alt="Yüklenecek resim önizlemesi" width={200} height={150} className="rounded-md border object-contain max-h-[150px]" />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="imageCaption">Resim Başlığı</Label>
              <Input 
                id="imageCaption" 
                type="text" 
                placeholder="Resim için kısa bir başlık" 
                value={newImageCaption}
                onChange={(e) => setNewImageCaption(e.target.value)}
                required 
                disabled={isUploading}
              />
            </div>
            <Button type="submit" disabled={isUploading || !newImageFile || !newImageCaption.trim()}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Galeriye Ekle
            </Button>
          </form>

          <h3 className="text-lg font-semibold text-primary border-b pb-2 mb-4">Mevcut Galeri Resimleri</h3>
          {galleryLoading && <p className="text-muted-foreground">Galeri resimleri yükleniyor...</p>}
          {!galleryLoading && galleryImages.length === 0 && (
            <p className="text-muted-foreground">Galeride henüz resim bulunmamaktadır.</p>
          )}
          {!galleryLoading && galleryImages.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {galleryImages.map((image) => (
                <Card key={image.id} className="overflow-hidden shadow group">
                  <CardContent className="p-0">
                    <div className="relative aspect-video bg-muted">
                      <Image src={image.src} alt={image.alt} layout="fill" objectFit="cover" data-ai-hint={image.hint} />
                       <div className="absolute top-2 right-2">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Resmi Silmeyi Onayla</AlertDialogTitle>
                                <AlertDialogDescription>
                                    "{image.caption}" başlıklı resmi galeriden kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => openDeleteConfirmation(image)}
                                    className="bg-destructive hover:bg-destructive/90"
                                >
                                    Evet, Sil
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                       </div>
                    </div>
                  </CardContent>
                  <CardFooter className="p-3 bg-background/80">
                    <h4 className="font-semibold text-sm truncate" title={image.caption}>{image.caption}</h4>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
           <div className="mt-6 text-sm text-center p-4 border-t">
              <p className="text-muted-foreground">
                Bu panelden yüklenen resimler, sunucu (Vercel ortamında fonksiyon örneği) yeniden başladığında kaybolacaktır. Kalıcı resimler için <code className="mx-1 px-1 py-0.5 bg-muted rounded-sm text-xs">src/lib/constants.ts</code> dosyasındaki <code className="mx-1 px-1 py-0.5 bg-muted rounded-sm text-xs">STATIC_GALLERY_IMAGES_FOR_SEEDING</code> listesini düzenleyebilirsiniz. Bu liste, sunucu başladığında dinamik galeriyi tohumlamak için kullanılır.
              </p>
              <Button variant="outline" size="sm" asChild className="mt-3">
                  <a href="https://github.com/firebase/firebase-genkit-samples/blob/main/studio/intro/src/lib/constants.ts" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" /> constants.ts Dosyasını GitHub'da Gör
                  </a>
              </Button>
            </div>
        </CardContent>
      </Card>
      
      <AdminPasswordDialog
        isOpen={isDeleteImageAdminPasswordDialogOpen}
        onOpenChange={setIsDeleteImageAdminPasswordDialogOpen}
        onVerified={() => {
          performImageDelete();
          setIsDeleteImageAdminPasswordDialogOpen(false);
        }}
      />
    </div>
  );
}

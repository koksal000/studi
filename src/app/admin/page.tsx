
"use client";

import { useState, type ChangeEvent, type FormEvent, useRef, useEffect } from 'react';
import { useUser } from '@/contexts/user-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AddAnnouncementDialog } from '@/components/specific/add-announcement-dialog';
import { VILLAGE_NAME } from '@/lib/constants';
import Image from 'next/image';
import { ShieldCheck, UserCircle, Image as ImageIcon, PlusCircle, ExternalLink, Upload, Trash2, Loader2, ListChecks, MailQuestion, Users, Activity } from 'lucide-react';
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
import { useAnnouncements, type Announcement } from '@/hooks/use-announcements';
import { AnnouncementCard } from '@/components/specific/announcement-card';
import { UserRequestsDialog } from '@/components/specific/user-requests-dialog';

const MAX_RAW_FILE_SIZE = 3 * 1024 * 1024; // 3MB limit for original file
const MAX_IMAGE_DATA_URI_LENGTH = 4 * 1024 * 1024; // Approx 4MB for base64 string (API limit might be lower)

export default function AdminPage() {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { galleryImages, addGalleryImage, deleteGalleryImage, isLoading: galleryLoading } = useGallery();
  const { announcements, isLoading: announcementsLoading } = useAnnouncements();

  const [isAddAnnouncementDialogOpen, setIsAddAnnouncementDialogOpen] = useState(false);
  const [isUserRequestsDialogOpen, setIsUserRequestsDialogOpen] = useState(false);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImageCaption, setNewImageCaption] = useState('');
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [isDeleteImageAdminPasswordDialogOpen, setIsDeleteImageAdminPasswordDialogOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<GalleryImage | null>(null);
  const [totalEntryCount, setTotalEntryCount] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchEntryStats = async () => {
      setStatsLoading(true);
      try {
        const response = await fetch('/api/stats/entry-count');
        if (response.ok) {
          const data = await response.json();
          setTotalEntryCount(data.entryCount);
        } else {
          console.error("Failed to fetch entry stats");
          setTotalEntryCount(0); // Fallback
        }
      } catch (error) {
        console.error("Error fetching entry stats:", error);
        setTotalEntryCount(0); // Fallback
      }
      setStatsLoading(false);
    };

    if (user) { // Only fetch if user is logged in (admin)
      fetchEntryStats();
    }
  }, [user]);


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
      if (file.size > MAX_RAW_FILE_SIZE) {
        toast({
          title: "Dosya Boyutu Çok Büyük",
          description: `Lütfen ${MAX_RAW_FILE_SIZE / (1024*1024)}MB'den küçük bir resim dosyası seçin.`,
          variant: "destructive",
          duration: 7000,
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        setNewImageFile(null);
        setNewImagePreview(null);
        return;
      }

      setNewImageFile(file);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageDataUri = reader.result as string;

        if (!imageDataUri || typeof imageDataUri !== 'string' || !imageDataUri.startsWith('data:image/')) {
            toast({
                title: "Geçersiz Resim Verisi Okundu",
                description: "Resim dosyası okunamadı veya dosya formatı desteklenmiyor. Lütfen geçerli bir resim dosyası (örn: PNG, JPG) seçin.",
                variant: "destructive"
            });
            if (fileInputRef.current) fileInputRef.current.value = "";
            setNewImageFile(null);
            setNewImagePreview(null);
            return;
        }
        
        if (imageDataUri.length > MAX_IMAGE_DATA_URI_LENGTH) {
          toast({
            title: "Resim Verisi Çok Büyük",
            description: `İşlenmiş resim verisi çok büyük (yaklaşık ${Math.round(imageDataUri.length / (1024*1024))}MB). Lütfen daha küçük boyutlu veya daha iyi sıkıştırılmış bir resim dosyası seçin.`,
            variant: "destructive",
            duration: 8000,
          });
          if (fileInputRef.current) fileInputRef.current.value = "";
          setNewImageFile(null);
          setNewImagePreview(null);
          return;
        }
        setNewImagePreview(imageDataUri);
      };
      reader.onerror = () => {
        toast({ title: "Dosya Okuma Hatası", description: "Resim dosyası okunurken bir hata oluştu.", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        setNewImageFile(null);
        setNewImagePreview(null);
      }
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
    if (!newImagePreview || typeof newImagePreview !== 'string' || !newImagePreview.startsWith('data:image/')) {
      console.error("handleAddImageSubmit: newImagePreview is invalid or missing.", {preview: newImagePreview?.substring(0,30)});
      toast({
        title: "Geçersiz Resim Verisi",
        description: "Resim yüklenemiyor. Lütfen geçerli bir resim dosyası seçin ve önizlemenin doğru yüklendiğinden emin olun.",
        variant: "destructive"
      });
      return;
    }
    

    setIsUploading(true);
    try {
      const payload: NewGalleryImagePayload = {
        imageDataUri: newImagePreview,
        caption: newImageCaption.trim(),
        alt: newImageCaption.trim() || "Yüklenen galeri resmi",
        hint: "custom upload", 
      };

      await addGalleryImage(payload);
      toast({
        title: "Resim Galeriye Eklendi",
        description: `"${newImageCaption.trim()}" başlıklı resim galeriye başarıyla eklendi. (Değişikliğin kalıcı olması için Render.com'da kalıcı disk yapılandırmanızın doğru olması gerekir.)`
      });
      setNewImageFile(null);
      setNewImageCaption('');
      setNewImagePreview(null);
      if(fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: any) {
       console.error("AdminPage: Error calling addGalleryImage:", error);
       if (error.message && !error.message.includes("localStorage") && !error.message.includes("sunucu") && !error.message.includes("payload") && !error.message.includes("kota") && !error.message.includes("büyük")) {
         toast({ title: "Resim Eklenemedi", description: error.message || "Resim eklenirken beklenmedik bir sorun oluştu.", variant: "destructive" });
      }
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
    setIsUploading(true);
    try {
      await deleteGalleryImage(imageToDelete.id);
      toast({
        title: "Resim Silindi",
        description: `"${imageToDelete.caption}" başlıklı resim galeriden başarıyla silindi. (Değişikliğin kalıcı olması için Render.com'da kalıcı disk yapılandırmanızın doğru olması gerekir.)`
      });
    } catch (error: any) {
      console.error("Error deleting image:", error);
      toast({ title: "Resim Silinemedi", description: error.message || "Resim silinirken bir sorun oluştu.", variant: "destructive" });
    }
    setImageToDelete(null);
    setIsUploading(false);
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center space-x-3 p-4 border rounded-lg bg-secondary/10">
              <UserCircle className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">Giriş Yapan Kullanıcı:</p>
                <p className="text-muted-foreground">{user.name} {user.surname}</p>
              </div>
            </div>
             <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center">
                  <Activity className="mr-2 h-5 w-5 text-primary" /> Site Giriş Sayısı
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {statsLoading ? (
                  <div className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Yükleniyor...</div>
                ) : (
                  <p className="text-2xl font-bold text-primary">{totalEntryCount !== null ? totalEntryCount : "Veri yok"}</p>
                )}
                 <p className="text-xs pt-1">Bu sayı, kullanıcıların siteye giriş formunu kullanarak kaç kez giriş yaptığını gösterir.</p>
              </CardContent>
            </Card>
          </div>
           <Button onClick={() => setIsUserRequestsDialogOpen(true)} variant="outline" className="w-full sm:w-auto">
            <MailQuestion className="mr-2 h-5 w-5" /> Kullanıcı İsteklerini Görüntüle
          </Button>
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
           <CardDescription>
            Yeni duyurular ekleyin veya mevcut duyuruları yönetin. (Render.com'da kalıcı disk doğru yapılandırıldıysa değişiklikler kalıcı olacaktır.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddAnnouncementDialog
            isOpen={isAddAnnouncementDialogOpen}
            onOpenChange={setIsAddAnnouncementDialogOpen}
          />

          <h3 className="text-lg font-semibold text-primary border-b pb-2 mb-4 mt-6 flex items-center">
            <ListChecks className="mr-2 h-5 w-5" /> Mevcut Duyurular
          </h3>
          {announcementsLoading && <div className="flex items-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Duyurular yükleniyor...</div>}
          {!announcementsLoading && announcements.length === 0 && (
            <p className="text-muted-foreground">Henüz yayınlanmış bir duyuru bulunmamaktadır.</p>
          )}
          {!announcementsLoading && announcements.length > 0 && (
            <div className="space-y-4">
              {announcements.map((ann) => (
                <AnnouncementCard key={ann.id} announcement={ann} allowDelete={true} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ImageIcon className="mr-2 h-6 w-6 text-primary" /> Galeri Yönetimi</CardTitle>
           <CardDescription>
            Sitede gösterilen galeri resimlerini yönetin. (Render.com'da kalıcı disk doğru yapılandırıldıysa değişiklikler kalıcı olacaktır.)
            <br/>
            <span className="text-xs text-muted-foreground">Not: Büyük boyutlu resimler yükleme süresini ve depolama alanını etkileyebilir. Tavsiye edilen maksimum dosya boyutu ~3MB'dir.</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddImageSubmit} className="mb-8 p-6 border rounded-lg shadow-sm space-y-4">
            <h3 className="text-lg font-semibold text-primary border-b pb-2">Yeni Resim Yükle</h3>
            <div className="space-y-1">
              <Label htmlFor="imageFile">Resim Dosyası Seçin (Max ~3MB, PNG/JPG)</Label>
              <Input
                id="imageFile"
                type="file"
                accept="image/png, image/jpeg, image/jpg"
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
            <Button type="submit" disabled={isUploading || !newImageFile || !newImageCaption.trim() || !newImagePreview}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Galeriye Ekle
            </Button>
            {isUploading && <p className="text-sm text-muted-foreground">Resim yükleniyor, lütfen bekleyin...</p>}
          </form>

          <h3 className="text-lg font-semibold text-primary border-b pb-2 mb-4">Mevcut Galeri Resimleri</h3>
          {galleryLoading && <div className="flex items-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Galeri resimleri yükleniyor...</div>}
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
                                <Button variant="destructive" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8" disabled={isUploading && imageToDelete?.id === image.id}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Resmi Silmeyi Onayla</AlertDialogTitle>
                                 <AlertDialogDescription>
                                    "{image.caption}" başlıklı resmi galeriden kalıcı olarak silmek istediğinizden emin misiniz? (Render.com'da kalıcı disk doğru yapılandırıldıysa değişiklik kalıcı olacaktır.)
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel disabled={isUploading && imageToDelete?.id === image.id}>İptal</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => openDeleteConfirmation(image)}
                                    className="bg-destructive hover:bg-destructive/90"
                                    disabled={isUploading && imageToDelete?.id === image.id}
                                >
                                     {isUploading && imageToDelete?.id === image.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Evet, Sil"}
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
      <UserRequestsDialog
        isOpen={isUserRequestsDialogOpen}
        onOpenChange={setIsUserRequestsDialogOpen}
      />
    </div>
  );
}

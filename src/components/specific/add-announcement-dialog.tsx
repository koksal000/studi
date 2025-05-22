
"use client";

import { useState, type ChangeEvent, type FormEvent, useEffect, useRef } from 'react';
import { useAnnouncements } from '@/hooks/use-announcements';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/user-context';
import { ImagePlus, Video, Link2, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddAnnouncementDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

type MediaType = 'image' | 'video' | 'url' | null;

const MAX_IMAGE_RAW_SIZE_MB = 10; // 10MB for images
const MAX_VIDEO_RAW_SIZE_MB = 100; // 100MB for videos (raw file check)
const MAX_VIDEO_DATA_URI_CONVERSION_LIMIT_RAW_MB = 5; // Practical limit for converting video to data URI (e.g., 5MB)

// Base64 can be ~37% larger than raw binary
const MAX_IMAGE_DATA_URI_LENGTH = Math.floor(MAX_IMAGE_RAW_SIZE_MB * 1024 * 1024 * 1.37);
const MAX_VIDEO_DATA_URI_LENGTH = Math.floor(MAX_VIDEO_DATA_URI_CONVERSION_LIMIT_RAW_MB * 1024 * 1024 * 1.37);


export function AddAnnouncementDialog({ isOpen, onOpenChange }: AddAnnouncementDialogProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaDataUri, setMediaDataUri] = useState<string | null>(null);
  const [mediaFileType, setMediaFileType] = useState<string | null>(null);
  const [selectedLocalMediaType, setSelectedLocalMediaType] = useState<MediaType>(null);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { addAnnouncement } = useAnnouncements();
  const { user } = useUser();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setContent('');
      setMediaDataUri(null);
      setMediaFileType(null);
      setSelectedLocalMediaType(null);
      setMediaUrlInput('');
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [isOpen]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const selectedType = selectedLocalMediaType; // 'image' or 'video'
      let maxRawSizeMB = 0;
      let maxDataUriLength = 0;
      let practicalConversionLimitMB = Infinity; // No limit for images by default

      if (selectedType === 'image') {
        maxRawSizeMB = MAX_IMAGE_RAW_SIZE_MB;
        maxDataUriLength = MAX_IMAGE_DATA_URI_LENGTH;
      } else if (selectedType === 'video') {
        maxRawSizeMB = MAX_VIDEO_RAW_SIZE_MB;
        maxDataUriLength = MAX_VIDEO_DATA_URI_LENGTH;
        practicalConversionLimitMB = MAX_VIDEO_DATA_URI_CONVERSION_LIMIT_RAW_MB;
      } else {
        toast({ title: "Medya Türü Seçilmedi", description: "Lütfen önce bir medya türü (resim/video) seçin.", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      if (file.size > maxRawSizeMB * 1024 * 1024) {
        toast({
          title: "Dosya Boyutu Çok Büyük",
          description: `Lütfen ${maxRawSizeMB}MB'den küçük bir ${selectedType === 'image' ? 'resim' : 'video'} dosyası seçin.`,
          variant: "destructive",
          duration: 7000,
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        setMediaDataUri(null);
        setMediaFileType(null);
        return;
      }

      if (selectedType === 'video' && file.size > practicalConversionLimitMB * 1024 * 1024) {
        toast({
          title: "Büyük Video Dosyası",
          description: `Bu video dosyası (${(file.size / (1024*1024)).toFixed(1)}MB) doğrudan yükleme için çok büyük. Lütfen ${practicalConversionLimitMB}MB'den küçük bir dosya seçin, veya videoyu bir platforma (örn: YouTube) yükleyip URL olarak ekleyin.`,
          variant: "warning",
          duration: 10000,
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        setMediaDataUri(null); // Do not attempt to read as data URI
        setMediaFileType(null);
        return; // Stop processing for large videos intended for data URI
      }


      setIsProcessing(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (!result || typeof result !== 'string' || !(result.startsWith('data:image/') || result.startsWith('data:video/'))) {
            toast({ title: "Geçersiz Dosya Verisi", description: "Dosya okunamadı veya format desteklenmiyor.", variant: "destructive" });
            if (fileInputRef.current) fileInputRef.current.value = "";
            setMediaDataUri(null);
            setMediaFileType(null);
            setIsProcessing(false);
            return;
        }

        if (result.length > maxDataUriLength) {
          const currentLimitMB = selectedType === 'image' ? (MAX_IMAGE_DATA_URI_LENGTH / (1.37 * 1024 * 1024)).toFixed(0) : (MAX_VIDEO_DATA_URI_LENGTH / (1.37 * 1024 * 1024)).toFixed(0) ;
          toast({
            title: "Medya Verisi Çok Büyük",
            description: `İşlenmiş medya verisi çok büyük. Lütfen daha küçük boyutlu bir dosya seçin (Max ~${currentLimitMB}MB ham dosya).`,
            variant: "destructive",
            duration: 8000,
          });
          if (fileInputRef.current) fileInputRef.current.value = "";
          setMediaDataUri(null);
          setMediaFileType(null);
          setIsProcessing(false);
          return;
        }
        setMediaDataUri(result);
        setMediaFileType(file.type);
        setIsProcessing(false);
      };
      reader.onerror = () => {
        toast({ title: 'Dosya Okuma Hatası', description: 'Dosya okunurken bir hata oluştu.', variant: 'destructive' });
        if (fileInputRef.current) fileInputRef.current.value = "";
        setMediaDataUri(null);
        setMediaFileType(null);
        setIsProcessing(false);
      }
      reader.readAsDataURL(file);
    }
  };

  const handleMediaTypeSelect = (value: string) => {
    setSelectedLocalMediaType(value as MediaType);
    setMediaDataUri(null);
    setMediaFileType(null);
    setMediaUrlInput('');
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast({ title: 'Hata', description: 'Duyuru eklemek için giriş yapmalısınız.', variant: 'destructive' });
      return;
    }
    if (!title.trim() || !content.trim()) {
      toast({ title: 'Eksik Bilgi', description: 'Lütfen başlık ve içerik alanlarını doldurun.', variant: 'destructive' });
      return;
    }

    let finalMedia: string | null = null;
    let finalMediaType: string | null = null;

    if (selectedLocalMediaType === 'url' && mediaUrlInput.trim()) {
        try {
            const url = new URL(mediaUrlInput.trim()); // Validate URL
            finalMedia = url.href; // Use the normalized URL
            if (/\.(jpeg|jpg|gif|png|webp)(\?|$)/i.test(finalMedia)) finalMediaType = 'image/url';
            else if (/\.(mp4|webm|ogg)(\?|$)/i.test(finalMedia) || /youtu\.?be/i.test(finalMedia) || /vimeo\.com/i.test(finalMedia)) finalMediaType = 'video/url';
            else finalMediaType = 'url/link';
        } catch (_) {
            toast({ title: "Geçersiz Medya URL'si", description: "Lütfen URL alanına geçerli bir resim, video veya genel web bağlantısı girin.", variant: "destructive" });
            return;
        }
    } else if ((selectedLocalMediaType === 'image' || selectedLocalMediaType === 'video') && mediaDataUri && mediaFileType) {
        if (!(mediaDataUri.startsWith('data:image/') || mediaDataUri.startsWith('data:video/'))) {
            toast({ title: "Geçersiz Yüklenmiş Medya", description: "Yüklenen dosya verisi hatalı görünüyor. Lütfen dosyayı tekrar seçin.", variant: "destructive" });
            return;
        }
        finalMedia = mediaDataUri;
        finalMediaType = mediaFileType;
    }

    setIsProcessing(true);
    try {
      await addAnnouncement({ title, content, media: finalMedia, mediaType: finalMediaType });
      toast({
        title: 'Duyuru Eklendi',
        description: `"${title}" başlıklı duyurunuz başarıyla eklendi.`,
      });
      onOpenChange(false);
    } catch (error: any) {
      // Errors are now typically handled by the hook, which may re-throw if it's a critical failure
      // or show its own toast for non-critical issues like localStorage quota.
      // This catch block here is a fallback.
      console.error("AddAnnouncementDialog handleSubmit error:", error);
      if (error.message && !error.message.includes("localStorage") && !error.message.includes("Sunucu") && !error.message.includes("kota") && !error.message.includes("büyük")) {
        toast({
          title: 'Duyuru Eklenemedi',
          description: error.message || 'Duyuru eklenirken beklenmedik bir sorun oluştu.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const getFileUploadButtonText = () => {
    if (selectedLocalMediaType === 'image') return `Resim Seç (Max ${MAX_IMAGE_RAW_SIZE_MB}MB)`;
    if (selectedLocalMediaType === 'video') return `Video Seç (Max ${MAX_VIDEO_RAW_SIZE_MB}MB)`;
    return 'Dosya Seç';
  };

  const getSelectedFileAcceptType = () => {
    if (selectedLocalMediaType === 'image') return "image/*";
    if (selectedLocalMediaType === 'video') return "video/*";
    return "";
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Yeni Duyuru Ekle</DialogTitle>
          <DialogDescription>
            Köy halkını bilgilendirmek için yeni bir duyuru yayınlayın.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Başlık
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
              required
              disabled={isProcessing}
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="content" className="text-right pt-2">
              İçerik
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="col-span-3 min-h-[100px]"
              required
              disabled={isProcessing}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="mediaTypeSelect" className="text-right">
              Medya Türü
            </Label>
            <Select
              value={selectedLocalMediaType || ""}
              onValueChange={handleMediaTypeSelect}
              disabled={isProcessing}
            >
              <SelectTrigger className="col-span-3" id="mediaTypeSelect">
                <SelectValue placeholder="Medya türü seçin (isteğe bağlı)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Resim Yükle</SelectItem>
                <SelectItem value="video">Video Yükle</SelectItem>
                <SelectItem value="url">URL Ekle (Resim/Video/YouTube/Diğer)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(selectedLocalMediaType === 'image' || selectedLocalMediaType === 'video') && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="mediaFile" className="text-right">
                {selectedLocalMediaType === 'image' ? 'Resim' : 'Video'}
              </Label>
              <div className="col-span-3">
                <Button type="button" variant="outline" onClick={triggerFileInput} disabled={isProcessing}>
                  {selectedLocalMediaType === 'image' ? <ImagePlus className="mr-2 h-4 w-4" /> : <Video className="mr-2 h-4 w-4" />}
                  {getFileUploadButtonText()}
                </Button>
                <input
                  type="file"
                  id="mediaFile"
                  accept={getSelectedFileAcceptType()}
                  onChange={handleFileChange}
                  className="hidden"
                  ref={fileInputRef}
                />
                {mediaDataUri && mediaFileType?.startsWith(selectedLocalMediaType + '/') && <p className="text-xs mt-1 text-muted-foreground">{selectedLocalMediaType === 'image' ? 'Resim' : 'Video'} seçildi.</p>}
              </div>
            </div>
          )}
          
          {selectedLocalMediaType === 'url' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="mediaUrlInput" className="text-right">
                Medya URL
              </Label>
              <div className="col-span-3">
                <Input
                  id="mediaUrlInput"
                  type="url"
                  value={mediaUrlInput}
                  onChange={(e) => {
                    setMediaUrlInput(e.target.value);
                  }}
                  placeholder="https://... veya YouTube/Vimeo linki"
                  className="flex-grow"
                  disabled={isProcessing}
                />
              </div>
            </div>
          )}

          {isProcessing && (selectedLocalMediaType === 'image' || selectedLocalMediaType === 'video') && (
            <div className="col-start-2 col-span-3 flex items-center py-1">
              <Loader2 className="h-4 w-4 animate-spin mr-2 text-primary" />
              <p className="text-xs text-muted-foreground">Medya işleniyor...</p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
              İptal
            </Button>
            <Button
              type="submit"
              disabled={
                isProcessing || 
                !title.trim() || 
                !content.trim() || 
                (selectedLocalMediaType === 'url' && !mediaUrlInput.trim()) || 
                ((selectedLocalMediaType === 'image' || selectedLocalMediaType === 'video') && !mediaDataUri && selectedLocalMediaType !== null && !(selectedLocalMediaType === 'video' && mediaDataUri === null && fileInputRef.current?.files && fileInputRef.current.files.length > 0 && fileInputRef.current.files[0].size > MAX_VIDEO_DATA_URI_CONVERSION_LIMIT_RAW_MB * 1024 * 1024))
                // ^ This last part ensures that if a large video was selected (and mediaDataUri is null due to not converting),
                // the button is still disabled because it cannot be submitted as a data URI.
              }
            >
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yayınla
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

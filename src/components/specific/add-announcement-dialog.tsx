
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

const MAX_IMAGE_RAW_SIZE_MB = 5; // 5MB for images (raw file)
const MAX_VIDEO_RAW_SIZE_MB_SELECT = 10; // User can select up to 10MB video
const MAX_VIDEO_DATA_URI_CONVERSION_LIMIT_RAW_MB = 7; // Practical limit for base64 conversion (approx 7MB raw -> 9.6MB base64)

const MAX_IMAGE_DATA_URI_LENGTH = Math.floor(MAX_IMAGE_RAW_SIZE_MB * 1024 * 1024 * 1.37 * 1.05); // Approx 7.2MB for 5MB raw image
const MAX_VIDEO_DATA_URI_LENGTH = Math.floor(MAX_VIDEO_DATA_URI_CONVERSION_LIMIT_RAW_MB * 1024 * 1024 * 1.37 * 1.05); // Approx 9.6MB for 7MB raw video


export function AddAnnouncementDialog({ isOpen, onOpenChange }: AddAnnouncementDialogProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaDataUri, setMediaDataUri] = useState<string | null>(null);
  const [mediaFileType, setMediaFileType] = useState<string | null>(null);
  const [selectedLocalMediaType, setSelectedLocalMediaType] = useState<MediaType>(null);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showVideoConversionWarning, setShowVideoConversionWarning] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);


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
      setShowVideoConversionWarning(false);
      setSelectedFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [isOpen]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setShowVideoConversionWarning(false);
    setMediaDataUri(null);
    setMediaFileType(null);
    setSelectedFileName(null);


    if (file) {
      setSelectedFileName(file.name);
      const selectedType = selectedLocalMediaType;
      let maxRawSizeMB_UI_Display = 0; // Max size user is told they can select
      let practicalConversionLimitMB_Raw = Infinity; // Max raw size we'll attempt to convert to base64
      let maxDataUriLengthForCheck = Infinity; // Max length for the base64 string

      if (selectedType === 'image') {
        maxRawSizeMB_UI_Display = MAX_IMAGE_RAW_SIZE_MB;
        practicalConversionLimitMB_Raw = MAX_IMAGE_RAW_SIZE_MB;
        maxDataUriLengthForCheck = MAX_IMAGE_DATA_URI_LENGTH;
      } else if (selectedType === 'video') {
        maxRawSizeMB_UI_Display = MAX_VIDEO_RAW_SIZE_MB_SELECT;
        practicalConversionLimitMB_Raw = MAX_VIDEO_DATA_URI_CONVERSION_LIMIT_RAW_MB;
        maxDataUriLengthForCheck = MAX_VIDEO_DATA_URI_LENGTH;
      } else {
        toast({ title: "Medya Türü Seçilmedi", description: "Lütfen önce bir medya türü (resim/video) seçin.", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        setSelectedFileName(null);
        return;
      }

      if (file.size > maxRawSizeMB_UI_Display * 1024 * 1024) {
        toast({
          title: "Dosya Boyutu Çok Büyük",
          description: `Lütfen ${maxRawSizeMB_UI_Display}MB'den küçük bir ${selectedType === 'image' ? 'resim' : 'video'} dosyası seçin.`,
          variant: "destructive",
          duration: 7000,
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        setSelectedFileName(null);
        return;
      }

      if (selectedType === 'video' && file.size > practicalConversionLimitMB_Raw * 1024 * 1024) {
        setShowVideoConversionWarning(true); // Set flag to show warning
        setMediaFileType(file.type); // Store file type but not data URI yet
        // User will be prompted for URL or to choose smaller file
        // Do not attempt to read as data URI for very large videos
        return;
      }
      
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (!result || typeof result !== 'string' || !(result.startsWith('data:image/') || result.startsWith('data:video/'))) {
            toast({ title: "Geçersiz Dosya Verisi", description: "Dosya okunamadı veya format desteklenmiyor.", variant: "destructive" });
            if (fileInputRef.current) fileInputRef.current.value = "";
            setIsProcessing(false);
            setSelectedFileName(null);
            return;
        }

        if (result.length > maxDataUriLengthForCheck) {
          const currentRawLimitMB = selectedType === 'image' ? MAX_IMAGE_RAW_SIZE_MB : MAX_VIDEO_DATA_URI_CONVERSION_LIMIT_RAW_MB;
          toast({
            title: "Medya Verisi Çok Büyük",
            description: `İşlenmiş medya verisi çok büyük. Lütfen daha küçük boyutlu bir dosya seçin (Maksimum ~${currentRawLimitMB}MB ham dosya).`,
            variant: "destructive",
            duration: 8000,
          });
          if (fileInputRef.current) fileInputRef.current.value = "";
          setIsProcessing(false);
          setSelectedFileName(null);
          return;
        }
        setMediaDataUri(result);
        setMediaFileType(file.type);
        setIsProcessing(false);
      };
      reader.onerror = () => {
        toast({ title: 'Dosya Okuma Hatası', description: 'Dosya okunurken bir hata oluştu.', variant: 'destructive' });
        if (fileInputRef.current) fileInputRef.current.value = "";
        setIsProcessing(false);
        setSelectedFileName(null);
      }
      reader.readAsDataURL(file);
    } else {
        setSelectedFileName(null);
    }
  };

  const handleMediaTypeSelect = (value: string) => {
    setSelectedLocalMediaType(value as MediaType);
    setMediaDataUri(null);
    setMediaFileType(null);
    setMediaUrlInput('');
    setShowVideoConversionWarning(false);
    setSelectedFileName(null);
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
    
    if (selectedLocalMediaType === 'video' && showVideoConversionWarning && !mediaUrlInput.trim()) {
        const selectedFileSizeMB = (fileInputRef.current?.files?.[0]?.size || 0) / (1024*1024);
        toast({ 
            title: "Büyük Video Dosyası", 
            description: `Seçilen video dosyası (${selectedFileSizeMB.toFixed(1)}MB) doğrudan yüklenemez (pratik limit ~${MAX_VIDEO_DATA_URI_CONVERSION_LIMIT_RAW_MB}MB). Lütfen URL olarak ekleyin veya daha küçük bir video seçin.`, 
            variant: "warning", 
            duration: 10000 
        });
        return;
    }


    let finalMedia: string | null = null;
    let finalMediaType: string | null = null;

    if (selectedLocalMediaType === 'url' && mediaUrlInput.trim()) {
        try {
            const url = new URL(mediaUrlInput.trim());
            finalMedia = url.href;
            // Basic type detection from URL extension or known video platform domains
            if (/\.(jpeg|jpg|gif|png|webp)(\?|$)/i.test(finalMedia)) finalMediaType = 'image/url';
            else if (/\.(mp4|webm|ogg)(\?|$)/i.test(finalMedia)) finalMediaType = 'video/url'; // Direct video file
            else if (/youtu\.?be/i.test(finalMedia) || /vimeo\.com/i.test(finalMedia)) finalMediaType = 'video/url'; // Platform video
            else finalMediaType = 'url/link'; // Generic link
        } catch (_) {
            toast({ title: "Geçersiz Medya URL'si", description: "Lütfen URL alanına geçerli bir resim, video veya genel web bağlantısı girin.", variant: "destructive" });
            return;
        }
    } else if ((selectedLocalMediaType === 'image' || selectedLocalMediaType === 'video') && mediaDataUri && mediaFileType && !showVideoConversionWarning) {
        // This path is for successfully read and validated file uploads (not too large for base64 conversion)
        if (!(mediaDataUri.startsWith('data:image/') || mediaDataUri.startsWith('data:video/'))) {
            toast({ title: "Geçersiz Yüklenmiş Medya", description: "Yüklenen dosya verisi hatalı görünüyor. Lütfen dosyayı tekrar seçin.", variant: "destructive" });
            return;
        }
        finalMedia = mediaDataUri;
        finalMediaType = mediaFileType;
    } else if (selectedLocalMediaType === 'video' && showVideoConversionWarning && mediaUrlInput.trim()) {
        // Large video selected, but URL provided instead
        try {
            const url = new URL(mediaUrlInput.trim());
            finalMedia = url.href;
            // Assume it's a video URL if we are in this path
            finalMediaType = 'video/url';
        } catch (_) {
            toast({ title: "Geçersiz Video URL'si", description: "Büyük video için sağlanan URL geçerli değil.", variant: "destructive" });
            return;
        }
    }


    setIsProcessing(true);
    try {
      await addAnnouncement({ title, content, media: finalMedia, mediaType: finalMediaType });
      onOpenChange(false); 
    } catch (error: any) {
      console.error("AddAnnouncementDialog handleSubmit error:", error);
       if (error.message && !error.message.includes("kota") && !error.message.includes("büyük")) {
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
    if (selectedLocalMediaType === 'video') return `Video Seç (Max ${MAX_VIDEO_RAW_SIZE_MB_SELECT}MB)`;
    return 'Dosya Seç';
  };
  
  const getSelectedFileAcceptType = () => {
    if (selectedLocalMediaType === 'image') return "image/*";
    if (selectedLocalMediaType === 'video') return "video/*";
    return "";
  }

  const isSubmitDisabled = () => {
    if (isProcessing || !title.trim() || !content.trim()) return true;

    if (selectedLocalMediaType === 'url') {
      return !mediaUrlInput.trim();
    }
    
    if (selectedLocalMediaType === 'image') {
      return !mediaDataUri; // Requires a successfully processed data URI
    }
    
    if (selectedLocalMediaType === 'video') {
      // If large video warning is shown, URL input must be filled
      if (showVideoConversionWarning) return !mediaUrlInput.trim();
      // If no large video warning, data URI must be present
      return !mediaDataUri; 
    }
    // If no media type is selected, submitting is fine (no media)
    // If a media type IS selected, but no valid input (URL or data URI) is ready, then disable.
    return false; 
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
                  disabled={isProcessing}
                />
                 {selectedFileName && <p className="text-xs mt-1 text-muted-foreground">Seçilen dosya: {selectedFileName}</p>}
                {mediaDataUri && mediaFileType?.startsWith(selectedLocalMediaType + '/') && !showVideoConversionWarning && (
                    <p className="text-xs mt-1 text-green-600">{selectedLocalMediaType === 'image' ? 'Resim' : 'Video'} seçildi ve yüklenebilir.</p>
                )}
                 {selectedLocalMediaType === 'video' && showVideoConversionWarning && (
                    <div className="mt-2 space-y-2">
                        <p className="text-xs text-amber-600">
                        Bu video dosyası (Max {MAX_VIDEO_RAW_SIZE_MB_SELECT}MB, Dönüştürme Limiti ~{MAX_VIDEO_DATA_URI_CONVERSION_LIMIT_RAW_MB}MB) doğrudan işlenemez. 
                        Lütfen aşağıdaki URL alanına harici bir bağlantı (YouTube, Vimeo, vb.) girin veya daha küçük bir dosya seçin.
                        </p>
                        <Input
                        id="mediaUrlInputLargeVideo"
                        type="url"
                        value={mediaUrlInput}
                        onChange={(e) => setMediaUrlInput(e.target.value)}
                        placeholder="Büyük video için URL girin (örn: YouTube)"
                        disabled={isProcessing}
                        />
                    </div>
                 )}
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

          {isProcessing && (selectedLocalMediaType === 'image' || (selectedLocalMediaType === 'video' && !showVideoConversionWarning)) && (
            <div className="col-start-2 col-span-3 flex items-center py-1">
              <Loader2 className="h-4 w-4 animate-spin mr-2 text-primary" />
              <p className="text-xs text-muted-foreground">Medya işleniyor...</p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitDisabled()}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yayınla
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


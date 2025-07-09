
"use client";

import { useState, type ChangeEvent, type FormEvent, useEffect, useRef } from 'react';
import { useAnnouncements, type Announcement, type NewAnnouncementPayload, type EditAnnouncementPayload } from '@/hooks/use-announcements';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/user-context';
import { ImagePlus, Video, Link2, Loader2, Trash2, XCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from 'next/image';

interface AddAnnouncementDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  announcementToEdit?: Announcement | null;
}

type MediaType = 'image' | 'video' | 'url' | null;

const MAX_IMAGE_RAW_SIZE_MB = 5;
const MAX_VIDEO_RAW_SIZE_MB_SELECT = 10;
const MAX_VIDEO_DATA_URI_CONVERSION_LIMIT_RAW_MB = 7;
const MAX_IMAGE_DATA_URI_LENGTH = Math.floor(MAX_IMAGE_RAW_SIZE_MB * 1024 * 1024 * 1.37 * 1.05);
const MAX_VIDEO_DATA_URI_LENGTH = Math.floor(MAX_VIDEO_DATA_URI_CONVERSION_LIMIT_RAW_MB * 1024 * 1024 * 1.37 * 1.05);

export function AddAnnouncementDialog({ isOpen, onOpenChange, announcementToEdit = null }: AddAnnouncementDialogProps) {
  const { addAnnouncement, editAnnouncement } = useAnnouncements();
  const { user } = useUser();
  const { toast } = useToast();
  
  const isEditMode = !!announcementToEdit;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaDataUri, setMediaDataUri] = useState<string | null>(null);
  const [mediaFileType, setMediaFileType] = useState<string | null>(null);
  const [selectedLocalMediaType, setSelectedLocalMediaType] = useState<MediaType>(null);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showVideoConversionWarning, setShowVideoConversionWarning] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [mediaChanged, setMediaChanged] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetAllState = () => {
    setTitle('');
    setContent('');
    setMediaDataUri(null);
    setMediaFileType(null);
    setSelectedLocalMediaType(null);
    setMediaUrlInput('');
    setIsProcessing(false);
    setShowVideoConversionWarning(false);
    setSelectedFileName(null);
    setMediaChanged(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && announcementToEdit) {
        setTitle(announcementToEdit.title);
        setContent(announcementToEdit.content);
        setMediaDataUri(announcementToEdit.media || null);
        setMediaFileType(announcementToEdit.mediaType || null);
        if (announcementToEdit.mediaType?.startsWith('image')) {
          setSelectedLocalMediaType('image');
        } else if (announcementToEdit.mediaType?.startsWith('video')) {
          setSelectedLocalMediaType('video');
        } else if (announcementToEdit.mediaType?.includes('url')) {
          setSelectedLocalMediaType('url');
          setMediaUrlInput(announcementToEdit.media || '');
        } else {
          setSelectedLocalMediaType(null);
        }
        setMediaChanged(false);
      } else {
        resetAllState();
      }
    }
  }, [isOpen, isEditMode, announcementToEdit]);
  
  const handleMediaTypeSelect = (value: MediaType) => {
    setMediaDataUri(null);
    setMediaFileType(null);
    setMediaUrlInput('');
    setSelectedFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setShowVideoConversionWarning(false);
    setSelectedLocalMediaType(value);
  };
  
  const handleRemoveMedia = () => {
    setMediaDataUri(null);
    setMediaFileType(null);
    setMediaUrlInput('');
    setSelectedFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (isEditMode) {
      setMediaChanged(true);
    }
  };
  
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setMediaChanged(true);
    const file = event.target.files?.[0];
    if (!file) {
      handleRemoveMedia();
      return;
    }

    const isImage = selectedLocalMediaType === 'image';
    const isVideo = selectedLocalMediaType === 'video';
    const rawFileSizeLimitMB = isVideo ? MAX_VIDEO_RAW_SIZE_MB_SELECT : MAX_IMAGE_RAW_SIZE_MB;
    const dataUriConversionLimitMB = isVideo ? MAX_VIDEO_DATA_URI_CONVERSION_LIMIT_RAW_MB : MAX_IMAGE_RAW_SIZE_MB;
    const dataUriSizeLimit = isVideo ? MAX_VIDEO_DATA_URI_LENGTH : MAX_IMAGE_DATA_URI_LENGTH;

    if (file.size > rawFileSizeLimitMB * 1024 * 1024) {
      toast({
        title: "Dosya Boyutu Çok Büyük",
        description: `Lütfen ${rawFileSizeLimitMB}MB'den küçük bir dosya seçin.`,
        variant: "destructive",
      });
      handleRemoveMedia();
      return;
    }
    
    if (isVideo && file.size > dataUriConversionLimitMB * 1024 * 1024) {
        setShowVideoConversionWarning(true);
    } else {
        setShowVideoConversionWarning(false);
    }
    
    setSelectedFileName(file.name);
    setMediaFileType(file.type);

    const reader = new FileReader();
    reader.onloadstart = () => setIsProcessing(true);
    reader.onerror = () => {
        setIsProcessing(false);
        toast({ title: "Dosya Okuma Hatası", description: "Dosya okunurken bir hata oluştu.", variant: "destructive"});
        handleRemoveMedia();
    };
    reader.onloadend = () => {
      const dataUri = reader.result as string;

      if (!dataUri || (isImage && !dataUri.startsWith('data:image/')) || (isVideo && !dataUri.startsWith('data:video/'))) {
        toast({ title: "Geçersiz Dosya Formatı", description: "Lütfen geçerli bir resim veya video dosyası seçin.", variant: "destructive" });
        handleRemoveMedia();
        setIsProcessing(false);
        return;
      }
      
      if (dataUri.length > dataUriSizeLimit) {
        toast({ title: "Dosya Verisi Çok Büyük", description: `İşlenmiş dosya verisi çok büyük. Lütfen daha küçük boyutlu veya daha iyi sıkıştırılmış bir ${isImage ? 'resim' : 'video'} dosyası seçin.`, variant: "destructive" });
        handleRemoveMedia();
        setIsProcessing(false);
        return;
      }
      
      setMediaDataUri(dataUri);
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast({ title: 'Hata', description: 'Bu işlemi yapmak için giriş yapmalısınız.', variant: 'destructive' });
      return;
    }
    if (!title.trim() || !content.trim()) {
      toast({ title: 'Eksik Bilgi', description: 'Lütfen başlık ve içerik alanlarını doldurun.', variant: 'destructive' });
      return;
    }
    if (showVideoConversionWarning && mediaDataUri && mediaDataUri.length > MAX_VIDEO_DATA_URI_LENGTH) {
        toast({ title: "Video Dosyası Çok Büyük", description: `Seçtiğiniz video dosyası, sunucuya yüklenebilmek için çok büyük. Lütfen ${MAX_VIDEO_DATA_URI_CONVERSION_LIMIT_RAW_MB}MB'den küçük bir dosya seçin.`, variant: "destructive", duration: 8000 });
        return;
    }
    
    let finalMedia: string | null = null;
    let finalMediaType: string | null = null;

    if (isEditMode && !mediaChanged) {
        finalMedia = announcementToEdit.media || null;
        finalMediaType = announcementToEdit.mediaType || null;
    } else {
       if (selectedLocalMediaType === 'url' && mediaUrlInput.trim()) {
            finalMedia = mediaUrlInput.trim();
            if (/\.(jpeg|jpg|gif|png|webp)(\?|$)/i.test(finalMedia)) finalMediaType = 'image/url';
            else if (/\.(mp4|webm|ogg)(\?|$)/i.test(finalMedia)) finalMediaType = 'video/url';
            else if (/youtu\.?be/i.test(finalMedia) || /vimeo\.com/i.test(finalMedia)) finalMediaType = 'video/url';
            else finalMediaType = 'url/link';
        } else if ((selectedLocalMediaType === 'image' || selectedLocalMediaType === 'video') && mediaDataUri && mediaFileType) {
            finalMedia = mediaDataUri;
            finalMediaType = mediaFileType;
        }
    }

    setIsProcessing(true);
    const payload: EditAnnouncementPayload = { title, content, media: finalMedia, mediaType: finalMediaType };

    try {
      if (isEditMode) {
        await editAnnouncement(announcementToEdit.id, payload);
      } else {
        await addAnnouncement(payload);
      }
      onOpenChange(false);
    } catch (error: any) {
      // The hook will show the toast, so no need to toast again here.
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Duyuruyu Düzenle" : "Yeni Duyuru Ekle"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Mevcut duyurudaki bilgileri güncelleyin." : "Köy halkını bilgilendirmek için yeni bir duyuru yayınlayın."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Başlık
            </Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" required disabled={isProcessing}/>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="content" className="text-right pt-2">
              İçerik
            </Label>
            <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} className="col-span-3 min-h-[100px]" required disabled={isProcessing} />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="mediaTypeSelect" className="text-right">Medya Türü</Label>
            <Select value={selectedLocalMediaType || ""} onValueChange={(value) => { handleMediaTypeSelect(value as MediaType); setMediaChanged(true); }} disabled={isProcessing}>
              <SelectTrigger className="col-span-3" id="mediaTypeSelect"><SelectValue placeholder="Medya türü seçin (isteğe bağlı)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Resim Yükle</SelectItem>
                <SelectItem value="video">Video Yükle</SelectItem>
                <SelectItem value="url">URL Ekle (Resim/Video/YouTube/Diğer)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {(isEditMode && mediaDataUri && !mediaChanged) && (
             <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Mevcut Medya</Label>
                <div className="col-span-3 space-y-2">
                  {mediaDataUri.startsWith('data:image') && <Image src={mediaDataUri} alt="Mevcut medya" width={100} height={75} className="rounded-md border object-cover"/>}
                  {mediaDataUri.startsWith('data:video') && <p className="text-xs text-muted-foreground">Kaydedilmiş bir video dosyası mevcut.</p>}
                  {mediaFileType?.includes('url') && <a href={mediaDataUri} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate block">{mediaDataUri}</a>}
                   <Button type="button" variant="outline" size="sm" className="text-xs" onClick={handleRemoveMedia}>
                     <XCircle className="mr-1 h-3 w-3" /> Medyayı Kaldır
                  </Button>
                </div>
             </div>
          )}
          
          {(!isEditMode || mediaChanged) && (
            <>
              {selectedLocalMediaType === 'url' && (
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="mediaUrl" className="text-right">Medya URL</Label>
                    <Input id="mediaUrl" value={mediaUrlInput} onChange={(e) => setMediaUrlInput(e.target.value)} className="col-span-3" placeholder="https://..." disabled={isProcessing} />
                </div>
              )}

              {(selectedLocalMediaType === 'image' || selectedLocalMediaType === 'video') && (
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="mediaFile" className="text-right">Dosya Seç</Label>
                      <Input id="mediaFile" type="file" ref={fileInputRef} onChange={handleFileChange} className="col-span-3 file:mr-2 file:text-xs" accept={selectedLocalMediaType === 'image' ? "image/png, image/jpeg, image/gif, image/webp" : "video/mp4,video/webm,video/ogg"} disabled={isProcessing} />
                  </div>
              )}

              {(mediaDataUri || selectedFileName) && (
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right pt-2">Önizleme</Label>
                    <div className="col-span-3 space-y-2">
                        {isProcessing && <div className="flex items-center text-xs text-muted-foreground"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> İşleniyor...</div>}
                        {!isProcessing && selectedLocalMediaType === 'image' && mediaDataUri && <Image src={mediaDataUri} alt="Önizleme" width={100} height={75} className="rounded-md border object-cover"/>}
                        {!isProcessing && selectedLocalMediaType === 'video' && mediaDataUri && <video src={mediaDataUri} controls className="max-w-full h-auto rounded-md border" style={{maxHeight: '150px'}} />}
                        {selectedFileName && <p className="text-xs text-muted-foreground truncate">{selectedFileName}</p>}
                        {showVideoConversionWarning && <p className="text-xs text-amber-600">Bu video dosyası, sunucuya yüklenemeyecek kadar büyük olabilir. {MAX_VIDEO_DATA_URI_CONVERSION_LIMIT_RAW_MB}MB'den küçük bir dosya seçmeniz önerilir.</p>}
                        <Button type="button" variant="outline" size="sm" className="text-xs" onClick={handleRemoveMedia} disabled={isProcessing}><XCircle className="mr-1 h-3 w-3"/> Seçimi Temizle</Button>
                    </div>
                  </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>İptal</Button>
            <Button type="submit" disabled={isProcessing || !title.trim() || !content.trim()}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? "Değişiklikleri Kaydet" : "Yayınla"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

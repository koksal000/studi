
"use client";

import { useState, type ChangeEvent, type FormEvent, useEffect, useRef } from 'react';
import { useAnnouncements, type Announcement, type NewAnnouncementPayload } from '@/hooks/use-announcements';
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
  
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setMediaChanged(true);
    // ... (rest of the function is the same)
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
    // ... (logic for video conversion warning is the same)
    
    let finalMedia: string | null = null;
    let finalMediaType: string | null = null;

    if (isEditMode && !mediaChanged) {
        finalMedia = announcementToEdit.media || null;
        finalMediaType = announcementToEdit.mediaType || null;
    } else {
      // ... (logic to determine finalMedia and finalMediaType is the same as before)
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
    try {
      if (isEditMode) {
        await editAnnouncement(announcementToEdit.id, { title, content, media: finalMedia, mediaType: finalMediaType });
      } else {
        await addAnnouncement({ title, content, media: finalMedia, mediaType: finalMediaType });
      }
      onOpenChange(false);
    } catch (error: any) {
      // The hook will show the toast
    } finally {
      setIsProcessing(false);
    }
  };

  // ... (other helper functions are the same)

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
          
          {/* Media preview for edit mode */}
          {isEditMode && mediaDataUri && !mediaChanged && (
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

          {/* ... (rest of the file upload/URL input logic is mostly the same, but now respects mediaChanged) */}
          
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

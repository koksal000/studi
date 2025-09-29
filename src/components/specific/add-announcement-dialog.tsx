
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
import { ImagePlus, Video, Link2, Loader2, Trash2, XCircle, UploadCloud } from 'lucide-react';
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
const MAX_FILE_SIZE_MB = 70;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function AddAnnouncementDialog({ isOpen, onOpenChange, announcementToEdit = null }: AddAnnouncementDialogProps) {
  const { addAnnouncement, editAnnouncement } = useAnnouncements();
  const { user } = useUser();
  const { toast } = useToast();
  
  const isEditMode = !!announcementToEdit;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  // State for the FINAL media URL that will be saved
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaFileType, setMediaFileType] = useState<string | null>(null);
  
  // State for the UI controls
  const [selectedLocalMediaType, setSelectedLocalMediaType] = useState<MediaType>(null);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [mediaUrlInput, setMediaUrlInput] = useState('');

  const [isProcessing, setIsProcessing] = useState(false); // Covers both upload and form submission
  const [mediaChanged, setMediaChanged] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetAllState = () => {
    setTitle('');
    setContent('');
    setMediaUrl(null);
    setMediaFileType(null);
    setSelectedLocalMediaType(null);
    setMediaUrlInput('');
    setLocalFile(null);
    setLocalPreview(null);
    setIsProcessing(false);
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
        setMediaUrl(announcementToEdit.media || null);
        setMediaFileType(announcementToEdit.mediaType || null);
        
        // Set UI state based on existing media
        if (announcementToEdit.mediaType?.includes('url')) {
            setSelectedLocalMediaType('url');
            setMediaUrlInput(announcementToEdit.media || '');
        } else if (announcementToEdit.mediaType?.startsWith('image')) {
            setSelectedLocalMediaType('image');
        } else if (announcementToEdit.mediaType?.startsWith('video')) {
            setSelectedLocalMediaType('video');
        } else {
            setSelectedLocalMediaType(null);
        }
        setMediaChanged(false);
        setLocalFile(null);
        setLocalPreview(null);
      } else {
        resetAllState();
      }
    }
  }, [isOpen, isEditMode, announcementToEdit]);
  
  const handleMediaTypeSelect = (value: MediaType) => {
    // Reset all media state when changing type
    setMediaUrl(null);
    setMediaFileType(null);
    setMediaUrlInput('');
    setLocalFile(null);
    setLocalPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSelectedLocalMediaType(value);
    setMediaChanged(true); // Changing type is a media change
  };
  
  const handleRemoveMedia = () => {
    setMediaUrl(null);
    setMediaFileType(null);
    setMediaUrlInput('');
    setLocalFile(null);
    setLocalPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (isEditMode) {
      setMediaChanged(true);
    }
  };
  
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setMediaChanged(true);
    const file = event.target.files?.[0];
    if (!file) {
      setLocalFile(null);
      setLocalPreview(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({
            title: "Dosya Boyutu Çok Büyük",
            description: `Lütfen ${MAX_FILE_SIZE_MB}MB'den küçük bir dosya seçin.`,
            variant: "destructive",
            duration: 7000,
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        setLocalFile(null);
        setLocalPreview(null);
        return;
    }
    
    setLocalFile(file);
    setMediaFileType(file.type); // Store the file type for later
    
    // Create a local preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLocalPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };
  
  const uploadFileToCatbox = async (file: File): Promise<string> => {
      const reader = new FileReader();
      const fileDataPromise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
      });
      const fileDataUri = await fileDataPromise;

      const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileDataUri, fileName: file.name }),
      });

      if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'File could not be uploaded to the server.' }));
          throw new Error(errorData.message);
      }

      const { url } = await response.json();
      return url;
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
    
    setIsProcessing(true);
    
    let finalMedia: string | null = mediaUrl; // Start with existing URL if any
    let finalMediaType: string | null = mediaFileType;

    try {
        if (mediaChanged) {
          if (selectedLocalMediaType === 'url' && mediaUrlInput.trim()) {
              finalMedia = mediaUrlInput.trim();
              if (/\.(jpeg|jpg|gif|png|webp)(\?|$)/i.test(finalMedia)) finalMediaType = 'image/url';
              else if (/\.(mp4|webm|ogg)(\?|$)/i.test(finalMedia)) finalMediaType = 'video/url';
              else if (/youtu\.?be/i.test(finalMedia) || /vimeo\.com/i.test(finalMedia)) finalMediaType = 'video/url';
              else finalMediaType = 'url/link';
          } else if ((selectedLocalMediaType === 'image' || selectedLocalMediaType === 'video') && localFile) {
              toast({ title: 'Yükleniyor...', description: `"${localFile.name}" Catbox.moe servisine yükleniyor...` });
              finalMedia = await uploadFileToCatbox(localFile);
              // mediaFileType was already set in handleFileChange
              finalMediaType = localFile.type;
          } else {
              // Media was removed
              finalMedia = null;
              finalMediaType = null;
          }
        }

        const payload: EditAnnouncementPayload = { title, content, media: finalMedia, mediaType: finalMediaType };

        if (isEditMode) {
            await editAnnouncement(announcementToEdit.id, payload);
        } else {
            await addAnnouncement(payload);
        }
        onOpenChange(false);

    } catch (error: any) {
      toast({ title: 'İşlem Başarısız', description: error.message, variant: 'destructive' });
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
            <Select value={selectedLocalMediaType || ""} onValueChange={(value) => handleMediaTypeSelect(value as MediaType)} disabled={isProcessing}>
              <SelectTrigger className="col-span-3" id="mediaTypeSelect"><SelectValue placeholder="Medya türü seçin (isteğe bağlı)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="image"><ImagePlus className="mr-2 h-4 w-4" /> Resim Yükle</SelectItem>
                <SelectItem value="video"><Video className="mr-2 h-4 w-4" /> Video Yükle</SelectItem>
                <SelectItem value="url"><Link2 className="mr-2 h-4 w-4" /> URL Ekle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {(mediaUrl && !mediaChanged) && (
             <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Mevcut Medya</Label>
                <div className="col-span-3 space-y-2">
                  {mediaUrl.startsWith('http') && mediaFileType?.startsWith('image') && <Image src={mediaUrl} alt="Mevcut medya" width={100} height={75} className="rounded-md border object-cover"/>}
                  {mediaUrl.startsWith('http') && mediaFileType?.startsWith('video') && <p className="text-xs text-muted-foreground">Kaydedilmiş bir video bağlantısı mevcut.</p>}
                  <a href={mediaUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate block">{mediaUrl}</a>
                   <Button type="button" variant="outline" size="sm" className="text-xs" onClick={handleRemoveMedia}>
                     <XCircle className="mr-1 h-3 w-3" /> Medyayı Değiştir/Kaldır
                  </Button>
                </div>
             </div>
          )}
          
          {mediaChanged && (
            <>
              {selectedLocalMediaType === 'url' && (
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="mediaUrl" className="text-right">Medya URL</Label>
                    <Input id="mediaUrl" value={mediaUrlInput} onChange={(e) => setMediaUrlInput(e.target.value)} className="col-span-3" placeholder="https://..." disabled={isProcessing} />
                </div>
              )}

              {(selectedLocalMediaType === 'image' || selectedLocalMediaType === 'video') && (
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="mediaFile" className="text-right">Dosya Seçin (Max {MAX_FILE_SIZE_MB}MB)</Label>
                      <Input id="mediaFile" type="file" ref={fileInputRef} onChange={handleFileChange} className="col-span-3 file:mr-2 file:text-xs" accept={selectedLocalMediaType === 'image' ? "image/png, image/jpeg, image/gif, image/webp" : "video/mp4,video/webm,video/ogg"} disabled={isProcessing} />
                  </div>
              )}

              {localPreview && (
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right pt-2">Önizleme</Label>
                    <div className="col-span-3 space-y-2">
                        {selectedLocalMediaType === 'image' && <Image src={localPreview} alt="Önizleme" width={100} height={75} className="rounded-md border object-cover"/>}
                        {selectedLocalMediaType === 'video' && <video src={localPreview} controls className="max-w-full h-auto rounded-md border" style={{maxHeight: '150px'}} />}
                        {localFile && <p className="text-xs text-muted-foreground truncate">{localFile.name}</p>}
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
              {isProcessing ? 'İşleniyor...' : (isEditMode ? 'Değişiklikleri Kaydet' : 'Yayınla')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
    

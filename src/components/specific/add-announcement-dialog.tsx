
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

export function AddAnnouncementDialog({ isOpen, onOpenChange }: AddAnnouncementDialogProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null); 
  const [selectedMediaType, setSelectedMediaType] = useState<MediaType>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { addAnnouncement } = useAnnouncements();
  const { user } = useUser();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Reset form when dialog closes or opens
    if (isOpen) {
      setTitle('');
      setContent('');
      setMedia(null);
      setMediaType(null);
      setSelectedMediaType(null);
      setMediaUrl('');
      setIsProcessing(false);
    }
  }, [isOpen]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMedia(reader.result as string);
        setMediaType(file.type);
        setIsProcessing(false);
      };
      reader.onerror = () => {
        toast({
          title: 'Dosya Okuma Hatası',
          description: 'Dosya okunurken bir hata oluştu.',
          variant: 'destructive',
        });
        setIsProcessing(false);
      }
      reader.readAsDataURL(file);
    }
  };

  const handleAddMediaUrl = () => {
    if (mediaUrl.trim()) {
      setMedia(mediaUrl.trim());
      // Basic check for image/video URL to set a generic type
      if (/\.(jpeg|jpg|gif|png)$/i.test(mediaUrl)) {
        setMediaType('url'); // Could be 'image/url' if more specific type is needed
      } else if (/\.(mp4|webm|ogg)$/i.test(mediaUrl)) {
        setMediaType('url'); // Could be 'video/url'
      } else {
        setMediaType('url'); // Generic URL type
      }
      setMediaUrl(''); // Clear input after adding
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast({
        title: 'Hata',
        description: 'Duyuru eklemek için giriş yapmalısınız.',
        variant: 'destructive',
      });
      return;
    }
    if (!title.trim() || !content.trim()) {
      toast({
        title: 'Eksik Bilgi',
        description: 'Lütfen başlık ve içerik alanlarını doldurun.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      addAnnouncement({ title, content, media, mediaType });
      toast({
        title: 'Duyuru Eklendi',
        description: `"${title}" başlıklı duyurunuz başarıyla eklendi.`,
      });
      onOpenChange(false); // Close dialog on success
    } catch (error) {
      toast({
        title: 'Duyuru Eklenemedi',
        description: 'Duyuru eklenirken bir sorun oluştu.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

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
            <Label htmlFor="mediaType" className="text-right">
              Medya Türü
            </Label>
            <Select 
              value={selectedMediaType || ""}
              onValueChange={(value) => setSelectedMediaType(value as MediaType)}
              disabled={isProcessing}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Medya türü seçin (isteğe bağlı)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Resim Yükle</SelectItem>
                <SelectItem value="video">Video Yükle</SelectItem>
                <SelectItem value="url">URL Ekle (Resim/Video)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedMediaType === 'image' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="imageFile" className="text-right">
                Resim
              </Label>
              <div className="col-span-3">
                <Button type="button" variant="outline" onClick={triggerFileInput} disabled={isProcessing}>
                  <ImagePlus className="mr-2 h-4 w-4" /> Resim Seç
                </Button>
                <input 
                  type="file" 
                  id="imageFile" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                  className="hidden"
                  ref={fileInputRef}
                />
                {media && mediaType?.startsWith('image/') && <p className="text-xs mt-1 text-muted-foreground">Resim seçildi.</p>}
              </div>
            </div>
          )}

          {selectedMediaType === 'video' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="videoFile" className="text-right">
                Video
              </Label>
               <div className="col-span-3">
                <Button type="button" variant="outline" onClick={triggerFileInput} disabled={isProcessing}>
                  <Video className="mr-2 h-4 w-4" /> Video Seç
                </Button>
                 <input 
                  type="file" 
                  id="videoFile" 
                  accept="video/*" 
                  onChange={handleFileChange} 
                  className="hidden"
                  ref={fileInputRef}
                />
                {media && mediaType?.startsWith('video/') && <p className="text-xs mt-1 text-muted-foreground">Video seçildi.</p>}
              </div>
            </div>
          )}
          
          {selectedMediaType === 'url' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="mediaUrl" className="text-right">
                Medya URL
              </Label>
              <div className="col-span-3 flex gap-2">
                <Input
                  id="mediaUrl"
                  type="url"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://example.com/image.png"
                  className="flex-grow"
                  disabled={isProcessing}
                />
                <Button type="button" onClick={handleAddMediaUrl} variant="outline" disabled={isProcessing || !mediaUrl.trim()}>
                  <Link2 className="mr-2 h-4 w-4" /> Ekle
                </Button>
              </div>
               {media && mediaType === 'url' && <p className="col-start-2 col-span-3 text-xs mt-1 text-muted-foreground">URL eklendi: {media}</p>}
            </div>
          )}


          {isProcessing && media && (mediaType?.startsWith('image/') || mediaType?.startsWith('video/')) && (
            <div className="col-span-4 flex justify-center items-center py-2">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <p className="text-sm text-muted-foreground">Medya işleniyor...</p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
              İptal
            </Button>
            <Button type="submit" disabled={isProcessing || (!title.trim() || !content.trim())}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yayınla
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

    
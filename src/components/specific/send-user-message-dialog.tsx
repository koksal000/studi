
// src/components/specific/send-user-message-dialog.tsx
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send } from 'lucide-react';
import type { UserProfile } from '@/hooks/use-users';

interface SendUserMessageDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  userToMessage: UserProfile | null;
}

type MessageType = 'normal' | 'uyari' | 'iyi';

export function SendUserMessageDialog({ isOpen, onOpenChange, userToMessage }: SendUserMessageDialogProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('normal');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setMessage('');
      setMessageType('normal');
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isSending) return;
    onOpenChange(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!userToMessage || !message.trim()) {
      toast({
        title: 'Eksik Bilgi',
        description: 'Lütfen göndermek için bir mesaj yazın.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/fcm/send-direct-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userToMessage.id,
          message: message.trim(),
          type: messageType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası.' }));
        throw new Error(errorData.message);
      }
      
      toast({
        title: 'Mesaj Gönderildi',
        description: `${userToMessage.name} adlı kullanıcıya bildirim başarıyla gönderildi.`,
      });
      handleClose();

    } catch (error: any) {
      console.error('Failed to send direct message:', error);
      toast({
        title: 'Gönderim Başarısız',
        description: error.message || 'Mesaj gönderilirken bir hata oluştu.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!userToMessage) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Kullanıcıya Mesaj Gönder</DialogTitle>
          <DialogDescription>
            <span className="font-semibold">{userToMessage.name} {userToMessage.surname}</span> adlı kullanıcıya tarayıcı bildirimi yoluyla bir mesaj gönderin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="message-type" className="text-right">
              Mesaj Türü
            </Label>
            <Select value={messageType} onValueChange={(value: MessageType) => setMessageType(value)} disabled={isSending}>
              <SelectTrigger className="col-span-3" id="message-type">
                <SelectValue placeholder="Mesaj türü seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="uyari">Uyarı</SelectItem>
                <SelectItem value="iyi">İyi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="message-content" className="text-right pt-2">
              Mesaj
            </Label>
            <Textarea
              id="message-content"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="col-span-3 min-h-[100px]"
              placeholder="Kullanıcıya gönderilecek mesajı buraya yazın..."
              required
              disabled={isSending}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSending}>
              İptal
            </Button>
            <Button type="submit" disabled={isSending || !message.trim()}>
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Bildirimi Gönder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

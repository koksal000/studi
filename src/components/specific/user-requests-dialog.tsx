
// src/components/specific/user-requests-dialog.tsx
"use client";

import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle as CardTitlePrimitive, CardDescription as CardDesc } from '@/components/ui/card'; // Renamed CardTitle to avoid conflict
import { useContactMessages } from '@/hooks/use-contact-messages';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, MessageSquare, User, CalendarDays, Inbox } from 'lucide-react';

interface UserRequestsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function UserRequestsDialog({ isOpen, onOpenChange }: UserRequestsDialogProps) {
  const { messages, isLoading, refetchMessages } = useContactMessages();

  useEffect(() => {
    if (isOpen) {
      refetchMessages();
    }
  }, [isOpen, refetchMessages]);


  const formatMessageDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('tr-TR', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[90vw] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 sm:p-6 border-b flex-shrink-0">
          <DialogTitle className="text-xl sm:text-2xl flex items-center">
            <Inbox className="mr-2 h-6 w-6 text-primary" /> Kullanıcı İstekleri ve Mesajları
          </DialogTitle>
          <DialogDescription>
            İletişim formu üzerinden gönderilen tüm mesajlar.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-grow min-h-0 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-4">
            {isLoading && (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Mesajlar yükleniyor...</p>
              </div>
            )}
            {!isLoading && messages.length === 0 && (
              <div className="text-center py-10">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Henüz gönderilmiş bir mesaj bulunmamaktadır.</p>
              </div>
            )}
            {!isLoading && messages.length > 0 && (
              messages.map((msg) => (
                <Card key={msg.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                        <CardTitlePrimitive className="text-base sm:text-lg">{msg.subject}</CardTitlePrimitive>
                        <span className="text-xs font-normal text-muted-foreground flex items-center flex-shrink-0">
                            <CalendarDays className="mr-1 h-3.5 w-3.5" />
                            {formatMessageDate(msg.date)}
                        </span>
                    </div>
                    <CardDesc className="text-xs sm:text-sm pt-1">
                        <span className="flex items-center"><User className="mr-1.5 h-3.5 w-3.5 text-primary" />{msg.name}</span>
                        <span className="flex items-center mt-0.5"><Mail className="mr-1.5 h-3.5 w-3.5 text-primary" /><a href={`mailto:${msg.email}`} className="text-accent hover:underline">{msg.email}</a></span>
                    </CardDesc>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm text-foreground/90 bg-muted/50 p-3 rounded-md">{msg.message}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
        
        <div className="p-4 sm:p-6 border-t flex-shrink-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="w-full">Kapat</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

    
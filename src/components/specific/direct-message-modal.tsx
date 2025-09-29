
"use client";

import { useSettings } from '@/contexts/settings-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Info, MessageCircle, AlertTriangle } from 'lucide-react';

export function DirectMessageModal() {
  const { directMessage, setDirectMessage } = useSettings();

  if (!directMessage) {
    return null;
  }
  
  const getIconForTitle = (title: string) => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('uyarı')) {
        return <AlertTriangle className="h-6 w-6 text-yellow-500 mr-3" />;
    }
    if (lowerTitle.includes('bilgilendirme')) {
        return <Info className="h-6 w-6 text-blue-500 mr-3" />;
    }
    return <MessageCircle className="h-6 w-6 text-primary mr-3" />;
  }

  return (
    <Dialog open={!!directMessage} onOpenChange={(isOpen) => !isOpen && setDirectMessage(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            {getIconForTitle(directMessage.title)}
            {directMessage.title}
          </DialogTitle>
          <DialogDescription className="pt-2">
            Bu mesaj site yönetimi tarafından size gönderilmiştir.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 whitespace-pre-wrap text-sm text-foreground/90">
          {directMessage.body}
        </div>
        <DialogFooter>
          <Button onClick={() => setDirectMessage(null)}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

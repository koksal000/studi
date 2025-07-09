
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFirebaseMessaging } from "@/contexts/firebase-messaging-context";
import { useToast } from "@/hooks/use-toast";

interface NotificationPermissionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function NotificationPermissionDialog({ isOpen, onOpenChange }: NotificationPermissionDialogProps) {
  const { updateNotificationPreference, setHasModalBeenShown } = useFirebaseMessaging();
  const { toast } = useToast();

  const handlePermissionChoice = async (agreed: boolean) => {
    if (agreed) {
      toast({ title: "Bildirim İzni İsteniyor...", description: "Lütfen tarayıcınızın bildirim çubuğunu kontrol edin.", duration: 5000 });
      updateNotificationPreference(true);
    } else {
      updateNotificationPreference(false);
      toast({ title: "Bildirim İzni İstenmedi", description: "Bu ayarı daha sonra Ayarlar bölümünden değiştirebilirsiniz." });
    }
    setHasModalBeenShown(true);
    onOpenChange(false);
  };

  const handleDialogClose = (openState: boolean) => {
    if (!openState) {
      // If dialog is closed by clicking away or X, treat as "no" for now.
      setHasModalBeenShown(true); 
      updateNotificationPreference(false);
    }
    onOpenChange(openState);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleDialogClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bildirimlere İzin Verilsin mi?</AlertDialogTitle>
          <AlertDialogDescription>
            Yeni duyurular ve önemli gelişmeler hakkında anında bildirim almak için lütfen tarayıcı bildirimlerine izin verin. Bu ayarı daha sonra Ayarlar bölümünden değiştirebilirsiniz.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handlePermissionChoice(false)}>Hayır, Teşekkürler</AlertDialogCancel>
          <AlertDialogAction onClick={() => handlePermissionChoice(true)}>Evet, İzin Ver</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

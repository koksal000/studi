
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
import { Button } from "@/components/ui/button";
import { useFirebaseMessaging } from "@/contexts/firebase-messaging-context";
import { useToast } from "@/hooks/use-toast";

interface NotificationPermissionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function NotificationPermissionDialog({ isOpen, onOpenChange }: NotificationPermissionDialogProps) {
  const { requestPermission, setHasModalBeenShown, setUserPreference } = useFirebaseMessaging();
  const { toast } = useToast();

  const handlePermissionChoice = async (agreed: boolean) => {
    if (agreed) {
      toast({ title: "Bildirim İzni İsteniyor...", description: "Lütfen tarayıcınızın bildirim çubuğunu kontrol edin.", duration: 5000 });
      const { permission: browserPermissionAfterPrompt } = await requestPermission(); // This calls context.requestPermission
      
      // The context's requestPermission function now handles setting the userPreference based on browserPermissionAfterPrompt.
      if (browserPermissionAfterPrompt === 'granted') {
        toast({ title: "Bildirim İzni Verildi", description: "Yeni duyurulardan haberdar edileceksiniz." });
      } else if (browserPermissionAfterPrompt === 'denied') {
        toast({ title: "Bildirim İzni Reddedildi", description: "Bildirimler gösterilmeyecek. Ayarlardan değiştirebilirsiniz.", variant: "destructive" });
      } else { // 'default' or 'prompted_declined'
        toast({ title: "Bildirim İzni Beklemede", description: "Tarayıcınızdan izin vermeniz gerekebilir veya daha sonra ayarlardan deneyebilirsiniz." });
      }
    } else {
      setUserPreference('disabled'); // User explicitly said no to our dialog
      toast({ title: "Bildirim İzni İstenmedi", description: "Bildirimler gösterilmeyecek. Bu ayarı daha sonra Ayarlar bölümünden değiştirebilirsiniz." });
    }
    setHasModalBeenShown(true); // Mark modal as shown
    onOpenChange(false); // Close this dialog
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => {
      if (!open) { // If dialog is closed by clicking away or X, treat as "Hayır" for modal shown logic
        setHasModalBeenShown(true);
      }
      onOpenChange(open);
    }}>
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

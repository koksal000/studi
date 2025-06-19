
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
      const { permission } = await requestPermission();
      if (permission === 'granted') {
        // User preference is set to 'enabled' inside requestPermission
        toast({ title: "Bildirim İzni Verildi", description: "Yeni duyurulardan haberdar edileceksiniz." });
      } else if (permission === 'denied') {
        setUserPreference('disabled');
        toast({ title: "Bildirim İzni Reddedildi", description: "Bildirimler gösterilmeyecek." });
      } else {
        // Default or other states
        toast({ title: "Bildirim İzni Beklemede", description: "Tarayıcınızdan izin vermeniz gerekebilir." });
      }
    } else {
      setUserPreference('disabled'); // User explicitly said no
      toast({ title: "Bildirim İzni İstenmedi", description: "Bildirimler gösterilmeyecek." });
    }
    setHasModalBeenShown(true);
    onOpenChange(false);
    toast({
      title: "Ayar Bilgisi",
      description: "Bildirim ayarlarınızı daha sonra 'Ayarlar' bölümünden değiştirebilirsiniz.",
      duration: 7000,
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
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

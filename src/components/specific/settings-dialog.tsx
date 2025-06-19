
"use client";

import { useSettings } from '@/contexts/settings-context';
import { useUser } from '@/contexts/user-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch";
import { useToast } from '@/hooks/use-toast';
import { Moon, Sun, Laptop, Bell, BellOff, BellPlus, BellRing } from 'lucide-react';
import { VILLAGE_NAME } from '@/lib/constants';
import { useEffect, useState } from 'react';
import { useFirebaseMessaging } from '@/contexts/firebase-messaging-context'; // FCM context

interface SettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function SettingsDialog({ isOpen, onOpenChange }: SettingsDialogProps) {
  const { 
    currentTheme, 
    setAppTheme, 
  } = useSettings(); // siteNotificationsPreference removed from here
  const { user, logout } = useUser();
  const { toast } = useToast();

  const { 
    permissionStatus: fcmPermission, 
    requestPermission: requestFcmPermission,
    userPreference: fcmUserPreference,
    setUserPreference: setFcmUserPreference
  } = useFirebaseMessaging();

  // Local state for the FCM switch to provide immediate UI feedback
  const [localFcmPreference, setLocalFcmPreference] = useState(fcmUserPreference);

  useEffect(() => {
    // Sync local FCM preference switch with context/localStorage value when dialog opens or context changes
    setLocalFcmPreference(fcmUserPreference);
  }, [fcmUserPreference, isOpen]);


  const handleFcmSwitchChange = async (checked: boolean) => {
    setLocalFcmPreference(checked ? 'enabled' : 'disabled'); // Update local UI state first
    
    if (checked) { // User wants to enable
      if (fcmPermission === 'default' || fcmPermission === 'denied' || fcmPermission === 'prompted_declined') {
        // If permission is default or was previously denied by user (not browser hard-deny), re-request
        const { permission: newPermission } = await requestFcmPermission();
        if (newPermission === 'granted') {
          // User preference is updated to 'enabled' inside requestPermission
           toast({ title: "FCM Bildirimleri Etkinleştirildi", description: "Artık anlık bildirim alacaksınız."});
        } else if (newPermission === 'denied') {
           setFcmUserPreference('disabled'); // Persist this explicit denial
           setLocalFcmPreference('disabled'); // Revert switch if browser denied
           toast({ title: "FCM Bildirim İzni Reddedildi", description: "Tarayıcı tarafından izin verilmedi.", variant: "destructive"});
        } else { // default
           toast({ title: "FCM Bildirim İzni Beklemede", description: "Tarayıcınızın bildirim çubuğundan izin vermeniz gerekebilir."});
        }
      } else if (fcmPermission === 'granted') {
        // Permission already granted, just update preference if it was 'disabled'
        setFcmUserPreference('enabled');
        toast({ title: "FCM Bildirimleri Etkin", description: "Bildirimler zaten etkin."});
      }
    } else { // User wants to disable
      setFcmUserPreference('disabled');
      toast({ title: "FCM Bildirimleri Devre Dışı Bırakıldı", description: "Artık anlık bildirim almayacaksınız."});
    }
  };
  
  const handleSaveSettings = () => {
    // Theme is saved by next-themes automatically.
    // FCM preference is saved by handleFcmSwitchChange already.
    // This function is mainly to close the dialog and provide unified feedback.
    toast({
      title: "Ayarlar Kaydedildi",
      description: "Tercihleriniz güncellendi.",
    });
    onOpenChange(false);
  };

  const getFcmStatusIcon = () => {
    if (localFcmPreference === 'enabled' && fcmPermission === 'granted') return <BellRing className="h-5 w-5 text-green-500" />;
    if (localFcmPreference === 'enabled' && (fcmPermission === 'default' || fcmPermission === 'prompted_declined')) return <BellPlus className="h-5 w-5 text-yellow-500" />;
    return <BellOff className="h-5 w-5 text-muted-foreground" />;
  };

  const getFcmStatusText = () => {
    if (localFcmPreference === 'enabled') {
      if (fcmPermission === 'granted') return "Anlık bildirimler etkin.";
      if (fcmPermission === 'default' || fcmPermission === 'prompted_declined') return "İzin bekleniyor/yeniden istenebilir.";
      if (fcmPermission === 'denied') return "Tarayıcı tarafından engellendi.";
      if (fcmPermission === 'not_supported') return "Tarayıcı desteklemiyor.";
    }
    return "Anlık bildirimler devre dışı.";
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Site Ayarları</DialogTitle>
          <DialogDescription>
            Site görünümünü ve bildirim tercihlerini buradan yönetebilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-3">
            <Label className="text-base font-medium">Tema Seçimi</Label>
            <RadioGroup
              value={currentTheme || "system"}
              onValueChange={(value) => setAppTheme(value)}
              className="flex space-x-2 sm:space-x-0 sm:grid sm:grid-cols-3 gap-2"
            >
              <Label htmlFor="theme-light" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer">
                <RadioGroupItem value="light" id="theme-light" className="sr-only" />
                <Sun className="mb-3 h-6 w-6" />
                Açık Tema
              </Label>
              <Label htmlFor="theme-dark" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer">
                <RadioGroupItem value="dark" id="theme-dark" className="sr-only" />
                <Moon className="mb-3 h-6 w-6" />
                Koyu Tema
              </Label>
              <Label htmlFor="theme-system" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer">
                <RadioGroupItem value="system" id="theme-system" className="sr-only" />
                <Laptop className="mb-3 h-6 w-6" />
                Sistem
              </Label>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Anlık Bildirimler (FCM)</Label>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center space-x-2">
                {getFcmStatusIcon()}
                <span className="text-sm">
                  {getFcmStatusText()}
                </span>
              </div>
              <Switch
                id="fcm-notifications-switch"
                checked={localFcmPreference === 'enabled'}
                onCheckedChange={handleFcmSwitchChange}
                disabled={fcmPermission === 'denied' || fcmPermission === 'not_supported'}
                aria-label="Firebase anlık bildirimlerini aç/kapat"
              />
            </div>
             <p className="text-xs text-muted-foreground px-1">
                Anlık bildirimler (Firebase Cloud Messaging ile), yeni duyurular geldiğinde uygulama kapalıyken veya arka plandayken bile sizi uyarır. Tarayıcınızdan ayrıca izin vermeniz gerekebilir.
            </p>
            {fcmPermission === 'denied' && <p className="text-xs text-destructive px-1">Tarayıcı bildirimleri engellenmiş. Etkinleştirmek için tarayıcı ayarlarınızı kontrol edin.</p>}
            {fcmPermission === 'not_supported' && <p className="text-xs text-destructive px-1">Bu tarayıcı anlık bildirimleri desteklemiyor.</p>}
          </div>
          
          {user && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Kullanıcı Bilgileri</Label>
              <div className="flex items-center justify-between rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Giriş yapan: {user.name} {user.surname}</p>
                  <Button variant="outline" size="sm" onClick={() => { logout(); onOpenChange(false); }}>Çıkış Yap</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
             <Label className="text-base font-medium">Hakkında</Label>
             <p className="text-sm text-muted-foreground">{VILLAGE_NAME} Portalı v1.0</p>
             <p className="text-xs text-muted-foreground">Bu site, {VILLAGE_NAME}'nün resmi web sitesidir.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Kapat</Button>
          <Button onClick={handleSaveSettings}>Değişiklikleri Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

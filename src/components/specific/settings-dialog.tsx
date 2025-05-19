
"use client";

import { useSettings } from '@/contexts/settings-context';
import { useUser } from '@/contexts/user-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from '@/hooks/use-toast';
import { Moon, Sun, Laptop } from 'lucide-react';
import { VILLAGE_NAME } from '@/lib/constants';

interface SettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function SettingsDialog({ isOpen, onOpenChange }: SettingsDialogProps) {
  const { notificationsEnabled, setNotificationsPreference, currentTheme, setAppTheme } = useSettings();
  const { user, logout } = useUser();
  const { toast } = useToast();

  const handleSaveSettings = () => {
    // Theme and notification preferences are saved as they are changed.
    // This button mainly serves to close the dialog now.
    toast({
      title: "Ayarlar Kaydedildi",
      description: "Tercihleriniz güncellendi.",
    });
    onOpenChange(false);
  };

  const handleNotificationSwitchChange = async (checked: boolean) => {
    if (typeof window !== 'undefined' && !window.Notification) {
      toast({
        title: "Desteklenmiyor",
        description: "Tarayıcınız bildirimleri desteklemiyor.",
        variant: "destructive",
      });
      setNotificationsPreference(false);
      return;
    }

    if (checked) { // User wants to enable notifications
      if (Notification.permission === 'granted') {
        setNotificationsPreference(true);
        toast({ title: "Bildirimler Aktif", description: "Yeni duyurular için bildirim alacaksınız." });
      } else if (Notification.permission === 'denied') {
        toast({ title: "İzin Gerekli", description: "Bildirim almak için lütfen tarayıcı ayarlarınızdan bu siteye bildirim izni verin. Sayfayı yeniledikten sonra tekrar deneyebilirsiniz.", variant: 'destructive', duration: 7000 });
        setNotificationsPreference(false); // Ensure preference is false if permission denied
      } else { // 'default' permission
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setNotificationsPreference(true);
          toast({ title: "Bildirimler Aktif", description: "Yeni duyurular için bildirim alacaksınız." });
        } else {
          setNotificationsPreference(false);
          toast({ title: "İzin Reddedildi", description: "Bildirim izni verilmedi.", variant: 'destructive' });
        }
      }
    } else { // User wants to disable notifications
      setNotificationsPreference(false);
      toast({ title: "Bildirimler Kapatıldı", description: "Artık yeni duyurular için bildirim almayacaksınız." });
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Site Ayarları</DialogTitle>
          <DialogDescription>
            Site görünümünü ve bildirim tercihlerinizi buradan yönetebilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-3">
            <Label className="text-base font-medium">Tema Seçimi</Label>
            <RadioGroup
              defaultValue={currentTheme || "system"}
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
            <Label className="text-base font-medium">Bildirim Ayarları</Label>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <Label htmlFor="notificationsEnabledSwitch" className="flex flex-col space-y-1">
                <span>Duyuru Bildirimleri</span>
                <span className="font-normal leading-snug text-muted-foreground">
                  Yeni duyurular için bildirim al.
                </span>
              </Label>
              <Switch
                id="notificationsEnabledSwitch"
                checked={notificationsEnabled}
                onCheckedChange={handleNotificationSwitchChange}
              />
            </div>
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

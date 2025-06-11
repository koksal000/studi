
"use client";

import { useSettings } from '@/contexts/settings-context';
import { useUser } from '@/contexts/user-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"; // Switch eklendi
import { useToast } from '@/hooks/use-toast';
import { Moon, Sun, Laptop, Bell, BellOff } from 'lucide-react'; // Bell ikonları eklendi
import { VILLAGE_NAME } from '@/lib/constants';
import { useEffect, useState } from 'react'; // useState eklendi


interface SettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function SettingsDialog({ isOpen, onOpenChange }: SettingsDialogProps) {
  const { 
    currentTheme, 
    setAppTheme, 
    siteNotificationsPreference, 
    setSiteNotificationsPreference 
  } = useSettings();
  const { user, logout } = useUser();
  const { toast } = useToast();

  // Local state for the switch to immediately reflect changes
  const [localNotificationsEnabled, setLocalNotificationsEnabled] = useState(siteNotificationsPreference);

  useEffect(() => {
    // Sync local state if the context value changes (e.g., on initial load)
    setLocalNotificationsEnabled(siteNotificationsPreference);
  }, [siteNotificationsPreference]);

  const handleNotificationSwitchChange = (checked: boolean) => {
    setLocalNotificationsEnabled(checked); // Update local state immediately
    // The actual preference is set in context on save
  };

  const handleSaveSettings = () => {
    setSiteNotificationsPreference(localNotificationsEnabled); // Save the local state to context
    toast({
      title: "Ayarlar Kaydedildi",
      description: "Tercihleriniz güncellendi.",
    });
    onOpenChange(false);
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
              value={currentTheme || "system"} // value prop'u eklendi
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
            <Label className="text-base font-medium">Site Bildirimleri</Label>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center space-x-2">
                {localNotificationsEnabled ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
                <span className="text-sm">
                  Yeni duyurular için tarayıcı bildirimlerini {localNotificationsEnabled ? 'açık' : 'kapalı'}.
                </span>
              </div>
              <Switch
                id="site-notifications-switch"
                checked={localNotificationsEnabled}
                onCheckedChange={handleNotificationSwitchChange}
                aria-label="Site bildirimlerini aç/kapat"
              />
            </div>
             <p className="text-xs text-muted-foreground px-1">
                Tarayıcı bildirimleri, site açıkken yeni duyurular geldiğinde küçük bir uyarı gösterir. Tarayıcınızdan ayrıca izin vermeniz gerekebilir.
            </p>
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

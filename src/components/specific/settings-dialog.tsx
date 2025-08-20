
"use client";

import { useSettings } from '@/contexts/settings-context';
import { useUser } from '@/contexts/user-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/hooks/use-toast';
import { Moon, Sun, Laptop } from 'lucide-react';
import { VILLAGE_NAME } from '@/lib/constants';

interface SettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function SettingsDialog({ isOpen, onOpenChange }: SettingsDialogProps) {
  const { currentTheme, setAppTheme } = useSettings(); 
  const { user, logout } = useUser();
  const { toast } = useToast();

  const handleSaveSettings = () => {
    toast({
      title: "Ayarlar Kaydedildi",
      description: "Tercihleriniz güncellendi.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b flex-shrink-0">
          <DialogTitle>Site Ayarları</DialogTitle>
          <DialogDescription>
            Site görünümünü ve bildirim tercihlerinizi buradan yönetebilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow min-h-0 overflow-y-auto">
            <div className="grid gap-6 p-4 sm:p-6">
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
                
                {user && (
                    <div className="space-y-3">
                    <Label className="text-base font-medium">Kullanıcı Bilgileri</Label>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Giriş yapan: {user.name} {user.surname}</p>
                            <p className="text-xs text-muted-foreground">E-posta: {user.email}</p>
                        </div>
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
        </div>
        <DialogFooter className="p-4 sm:p-6 border-t flex-shrink-0">
          <Button onClick={handleSaveSettings}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

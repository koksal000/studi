
"use client";

import { useSettings } from '@/contexts/settings-context';
import { useUser } from '@/contexts/user-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/hooks/use-toast';
import { Moon, Sun, Laptop, Loader2, Trash2 } from 'lucide-react';
import { VILLAGE_NAME } from '@/lib/constants';
import { useState, useEffect, type FormEvent } from 'react';

interface SettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function SettingsDialog({ isOpen, onOpenChange }: SettingsDialogProps) {
  const { currentTheme, setAppTheme } = useSettings(); 
  const { user, logout, updateUserProfile } = useUser();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setSurname(user.surname);
      setEmail(user.email || '');
    }
  }, [user, isOpen]);

  const handleProfileUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    
    try {
      await updateUserProfile({ name, surname, email: email.trim() === '' ? null : email.trim() });
      toast({
        title: "Profil Güncellendi",
        description: "Bilgileriniz başarıyla kaydedildi.",
      });
    } catch (error: any) {
      toast({
        title: "Güncelleme Başarısız",
        description: error.message || "Profiliniz güncellenirken bir hata oluştu.",
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleRemoveEmail = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateUserProfile({ email: null });
      setEmail('');
      toast({
        title: "E-posta Kaldırıldı",
        description: "E-posta adresiniz profilinizden kaldırıldı.",
      });
    } catch (error: any) {
       toast({ title: "İşlem Başarısız", variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b flex-shrink-0">
          <DialogTitle>Site Ayarları</DialogTitle>
          <DialogDescription>
            Kullanıcı bilgilerinizi, site görünümünü ve diğer tercihlerinizi buradan yönetin.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow min-h-0 overflow-y-auto">
            <div className="grid gap-6 p-4 sm:p-6">
                
                {user && (
                    <form onSubmit={handleProfileUpdate} className="space-y-4">
                      <Label className="text-base font-medium">Kullanıcı Bilgileri</Label>
                       <div className="space-y-2">
                          <Label htmlFor="settings-name">Ad</Label>
                          <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isSaving} />
                       </div>
                       <div className="space-y-2">
                          <Label htmlFor="settings-surname">Soyad</Label>
                          <Input id="settings-surname" value={surname} onChange={(e) => setSurname(e.target.value)} required disabled={isSaving} />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="settings-email">E-posta (İsteğe Bağlı)</Label>
                         <div className="flex items-center gap-2">
                           <Input id="settings-email" type="email" placeholder="E-posta adresiniz" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isSaving} />
                           {email && (
                             <Button type="button" variant="ghost" size="icon" onClick={handleRemoveEmail} disabled={isSaving} title="E-postayı Sil">
                               <Trash2 className="h-4 w-4 text-destructive" />
                             </Button>
                           )}
                         </div>
                         <p className="text-xs text-muted-foreground">İletişim mesajlarınıza yanıt alabilmek için e-posta ekleyebilirsiniz.</p>
                       </div>
                       <Button type="submit" disabled={isSaving}>
                         {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                         Bilgileri Kaydet
                       </Button>
                    </form>
                )}

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
                  <div className="space-y-3 pt-4 border-t">
                    <Label className="text-base font-medium">Oturumu Kapat</Label>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">Tüm cihazlardan çıkış yapın.</p>
                      <Button variant="destructive" size="sm" onClick={() => { logout(); onOpenChange(false); }}>Çıkış Yap</Button>
                    </div>
                  </div>
                )}
            </div>
        </div>
        <DialogFooter className="p-4 sm:p-6 border-t flex-shrink-0">
          <Button onClick={() => onOpenChange(false)}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

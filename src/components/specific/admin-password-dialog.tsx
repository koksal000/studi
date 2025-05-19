
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import { useUser } from '@/contexts/user-context';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface AdminPasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onVerified: () => void;
}

export function AdminPasswordDialog({ isOpen, onOpenChange, onVerified }: AdminPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { checkAdminPassword } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setPassword(''); // Reset password on open
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    const isAdmin = checkAdminPassword(password);

    if (isAdmin) {
      toast({
        title: 'Başarılı',
        description: 'Yönetici olarak doğrulandınız.',
      });
      onVerified();
      onOpenChange(false); // Close dialog on success
    } else {
      toast({
        title: 'Hata',
        description: 'Girilen şifre yanlış. Lütfen tekrar deneyin.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Yönetici Doğrulaması</DialogTitle>
          <DialogDescription>
            Bu işlemi gerçekleştirmek için lütfen yönetici şifresini girin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="admin-password" className="text-right">
                Şifre
              </Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="col-span-3"
                required
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading}>
                İptal
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading || !password.trim()}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Doğrula
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

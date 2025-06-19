
"use client";

import { useState, type FormEvent } from 'react';
import { useUser } from '@/contexts/user-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DISTRICT_NAME, VILLAGE_NAME } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

export function EntryForm() {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const { login, showEntryForm } = useUser();
  const { toast } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && surname.trim() && email.trim()) {
      login(name.trim(), surname.trim(), email.trim());
      
      try {
        const profileResponse = await fetch('/api/user-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), surname: surname.trim(), email: email.trim() }),
        });
        if (!profileResponse.ok) {
          const errorData = await profileResponse.json().catch(() => ({ message: 'Kullanıcı profili sunucuya kaydedilemedi.' }));
          console.warn("[EntryForm] Failed to save user profile to server:", errorData.message);
        } else {
          console.log("[EntryForm] User profile saved to server.");
        }

        await fetch('/api/stats/entry-count', { method: 'POST' });
        console.log("[EntryForm] Entry count increment request sent.");

      } catch (error) {
        console.error("[EntryForm] Error during post-login actions:", error);
      }
    } else {
      toast({
        title: "Eksik Bilgi",
        description: "Lütfen tüm alanları doldurun.",
        variant: "destructive"
      });
    }
  };

  if (!showEntryForm) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-[100] overflow-hidden">
        <video
          autoPlay
          loop
          muted={false} 
          playsInline 
          className="absolute top-0 left-0 w-full h-full object-cover" 
          src="https://files.catbox.moe/na9jph.mp4" 
        >
          Tarayıcınız video etiketini desteklemiyor.
        </video>

        <div className="absolute inset-0 bg-black/50"></div> 

        <div className="relative z-10 flex items-center justify-center h-full p-4">
          <Card className="w-full max-w-md shadow-2xl bg-transparent border border-white/20"> 
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-white">{VILLAGE_NAME}</CardTitle> 
              <CardDescription className="text-neutral-300">{DISTRICT_NAME}'in Merkez Köyü</CardDescription> 
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="userName" className="text-neutral-200">Adınız:</Label> 
                  <Input
                    id="userName"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="bg-white/10 border-white/30 text-white placeholder:text-neutral-400 focus:ring-primary focus:border-primary" 
                    placeholder="Adınızı girin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userSurname" className="text-neutral-200">Soyadınız:</Label> 
                  <Input
                    id="userSurname"
                    type="text"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    required
                    className="bg-white/10 border-white/30 text-white placeholder:text-neutral-400 focus:ring-primary focus:border-primary" 
                    placeholder="Soyadınızı girin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userEmail" className="text-neutral-200">E-posta Adresiniz:</Label> 
                  <Input
                    id="userEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white/10 border-white/30 text-white placeholder:text-neutral-400 focus:ring-primary focus:border-primary" 
                    placeholder="E-posta adresinizi girin"
                  />
                  <p className="text-xs text-neutral-300/80 pt-1">
                    E-posta adresiniz, sizinle iletişim kurmak ve siteye giriş için kullanılacaktır. Bu bilgiyi gizli tutuyoruz.
                  </p>
                </div>
                <Button type="submit" className="w-full text-lg py-3 bg-primary hover:bg-primary/90 text-primary-foreground">
                  Giriş Yap
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

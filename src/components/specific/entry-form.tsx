
"use client";

import { useState, type FormEvent } from 'react';
import { useUser } from '@/contexts/user-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DISTRICT_NAME, VILLAGE_NAME } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { Mail, Loader2 } from 'lucide-react';

export function EntryForm() {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const { login, showEntryForm, setShowEntryForm } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !surname.trim()) {
      toast({
        title: "Eksik Bilgi",
        description: "Lütfen adınızı ve soyadınızı doldurun.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await login(name.trim(), surname.trim(), email.trim() || null);
      // After login logic is complete, hide the form
      setShowEntryForm(false); 
    } catch (error) {
      console.error("Login failed:", error);
      toast({
        title: "Giriş Başarısız",
        description: "Giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
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
          muted={true}
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
                    disabled={isSubmitting}
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
                    disabled={isSubmitting}
                    className="bg-white/10 border-white/30 text-white placeholder:text-neutral-400 focus:ring-primary focus:border-primary" 
                    placeholder="Soyadınızı girin"
                  />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="userEmail" className="text-neutral-200 flex items-center justify-between">
                    <span>E-posta Adresiniz</span>
                    <span className="text-xs font-normal text-neutral-400">(İsteğe Bağlı)</span>
                  </Label> 
                  <Input
                    id="userEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="bg-white/10 border-white/30 text-white placeholder:text-neutral-400 focus:ring-primary focus:border-primary" 
                    placeholder="E-posta adresinizi girin"
                  />
                </div>
                <Button type="submit" className="w-full text-lg py-3 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Giriş Yap"}
                </Button>
                  <p className="text-xs text-neutral-300/80 pt-1 text-center">
                    Siteye giriş yaparak kullanım koşullarını kabul etmiş sayılırsınız.
                  </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

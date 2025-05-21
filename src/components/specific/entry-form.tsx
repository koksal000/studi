
"use client";

import { useState, type FormEvent } from 'react';
import { useUser } from '@/contexts/user-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DISTRICT_NAME, VILLAGE_NAME } from '@/lib/constants';

export function EntryForm() {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const { login, showEntryForm } = useUser();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && surname.trim()) {
      login(name.trim(), surname.trim());
    }
  };

  if (!showEntryForm) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      <video
        autoPlay
        loop
        muted={true} // Changed to true to enable autoplay
        playsInline // Important for iOS to play inline
        className="absolute top-0 left-0 w-full h-full object-cover" // Video as background
        src="https://files.catbox.moe/na9jph.mp4" // Updated video URL
      >
        Tarayıcınız video etiketini desteklemiyor.
      </video>

      {/* Overlay to dim the video and ensure text on card is readable */}
      <div className="absolute inset-0 bg-black/50"></div> {/* Removed backdrop-blur-sm, adjusted opacity */}

      {/* Centering container for the Card, must be on top of video and overlay */}
      <div className="relative z-10 flex items-center justify-center h-full p-4">
        <Card className="w-full max-w-md shadow-2xl bg-transparent border border-white/20"> {/* Made card transparent with a border */}
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-white">{VILLAGE_NAME}</CardTitle> {/* Changed text color */}
            <CardDescription className="text-neutral-300">{DISTRICT_NAME}'in Merkez Köyü</CardDescription> {/* Changed text color */}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="userName" className="text-neutral-200">Adınız:</Label> {/* Changed text color */}
                <Input
                  id="userName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-white/10 border-white/30 text-white placeholder:text-neutral-400 focus:ring-primary focus:border-primary" /* Styled for transparent bg */
                  placeholder="Adınızı girin"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userSurname" className="text-neutral-200">Soyadınız:</Label> {/* Changed text color */}
                <Input
                  id="userSurname"
                  type="text"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  required
                  className="bg-white/10 border-white/30 text-white placeholder:text-neutral-400 focus:ring-primary focus:border-primary" /* Styled for transparent bg */
                  placeholder="Soyadınızı girin"
                />
              </div>
              <Button type="submit" className="w-full text-lg py-3 bg-primary hover:bg-primary/90 text-primary-foreground">
                Giriş Yap
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


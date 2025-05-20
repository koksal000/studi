
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
        muted={false} // User requested "sesli" (audible). Browser policies might mute it or prevent autoplay with sound.
        playsInline // Important for iOS to play inline
        className="absolute top-0 left-0 w-full h-full object-cover" // Video as background
        src="https://files.catbox.moe/na9jph.mp4" // Updated video URL
      >
        Tarayıcınız video etiketini desteklemiyor.
      </video>

      {/* Overlay to dim the video and ensure text on card is readable */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

      {/* Centering container for the Card, must be on top of video and overlay */}
      <div className="relative z-10 flex items-center justify-center h-full p-4">
        <Card className="w-full max-w-md shadow-2xl bg-card"> {/* Ensure card has its own background for readability */}
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-primary">{VILLAGE_NAME}</CardTitle>
            <CardDescription className="text-muted-foreground">{DISTRICT_NAME}'in Merkez Köyü</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="userName" className="text-card-foreground">Adınız:</Label>
                <Input
                  id="userName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-input text-foreground"
                  placeholder="Adınızı girin"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userSurname" className="text-card-foreground">Soyadınız:</Label>
                <Input
                  id="userSurname"
                  type="text"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  required
                  className="bg-input text-foreground"
                  placeholder="Soyadınızı girin"
                />
              </div>
              <Button type="submit" className="w-full text-lg py-3">
                Giriş Yap
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

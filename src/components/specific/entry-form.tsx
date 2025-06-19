
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import { useUser } from '@/contexts/user-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DISTRICT_NAME, VILLAGE_NAME } from '@/lib/constants';
import { useFirebaseMessaging } from '@/contexts/firebase-messaging-context';
import { NotificationPermissionDialog } from './notification-permission-dialog';

export function EntryForm() {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const { login, showEntryForm } = useUser();
  const { 
    setShowPermissionModal, 
    hasModalBeenShown,
    isFcmLoading // Added to prevent modal from showing before FCM context is ready
  } = useFirebaseMessaging();
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && surname.trim()) {
      login(name.trim(), surname.trim());
      
      try {
        await fetch('/api/stats/entry-count', { method: 'POST' });
        console.log("Entry count increment request sent.");
      } catch (error) {
        console.error("Failed to send entry count increment request:", error);
      }
      
      // Show notification permission modal if not shown before and FCM is not loading
      if (!hasModalBeenShown && !isFcmLoading) {
        setIsNotificationModalOpen(true);
        setShowPermissionModal(true); // Also update context state if needed, though dialog has its own open state
      }
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
                <Button type="submit" className="w-full text-lg py-3 bg-primary hover:bg-primary/90 text-primary-foreground">
                  Giriş Yap
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      <NotificationPermissionDialog 
        isOpen={isNotificationModalOpen} 
        onOpenChange={setIsNotificationModalOpen} 
      />
    </>
  );
}

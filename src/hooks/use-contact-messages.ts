
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';
import { broadcastContactUpdate } from '@/lib/broadcast-channel';
import { getContactMessagesFromDB, cacheContactMessagesToDB } from '@/lib/idb';


export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  date: string;
}

export function useContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/contact');
      if (!response.ok) {
        throw new Error("Mesajlar sunucudan alınamadı.");
      }
      const data: ContactMessage[] = await response.json();

      if (data && data.length > 0) {
          setMessages(data);
          await cacheContactMessagesToDB(data);
      } else if (data && data.length === 0) {
          setMessages([]); // Set to empty if API returns empty
      } else {
          throw new Error('Sunucudan mesaj verisi alınamadı. Çevrimdışı veriler deneniyor.');
      }
    } catch (error: any) {
      console.warn("[useContactMessages] API fetch failed, falling back to IndexedDB.", error.message);
      const dbData = await getContactMessagesFromDB();
      if (dbData && dbData.length > 0) {
        setMessages(dbData);
        toast({ title: 'Çevrimdışı Mod', description: 'Mesajlar gösterilemiyor. En son kaydedilenler gösteriliyor.', variant: 'default', duration: 5000 });
      } else {
        toast({ title: 'Mesajlar Yüklenemedi', description: error.message, variant: 'destructive' });
        setMessages([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // Initial fetch is handled by refetch call in the dialog
  }, []);

  const addContactMessage = useCallback(async (newMessageData: Omit<ContactMessage, 'id' | 'date'>) => {
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMessageData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Mesaj gönderilirken sunucu hatası oluştu." }));
        throw new Error(errorData.message);
      }
      const savedMessage = await response.json();
      
      const newMessages = [...messages, savedMessage].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMessages(newMessages);
      await cacheContactMessagesToDB(newMessages);
      
      toast({
        title: "Mesajınız Gönderildi!",
        description: "En kısa sürede sizinle iletişime geçeceğiz.",
      });
      broadcastContactUpdate(); // Notify admin panels to refetch
    } catch (error: any) {
      toast({ title: "Mesaj Gönderilemedi", description: error.message, variant: "destructive" });
      throw error; // Re-throw to be caught by the form handler
    }
  }, [toast, messages]);
  
  // Listen for broadcasted updates
  useEffect(() => {
    const channel = new BroadcastChannel('contact_updates');
    const handleMessage = (event: MessageEvent) => {
        if (event.data === 'update') {
            fetchMessages();
        }
    };
    channel.addEventListener('message', handleMessage);

    return () => {
        channel.removeEventListener('message', handleMessage);
        channel.close();
    };
  }, [fetchMessages]);


  return { 
    messages,
    isLoading, 
    addContactMessage,
    refetchMessages: fetchMessages,
  };
}

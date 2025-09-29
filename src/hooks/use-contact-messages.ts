
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';
import { broadcastContactUpdate } from '@/lib/broadcast-channel';

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
    if (messages.length === 0) {
        setIsLoading(true);
    }
    try {
      const response = await fetch('/api/contact');
      if (!response.ok) {
        throw new Error("Mesajlar sunucudan alınamadı.");
      }
      const data: ContactMessage[] = await response.json();
      setMessages(data);
    } catch (error: any) {
      toast({ title: 'Mesajlar Yüklenemedi', description: error.message, variant: 'destructive' });
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast, messages.length]);

  useEffect(() => {
    // Initial fetch handled by refetch call in dialog
  }, []);

  const addContactMessage = useCallback(async (newMessageData: Omit<ContactMessage, 'id' | 'date'>) => {
    // No optimistic update for contact form as the user navigates away/clears form.
    // The main benefit is for the admin panel to update.
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
      toast({
        title: "Mesajınız Gönderildi!",
        description: "En kısa sürede sizinle iletişime geçeceğiz.",
      });
      broadcastContactUpdate(); // Notify admin panels to refetch
    } catch (error: any) {
      toast({ title: "Mesaj Gönderilemedi", description: error.message, variant: "destructive" });
      throw error; // Re-throw to be caught by the form handler
    }
  }, [toast]);
  
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

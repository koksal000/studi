
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';

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
      setMessages(data);
    } catch (error: any) {
      toast({ title: 'Mesajlar Yüklenemedi', description: error.message, variant: 'destructive' });
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // Initial fetch for admin panel
    // No need to fetch for regular users
  }, []);

  const addContactMessage = useCallback(async (newMessageData: Omit<ContactMessage, 'id' | 'date'>) => {
    const newMessage: ContactMessage = {
      ...newMessageData,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      date: new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMessage),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Mesaj gönderilirken sunucu hatası oluştu." }));
        throw new Error(errorData.message);
      }
      // Success toast is handled in the component
    } catch (error: any) {
      toast({ title: "Mesaj Gönderilemedi", description: error.message, variant: "destructive" });
      throw error; // Re-throw to be caught by the form handler
    }
  }, [toast]);

  return { 
    messages,
    isLoading, 
    addContactMessage,
    refetchMessages: fetchMessages,
  };
}

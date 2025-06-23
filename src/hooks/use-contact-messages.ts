
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { ContactMessage } from '@/app/api/contact/route';
import { useToast } from './use-toast';

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
    if (isLoading) {
        fetchMessages();
    }
  }, [isLoading, fetchMessages]);

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
        const errorData = await response.json().catch(() => ({ message: "Sunucu hatası" }));
        throw new Error(errorData.message);
      }
      
    } catch (error: any) {
      const rawErrorMessage = error.message || 'Bilinmeyen bir sunucu hatası oluştu.';
      toast({ title: "Mesaj Gönderilemedi", description: rawErrorMessage, variant: "destructive" });

      const sanitizedError = new Error(String(rawErrorMessage).replace(/[^\x00-\x7F]/g, ""));
      sanitizedError.stack = error.stack;
      throw sanitizedError;
    }
  }, [toast]);

  return { 
    messages,
    isLoading, 
    addContactMessage,
    refetchMessages: fetchMessages,
  };
}

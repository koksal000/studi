
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
    fetchMessages();
  }, [fetchMessages]);

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
      
      // No need to refetch here as only admins see the list, and they don't send messages.
      // If admins could send messages, we would call fetchMessages() here.

    } catch (error: any) {
      toast({ title: "Mesaj Gönderilemedi", description: error.message, variant: "destructive" });
      throw error;
    }
  }, [toast]);

  return { 
    messages,
    isLoading, 
    addContactMessage,
    refetchMessages: fetchMessages, // Expose refetch for admin panel if needed
  };
}

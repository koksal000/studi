
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from './use-toast';
import { STORES, idbGetAll, idbSetAll } from '@/lib/idb';

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
  const isSyncing = useRef(false);

  const syncWithServer = useCallback(async () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    
    try {
      const response = await fetch('/api/contact');
      if (!response.ok) throw new Error('Mesajlar sunucudan alınamadı.');
      const serverData: ContactMessage[] = await response.json();
      setMessages(serverData);
      await idbSetAll(STORES.contactMessages, serverData);
    } catch (error: any) {
      toast({ title: 'Mesajlar Senkronize Edilemedi', description: error.message, variant: 'destructive' });
    } finally {
      isSyncing.current = false;
    }
  }, [toast]);
  
  const refetchMessages = useCallback(() => {
    setIsLoading(true);
    syncWithServer().finally(() => setIsLoading(false));
  }, [syncWithServer]);

  useEffect(() => {
    const loadFromCacheAndSync = async () => {
      setIsLoading(true);
      const cachedData = await idbGetAll<ContactMessage>(STORES.contactMessages);
      if (cachedData && cachedData.length > 0) {
        setMessages(cachedData);
      }
      setIsLoading(false);
      await syncWithServer();
    };

    loadFromCacheAndSync();
  }, [syncWithServer]);

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
      // No need to sync here for the user sending the message.
      // Admin will see it on their next sync/load.
    } catch (error: any) {
      const rawErrorMessage = error.message || 'Bilinmeyen bir sunucu hatası oluştu.';
      toast({ title: "Mesaj Gönderilemedi", description: rawErrorMessage, variant: "destructive" });
      throw new Error(String(rawErrorMessage).replace(/[^\x00-\x7F]/g, ""));
    }
  }, [toast]);

  return { 
    messages,
    isLoading, 
    addContactMessage,
    refetchMessages,
  };
}

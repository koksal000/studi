
"use client";

import { useState, useEffect, useCallback } from 'react';
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

let contactChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && window.BroadcastChannel) {
  contactChannel = new BroadcastChannel('contact-messages-channel');
}

export function useContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const syncWithServer = useCallback(async () => {
    try {
      const response = await fetch('/api/contact');
      if (!response.ok) throw new Error('Mesajlar sunucudan alınamadı.');
      const serverData: ContactMessage[] = await response.json();
      await idbSetAll(STORES.contactMessages, serverData);
      contactChannel?.postMessage('update');
      return serverData;
    } catch (error: any) {
      console.error("[useContactMessages] Sync with server failed:", error.message);
      return null;
    }
  }, []);

  const refetchMessages = useCallback(() => {
      setIsLoading(true);
      syncWithServer().finally(() => setIsLoading(false));
  }, [syncWithServer]);

  useEffect(() => {
    const refreshFromIdb = () => {
      idbGetAll<ContactMessage>(STORES.contactMessages).then(data => {
        if (data) setMessages(data);
      });
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'update') {
        refreshFromIdb();
      }
    };

    contactChannel?.addEventListener('message', handleMessage);

    setIsLoading(true);
    idbGetAll<ContactMessage>(STORES.contactMessages).then((cachedData) => {
      if (cachedData && cachedData.length > 0) {
        setMessages(cachedData);
      }
      // Initial sync for admins to get latest messages.
      syncWithServer();
    }).finally(() => setIsLoading(false));

    return () => {
      contactChannel?.removeEventListener('message', handleMessage);
    };
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
      // Notify admin panel if open
      syncWithServer();
    } catch (error: any) {
      toast({ title: "Mesaj Gönderilemedi", description: error.message, variant: "destructive" });
      throw new Error(String(error.message).replace(/[^\x00-\x7F]/g, ""));
    }
  }, [toast, syncWithServer]);

  return { 
    messages,
    isLoading, 
    addContactMessage,
    refetchMessages,
  };
}

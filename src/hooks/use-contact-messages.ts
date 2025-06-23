
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ContactMessage } from '@/app/api/contact/route';
import { useToast } from './use-toast';
import { idbGet, idbSet, STORES } from '@/lib/idb';

const MESSAGES_KEY = 'all-contact-messages';

export function useContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      try {
        const cachedMessages = await idbGet<ContactMessage[]>(STORES.CONTACT_MESSAGES, MESSAGES_KEY);
        if (cachedMessages && Array.isArray(cachedMessages)) {
            setMessages(cachedMessages);
        }
      } catch (e) {
          console.warn("Could not load contact messages from IndexedDB:", e);
      }
      // SSE will handle setting loading to false
    }

    loadInitialData();

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const newEventSource = new EventSource('/api/contact/stream');
    eventSourceRef.current = newEventSource;

    newEventSource.onmessage = (event) => {
      try {
        const updatedMessages: ContactMessage[] = JSON.parse(event.data);
        const sortedMessages = updatedMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setMessages(sortedMessages);
        idbSet(STORES.CONTACT_MESSAGES, MESSAGES_KEY, sortedMessages).catch(e => console.error("Failed to cache contact messages in IndexedDB", e));
      } catch (error) {
        console.error("Error processing SSE message for contact messages:", error);
      } finally {
         if (isLoading) setIsLoading(false);
      }
    };

    newEventSource.onerror = (error) => {
        console.error("[SSE Contact] Connection error:", error);
        if (isLoading) setIsLoading(false);
    };

    return () => {
      if (newEventSource) newEventSource.close();
      eventSourceRef.current = null;
    };
  }, [isLoading]);

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
        toast({ title: "Mesaj Gönderilemedi", description: errorData.message || "Sunucu hatası oluştu.", variant: "destructive" });
        throw new Error(errorData.message || "Mesaj sunucuya gönderilemedi.");
      }
      // UI will update via SSE
    } catch (error) {
      console.error("Error submitting contact message:", error);
      if (error instanceof Error && !error.message.includes("sunucuya gönderilemedi")) {
         toast({ title: "Mesaj Gönderilemedi", description: error.message || "Ağ hatası veya beklenmedik bir sorun oluştu.", variant: "destructive" });
      }
      throw error;
    }
  }, [toast]);

  return { messages, isLoading, addContactMessage };
}

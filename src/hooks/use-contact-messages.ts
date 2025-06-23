
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { ContactMessage } from '@/app/api/contact/route';
import { useToast } from './use-toast';
import { idbGet, idbSet, STORES } from '@/lib/idb';

const MESSAGES_KEY = 'all-contact-messages';

export function useContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[] | null>(null);
  const { toast } = useToast();
  
  const isLoading = messages === null;
  
  useEffect(() => {
    let isMounted = true;
    
    // 1. Attempt to load from cache first for instant UI
    idbGet<ContactMessage[]>(STORES.CONTACT_MESSAGES, MESSAGES_KEY).then(cachedData => {
        if (isMounted && cachedData) {
            setMessages(cachedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }
    });

    // 2. Establish live SSE connection
    const eventSource = new EventSource('/api/contact/stream');

    eventSource.onmessage = (event) => {
        if(!isMounted) return;
        try {
            const serverData: ContactMessage[] = JSON.parse(event.data);
            const sortedData = serverData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            // Update state and cache
            setMessages(sortedData);
            idbSet(STORES.CONTACT_MESSAGES, MESSAGES_KEY, sortedData).catch(e => console.error("Failed to cache contact messages in IndexedDB", e));
        } catch (error) {
            console.error("Error processing SSE message for contact messages:", error);
        }
    };

    eventSource.onerror = (error) => {
        console.error("[SSE Contact] Connection error:", error);
        if (isMounted && messages === null) {
            setMessages([]); // If cache is empty and SSE fails, show "no messages" instead of loader
        }
        eventSource.close();
    };

    // 3. Cleanup on unmount
    return () => {
        isMounted = false;
        eventSource.close();
    };
  }, []); // <-- CRITICAL: Empty dependency array ensures this runs only once.


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
    } catch (error) {
      console.error("Error submitting contact message:", error);
      if (error instanceof Error && !error.message.includes("sunucuya gönderilemedi")) {
         toast({ title: "Mesaj Gönderilemedi", description: error.message || "Ağ hatası veya beklenmedik bir sorun oluştu.", variant: "destructive" });
      }
      throw error;
    }
  }, [toast]);

  return { 
    messages: messages ?? [],
    isLoading, 
    addContactMessage 
  };
}

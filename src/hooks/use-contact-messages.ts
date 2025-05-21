
// src/hooks/use-contact-messages.ts
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { ContactMessage } from '@/app/api/contact/route';

const MESSAGES_KEY = 'camlicaKoyuContactMessages_api_cache'; 

export function useContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchInitialMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/contact');
      if (!response.ok) {
        throw new Error('Failed to fetch contact messages');
      }
      const data: ContactMessage[] = await response.json();
      setMessages(data);
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to fetch initial contact messages:", error);
      toast({
        title: "Mesajlar Yüklenemedi",
        description: "Sunucudan iletişim mesajları alınırken bir sorun oluştu.",
        variant: "destructive"
      });
      const storedMessages = localStorage.getItem(MESSAGES_KEY);
      if (storedMessages) {
        try {
          setMessages(JSON.parse(storedMessages));
        } catch (e) { console.error("Failed to parse messages from localStorage", e); }
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchInitialMessages();
  }, [fetchInitialMessages]);

  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const newEventSource = new EventSource('/api/contact/stream');
    eventSourceRef.current = newEventSource;

    newEventSource.onmessage = (event) => {
      try {
        const updatedMessages: ContactMessage[] = JSON.parse(event.data);
        setMessages(updatedMessages);
        localStorage.setItem(MESSAGES_KEY, JSON.stringify(updatedMessages));
      } catch (error) {
          console.error("Error processing SSE message for contact messages:", error);
      }
    };

    newEventSource.onerror = (errorEvent: Event) => {
      const target = errorEvent.target as EventSource;
      const readyState = target?.readyState;
      const eventType = errorEvent.type || 'unknown';
      
      console.error(
        `SSE connection error for contact messages. EventSource readyState: ${readyState}, Event Type: ${eventType}, Event:`, errorEvent
      );
      
      if (readyState === EventSource.CLOSED) {
        toast({
          title: "İletişim Mesajları Bağlantısı Sonlandı",
          description: "Otomatik yeniden bağlanma denenecek. Sorun devam ederse sayfayı yenileyin.",
          variant: "destructive"
        });
      } else if (readyState === EventSource.CONNECTING) {
        // Connecting state, expected during retries.
      } else {
         toast({
          title: "İletişim Mesajları Bağlantı Hatası",
          description: "Mesaj güncellemelerinde bir hata oluştu. Yeniden deneniyor.",
          variant: "destructive"
        });
      }
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [toast]); 

  const getMessageById = useCallback((id: string): ContactMessage | undefined => {
    return messages.find(msg => msg.id === id);
  }, [messages]);

  return { messages, isLoading, getMessageById };
}

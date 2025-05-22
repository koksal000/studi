
// src/hooks/use-contact-messages.ts
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ContactMessage } from '@/app/api/contact/route';
import { useToast } from './use-toast';

export function useContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const initialDataLoadedRef = useRef(false);
  const { toast } = useToast();
  const messagesRef = useRef<ContactMessage[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setIsLoading(true);
    initialDataLoadedRef.current = false;

    fetch('/api/contact')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch initial contact messages: ${res.status}`);
        return res.json();
      })
      .then((data: ContactMessage[]) => {
        setMessages(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      })
      .catch(err => {
        console.error("[ContactMessages] Failed to fetch initial messages:", err);
      })
      .finally(() => {
        // SSE will handle final isLoading=false
      });

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const newEventSource = new EventSource('/api/contact/stream');
    eventSourceRef.current = newEventSource;

    newEventSource.onopen = () => {
      // console.log('[SSE Contact] Connection opened.');
    };

    newEventSource.onmessage = (event) => {
      try {
        const updatedMessages: ContactMessage[] = JSON.parse(event.data);
        setMessages(updatedMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } catch (error) {
        console.error("Error processing SSE message for contact messages:", error);
      } finally {
         if (!initialDataLoadedRef.current) {
            setIsLoading(false);
            initialDataLoadedRef.current = true;
        }
      }
    };

    newEventSource.onerror = (errorEvent: Event) => {
      const target = errorEvent.target as EventSource;
      if (eventSourceRef.current !== target) {
        return; // Error from an old EventSource instance
      }
      const readyState = target?.readyState;
      const eventType = errorEvent.type || 'unknown event type';

      if (readyState === EventSource.CLOSED) {
         console.warn(
          `[SSE Contact] Connection closed. EventSource readyState: ${readyState}, Event Type: ${eventType}. Browser will attempt to reconnect. Full Event:`, errorEvent
        );
      } else if (readyState === EventSource.CONNECTING) {
        console.warn(
          `[SSE Contact] Initial connection failed or connection attempt error. EventSource readyState: ${readyState}, Event Type: ${eventType}. Full Event:`, errorEvent,
          "This might be due to NEXT_PUBLIC_APP_URL not being set correctly in your deployment environment, or the stream API endpoint having issues."
        );
      }
      else {
        console.error(
          `[SSE Contact] Connection error. EventSource readyState: ${readyState}, Event Type: ${eventType}, Full Event:`, errorEvent
        );
      }
      if (!initialDataLoadedRef.current) {
        setIsLoading(false);
        initialDataLoadedRef.current = true;
      }
    };

    return () => {
      if (newEventSource) {
        newEventSource.close();
      }
      eventSourceRef.current = null;
    };
  }, [toast]); // Removed isLoading from dependencies

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


  const getMessageById = useCallback((id: string): ContactMessage | undefined => {
    return messagesRef.current.find(msg => msg.id === id);
  }, []);

  return { messages, isLoading, getMessageById, addContactMessage };
}

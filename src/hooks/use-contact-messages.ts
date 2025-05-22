
// src/hooks/use-contact-messages.ts
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ContactMessage } from '@/app/api/contact/route';
import { useToast } from './use-toast'; // Assuming useToast is available for error reporting

export function useContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const eventSourceRef = useRef<EventSource | null>(null);
  const initialDataLoadedRef = useRef(false);
  const { toast } = useToast();


  useEffect(() => {
    initialDataLoadedRef.current = false; 
    setIsLoading(true);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/contact/stream');
    eventSourceRef.current = es;

    es.onopen = () => {
      // console.log('[SSE Contact] Connection opened.');
    };

    es.onmessage = (event) => {
      try {
        const updatedMessages: ContactMessage[] = JSON.parse(event.data);
        setMessages(updatedMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        if (!initialDataLoadedRef.current) {
          setIsLoading(false);
          initialDataLoadedRef.current = true;
        }
      } catch (error) {
        console.error("Error processing SSE message for contact messages:", error);
        if (!initialDataLoadedRef.current) {
          setIsLoading(false);
          initialDataLoadedRef.current = true;
        }
      }
    };

    es.onerror = (errorEvent: Event) => {
      const target = errorEvent.target as EventSource;
      const readyState = target?.readyState;
      const eventType = errorEvent.type || 'unknown event type';

      if (readyState === EventSource.CLOSED) {
         console.warn(
          `[SSE Contact] Connection closed. EventSource readyState: ${readyState}, Event Type: ${eventType}. Browser will attempt to reconnect. Full Event:`, errorEvent
        );
      } else {
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
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const errorData = await response.json().catch(() => ({ message: "Sunucu hatası" }));
        toast({ title: "Mesaj Gönderilemedi", description: errorData.message || "Sunucu hatası oluştu.", variant: "destructive" });
        throw new Error(errorData.message || "Mesaj sunucuya gönderilemedi.");
      }
      // UI will update via SSE
    } catch (error) {
      console.error("Error submitting contact message:", error);
      // Toast is already shown if response was not ok
      if (error instanceof Error && !error.message.includes("sunucuya gönderilemedi")) {
         toast({ title: "Mesaj Gönderilemedi", description: error.message || "Ağ hatası veya beklenmedik bir sorun oluştu.", variant: "destructive" });
      }
      throw error; // Re-throw for the calling component
    }
  }, [toast]);


  const getMessageById = useCallback((id: string): ContactMessage | undefined => {
    return messages.find(msg => msg.id === id);
  }, [messages]);

  return { messages, isLoading, getMessageById, addContactMessage };
}

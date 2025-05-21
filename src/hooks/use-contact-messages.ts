
// src/hooks/use-contact-messages.ts
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ContactMessage } from '@/app/api/contact/route';

export function useContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Initialize to true
  const eventSourceRef = useRef<EventSource | null>(null);
  const initialDataLoadedRef = useRef(false); // To track if initial data is loaded

  useEffect(() => {
    // setIsLoading(true); // Already initialized by useState
    initialDataLoadedRef.current = false; // Reset for new connection attempts

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
        updatedMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setMessages(updatedMessages);
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

    newEventSource.onerror = (errorEvent: Event) => {
      const target = errorEvent.target as EventSource;
      const readyState = target?.readyState;
      const eventType = errorEvent.type || 'unknown event type';

      if (readyState === EventSource.CLOSED) {
         console.warn(
          `[SSE Contact] Connection closed by server or network error. EventSource readyState: ${readyState}, Event Type: ${eventType}. Browser will attempt to reconnect. Full Event:`, errorEvent
        );
      } else if (readyState === EventSource.CONNECTING && eventType === 'error') {
        console.warn(`[SSE Contact] Initial connection attempt failed or stream unavailable. EventSource readyState: ${readyState}, Event Type: ${eventType}. Browser will retry. Full Event:`, errorEvent);
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
      const es = eventSourceRef.current;
      if (es) {
        es.close();
        eventSourceRef.current = null;
      }
    };
  }, []); // Removed isLoading from dependencies

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
        console.error("Failed to submit contact message to server:", errorData.message);
        throw new Error(errorData.message || "Mesaj sunucuya gönderilemedi.");
      }
      // UI will update via SSE
    } catch (error) {
      console.error("Error submitting contact message:", error);
      throw error;
    }
  }, []);


  const getMessageById = useCallback((id: string): ContactMessage | undefined => {
    return messages.find(msg => msg.id === id);
  }, [messages]);

  return { messages, isLoading, getMessageById, addContactMessage };
}

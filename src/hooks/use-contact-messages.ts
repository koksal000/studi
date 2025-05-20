// src/hooks/use-contact-messages.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { ContactMessage } from '@/app/api/contact/route';

const MESSAGES_KEY = 'camlicaKoyuContactMessages_api_cache'; // Cache key for localStorage

export function useContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchInitialMessages = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/contact');
        if (!response.ok) {
          throw new Error('Failed to fetch contact messages');
        }
        const data: ContactMessage[] = await response.json();
        // API already sorts, but good to ensure client-side if needed
        // data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setMessages(data);
        localStorage.setItem(MESSAGES_KEY, JSON.stringify(data));
      } catch (error) {
        console.error("Failed to fetch initial contact messages:", error);
        toast({
          title: "Mesajlar Yüklenemedi",
          description: "Sunucudan iletişim mesajları alınırken bir sorun oluştu.",
          variant: "destructive"
        });
        // Try loading from localStorage as a fallback
        const storedMessages = localStorage.getItem(MESSAGES_KEY);
        if (storedMessages) {
          try {
            setMessages(JSON.parse(storedMessages));
          } catch (e) { console.error("Failed to parse messages from localStorage", e); }
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialMessages();
  }, [toast]);

  useEffect(() => {
    const eventSource = new EventSource('/api/contact/stream');

    eventSource.onmessage = (event) => {
      try {
        const updatedMessages: ContactMessage[] = JSON.parse(event.data);
        // API stream already sorts
        setMessages(updatedMessages);
        localStorage.setItem(MESSAGES_KEY, JSON.stringify(updatedMessages));
      } catch (error) {
          console.error("Error processing SSE message for contact messages:", error);
      }
    };

    eventSource.onerror = (errorEvent) => {
      console.error('SSE connection error for contact messages. EventSource readyState:', eventSource.readyState, 'Event:', errorEvent);
      // Consider if a toast is needed here, or if silent retry is better for admin panel context
      // For now, keeping it silent to avoid spam for admins if there's a persistent connection issue.
    };

    return () => {
      eventSource.close();
    };
  }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount

  const getMessageById = useCallback((id: string): ContactMessage | undefined => {
    return messages.find(msg => msg.id === id);
  }, [messages]);

  return { messages, isLoading, getMessageById };
}

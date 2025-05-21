
// src/hooks/use-contact-messages.ts
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ContactMessage } from '@/app/api/contact/route';
import { useUser } from '@/contexts/user-context'; // If needed for auth before POST
import { useToast } from '@/hooks/use-toast'; // If needed for notifications

const MESSAGES_LOCAL_STORAGE_KEY = 'camlicaKoyuContactMessages_localStorage';

export function useContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  // const { user } = useUser(); // Potentially for authenticating POST requests
  // const { toast } = useToast(); // For user feedback

  const loadMessagesFromLocalStorage = useCallback(() => {
    setIsLoading(true);
    try {
      const storedMessages = localStorage.getItem(MESSAGES_LOCAL_STORAGE_KEY);
      if (storedMessages) {
        const parsed = JSON.parse(storedMessages) as ContactMessage[];
        parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setMessages(parsed);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to load contact messages from localStorage:", error);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessagesFromLocalStorage();
  }, [loadMessagesFromLocalStorage]);

  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const newEventSource = new EventSource('/api/contact/stream');
    eventSourceRef.current = newEventSource;

    newEventSource.onmessage = (event) => {
      try {
        const updatedMessages: ContactMessage[] = JSON.parse(event.data);
        updatedMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setMessages(updatedMessages);
        localStorage.setItem(MESSAGES_LOCAL_STORAGE_KEY, JSON.stringify(updatedMessages));
      } catch (error) {
        console.error("Error processing SSE message for contact messages:", error);
      }
    };

    newEventSource.onerror = (errorEvent: Event) => {
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
    };

    return () => {
      const es = eventSourceRef.current;
      if (es) {
        es.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Add a function to allow submitting new messages
  // This function will also POST to the API to trigger SSE for other clients
  const addContactMessage = useCallback(async (newMessageData: Omit<ContactMessage, 'id' | 'date'>) => {
    // if (!user) { /* Optional: check if user is logged in */ }

    const newMessage: ContactMessage = {
      ...newMessageData,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      date: new Date().toISOString(),
    };

    setMessages(prev => {
      const updated = [newMessage, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      localStorage.setItem(MESSAGES_LOCAL_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMessage), // Send the full new message
      });
      if (!response.ok) {
        // Handle server error, potentially revert local change
        console.error("Failed to submit contact message to server");
      }
    } catch (error) {
      console.error("Error submitting contact message:", error);
      // Handle network error
    }
  }, []);


  const getMessageById = useCallback((id: string): ContactMessage | undefined => {
    return messages.find(msg => msg.id === id);
  }, [messages]);

  return { messages, isLoading, getMessageById, addContactMessage };
}

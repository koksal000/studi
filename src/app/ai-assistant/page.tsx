
"use client";

import { useState, type FormEvent, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Sparkles, User } from 'lucide-react';
import { camlicaAIChatbot, type CamlicaAIChatbotInput, type CamlicaAIChatbotOutput } from '@/ai/flows/camlica-ai-chatbot';
import { VILLAGE_NAME } from '@/lib/constants';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollableView = scrollAreaRef.current.querySelector('div > div'); // Target the inner scrollable div
      if (scrollableView) {
        scrollableView.scrollTop = scrollableView.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initial AI greeting message
    setMessages([
      { id: 'greeting', text: `Merhaba! Ben ${VILLAGE_NAME} yapay zeka asistanıyım. Köyümüzle ilgili merak ettiklerinizi bana sorabilirsiniz. Örneğin, "Köyün nüfusu kaçtır?" veya "Çamlıca'nın tarihi hakkında bilgi verir misin?" gibi sorular sorabilirsiniz.`, sender: 'ai' }
    ]);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const aiInput: CamlicaAIChatbotInput = { question: input };
      const aiResponse: CamlicaAIChatbotOutput = await camlicaAIChatbot(aiInput);
      
      const aiMessage: Message = { id: (Date.now() + 1).toString(), text: aiResponse.answer, sender: 'ai' };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("AI Assistant Error:", error);
      const errorMessage: Message = { id: (Date.now() + 1).toString(), text: 'Üzgünüm, bir sorun oluştu. Lütfen daha sonra tekrar deneyin.', sender: 'ai' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] content-page">
      <Card className="flex-grow flex flex-col shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center">
            <Sparkles className="mr-3 h-8 w-8" /> {VILLAGE_NAME} Yapay Zeka Asistanı
          </CardTitle>
          <CardDescription className="text-lg">
            Köyümüzle ilgili sorularınızı yanıtlamak için buradayım.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-grow p-4 sm:p-6" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={`chat-message ${msg.sender === 'user' ? 'user-message' : 'ai-message'}`}>
                  <div className="flex items-end gap-2 max-w-[85%]">
                    {msg.sender === 'ai' && (
                      <div className="flex-shrink-0 bg-accent text-accent-foreground rounded-full h-8 w-8 flex items-center justify-center shadow">
                        <Sparkles className="h-5 w-5" />
                      </div>
                    )}
                     <div className={`message-content shadow ${msg.sender === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-secondary text-secondary-foreground rounded-tl-none'}`}>
                      {msg.text}
                    </div>
                     {msg.sender === 'user' && (
                      <div className="flex-shrink-0 bg-muted text-muted-foreground rounded-full h-8 w-8 flex items-center justify-center shadow">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="border-t p-4 bg-background/80">
            <form onSubmit={handleSubmit} className="flex items-center gap-2 sm:gap-4">
              <Input
                type="text"
                placeholder="Sorunuzu yazın..."
                value={input}
                onChange={e => setInput(e.target.value)}
                className="flex-grow text-base"
                disabled={isLoading}
                aria-label="Kullanıcı sorusu"
              />
              <Button type="submit" disabled={isLoading || !input.trim()} className="px-4 py-2 text-base">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                <span className="ml-2 hidden sm:inline">Gönder</span>
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

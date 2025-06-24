
"use client";

import { useState, type FormEvent, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Sparkles, User, Lightbulb } from 'lucide-react';
import { camlicaAIChatbot, type CamlicaAIChatbotInput, type CamlicaAIChatbotOutput } from '@/ai/flows/camlica-ai-chatbot';
import { VILLAGE_NAME } from '@/lib/constants';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
}

const examplePrompts = [
    "Köyün nüfusu kaçtır?",
    "Çamlıca'nın tarihi hakkında bilgi ver.",
    "Köyün muhtarı kimdir?",
    "Hasan Çamı nedir?",
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollableView = scrollAreaRef.current.querySelector('div > div');
      if (scrollableView) {
        scrollableView.scrollTop = scrollableView.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  useEffect(() => {
    setMessages([
      { id: 'greeting', text: `Merhaba! Ben ${VILLAGE_NAME} yapay zeka asistanıyım. Köyümüzle ilgili merak ettiklerinizi bana sorabilirsiniz.`, sender: 'ai' }
    ]);
  }, []);

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    handleFormSubmitWithValue(prompt);
  };

  const handleFormSubmitWithValue = async (value: string) => {
    if (!value.trim() || isLoading) return;
    setHasStarted(true);
    const userMessage: Message = { id: Date.now().toString(), text: value, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const aiInput: CamlicaAIChatbotInput = { question: value };
      const aiResponse: CamlicaAIChatbotOutput = await camlicaAIChatbot(aiInput);
      
      const aiMessage: Message = { id: (Date.now() + 1).toString(), text: aiResponse.answer, sender: 'ai' };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("AI Assistant Error:", error);
      const errorMessage: Message = { id: (Date.now() + 1).toString(), text: 'Üzgünüm, bir sorun oluştu. Lütfen daha sonra tekrar deneyin veya farklı bir soru sorun.', sender: 'ai' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleFormSubmitWithValue(input);
  };
  
  return (
    <div className="flex justify-center items-start pt-8 h-full min-h-[calc(100vh-150px)] content-page">
      <Card className="w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl">
        <CardHeader className="border-b">
          <CardTitle className="text-2xl font-bold text-primary flex items-center gap-3">
            <Sparkles className="h-7 w-7" /> {VILLAGE_NAME} Yapay Zeka Asistanı
          </CardTitle>
          <CardDescription>
            Köyümüzle ilgili sorularınızı anında yanıtlayın.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-grow p-4 sm:p-6" ref={scrollAreaRef}>
            <div className="space-y-6">
              {messages.map(msg => (
                <div key={msg.id} className={`flex items-end gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.sender === 'ai' && (
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarImage src="https://files.catbox.moe/1sbjhr.jpg" alt="AI Avatar" />
                      <AvatarFallback><Sparkles /></AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-md ${msg.sender === 'user' ? 'bg-primary text-primary-foreground rounded-br-lg' : 'bg-muted rounded-bl-lg'}`}>
                    <p className="text-sm">{msg.text}</p>
                  </div>
                  {msg.sender === 'user' && (
                     <Avatar className="h-9 w-9 flex-shrink-0">
                       <AvatarFallback><User /></AvatarFallback>
                     </Avatar>
                  )}
                </div>
              ))}
              
              {isLoading && (
                 <div className="flex items-end gap-3 justify-start">
                    <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarImage src="https://files.catbox.moe/1sbjhr.jpg" alt="AI Avatar" />
                        <AvatarFallback><Sparkles /></AvatarFallback>
                    </Avatar>
                    <div className="max-w-[80%] rounded-2xl px-4 py-3 shadow-md bg-muted rounded-bl-lg flex items-center gap-2">
                        <span className="typing-dot"></span>
                        <span className="typing-dot animation-delay-200"></span>
                        <span className="typing-dot animation-delay-400"></span>
                    </div>
                 </div>
              )}
            </div>

            {!hasStarted && !isLoading && (
                <div className="text-center p-8 space-y-4">
                    <Lightbulb className="mx-auto h-10 w-10 text-yellow-400" />
                    <h3 className="font-semibold text-lg">Ne sormak istersiniz?</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {examplePrompts.map(prompt => (
                            <Button key={prompt} variant="outline" size="sm" onClick={() => handlePromptClick(prompt)}>
                                {prompt}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

          </ScrollArea>
          <div className="border-t p-4 bg-background/95">
            <form onSubmit={handleSubmit} className="flex items-center gap-2 sm:gap-4">
              <Input
                type="text"
                placeholder="Mesajınızı yazın..."
                value={input}
                onChange={e => setInput(e.target.value)}
                className="flex-grow text-base h-11"
                disabled={isLoading}
                aria-label="Kullanıcı sorusu"
              />
              <Button type="submit" disabled={isLoading || !input.trim()} size="lg">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                <span className="sr-only">Gönder</span>
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
      <style jsx>{`
        .typing-dot {
            width: 8px;
            height: 8px;
            background-color: hsl(var(--primary));
            border-radius: 50%;
            display: inline-block;
            animation: bounce 1.2s infinite ease-in-out both;
        }
        .animation-delay-200 {
            animation-delay: 0.2s;
        }
        .animation-delay-400 {
            animation-delay: 0.4s;
        }
        @keyframes bounce {
            0%, 80%, 100% {
                transform: scale(0);
            }
            40% {
                transform: scale(1.0);
            }
        }
      `}</style>
    </div>
  );
}

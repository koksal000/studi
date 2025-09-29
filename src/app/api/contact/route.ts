
// src/app/api/contact/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  date: string;
}

const dataDir = process.env.DATA_PATH || process.cwd();
const CONTACT_MESSAGES_FILE_PATH = path.join(dataDir, '_contact_messages.json');

const readMessagesFromFile = (): ContactMessage[] => {
  try {
    if (fs.existsSync(CONTACT_MESSAGES_FILE_PATH)) {
      const fileData = fs.readFileSync(CONTACT_MESSAGES_FILE_PATH, 'utf-8');
      if (fileData.trim() === '') {
        return [];
      }
      return (JSON.parse(fileData) as ContactMessage[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      return [];
    }
  } catch (error) {
    console.error("[API/Contact] Error reading contact_messages file:", error);
    return [];
  }
};

const writeMessagesToFile = (messages: ContactMessage[]): boolean => {
  try {
    const dir = path.dirname(CONTACT_MESSAGES_FILE_PATH);
    if (!fs.existsSync(dir) && process.env.DATA_PATH ){ 
      fs.mkdirSync(dir, { recursive: true });
    }
    const sortedData = [...messages].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    fs.writeFileSync(CONTACT_MESSAGES_FILE_PATH, JSON.stringify(sortedData, null, 2));
    return true;
  } catch (error) {
    console.error("[API/Contact] CRITICAL: Error saving contact messages to file:", error);
    return false;
  }
};

export async function GET() {
  const messages = readMessagesFromFile();
  return NextResponse.json(messages);
}

export async function POST(request: NextRequest) {
  let newMessage: Omit<ContactMessage, 'id' | 'date'>;
  try {
    newMessage = await request.json();
  } catch (error) {
    console.error("[API/Contact] POST Error: Invalid JSON payload.", error);
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  if (!newMessage.name || !newMessage.email || !newMessage.subject || !newMessage.message) {
    return NextResponse.json({ message: 'Invalid contact message payload. Missing required fields.' }, { status: 400 });
  }
  
  const messages = readMessagesFromFile();
  const finalNewMessage: ContactMessage = {
      ...newMessage,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      date: new Date().toISOString()
  };

  messages.unshift(finalNewMessage);
    
  if (writeMessagesToFile(messages)) {
    console.log(`[API/Contact] Message ${finalNewMessage.id} received and saved. Total: ${messages.length}`);
    return NextResponse.json(finalNewMessage, { status: 201 });
  } else {
    console.error(`[API/Contact] Failed to save message ${finalNewMessage.id} to file.`);
    return NextResponse.json({ message: "Sunucu hatası: İletişim mesajı kalıcı olarak kaydedilemedi." }, { status: 500 });
  }
}


// src/app/api/contact/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import contactEmitter from '@/lib/contact-emitter';
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

let contactMessagesData: ContactMessage[] = [];
let initialized = false;

const loadContactMessagesFromFile = () => {
  try {
    console.log(`[API/Contact] DATA_PATH used: ${dataDir}`);
    console.log(`[API/Contact] Attempting to load messages from: ${CONTACT_MESSAGES_FILE_PATH}`);
    if (fs.existsSync(CONTACT_MESSAGES_FILE_PATH)) {
      const fileData = fs.readFileSync(CONTACT_MESSAGES_FILE_PATH, 'utf-8');
      if (fileData.trim() === '') {
        contactMessagesData = [];
      } else {
        contactMessagesData = (JSON.parse(fileData) as ContactMessage[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
      console.log(`[API/Contact] Successfully loaded ${contactMessagesData.length} contact messages from file.`);
    } else {
      contactMessagesData = [];
      console.log(`[API/Contact] File ${CONTACT_MESSAGES_FILE_PATH} not found. Initializing with empty array and attempting to create the file.`);
      saveContactMessagesToFile(); 
    }
  } catch (error) {
    console.error("[API/Contact] Error loading contact_messages file:", error);
    contactMessagesData = [];
  }
};

const saveContactMessagesToFile = (): boolean => {
  try {
    const dir = path.dirname(CONTACT_MESSAGES_FILE_PATH);
    if (!fs.existsSync(dir) && process.env.DATA_PATH ){ 
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[API/Contact] Created directory for data: ${dir}`);
    }
    const sortedData = [...contactMessagesData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    fs.writeFileSync(CONTACT_MESSAGES_FILE_PATH, JSON.stringify(sortedData, null, 2));
    console.log(`[API/Contact] Contact messages data saved to ${CONTACT_MESSAGES_FILE_PATH}`);
    return true;
  } catch (error) {
    console.error("[API/Contact] CRITICAL: Error saving contact messages to file:", error);
    return false;
  }
};

if (!initialized) {
  loadContactMessagesFromFile();
  initialized = true;
}

export async function GET() {
  return NextResponse.json([...contactMessagesData]);
}

export async function POST(request: NextRequest) {
  let newMessage: ContactMessage;
  try {
    newMessage = await request.json();
  } catch (error) {
    console.error("[API/Contact] POST Error: Invalid JSON payload.", error);
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  if (!newMessage.id || !newMessage.name || !newMessage.email || !newMessage.subject || !newMessage.message || !newMessage.date) {
    return NextResponse.json({ message: 'Invalid contact message payload. Missing required fields.' }, { status: 400 });
  }

  const tempMessagesInMemory = [...contactMessagesData];

  if (!tempMessagesInMemory.some(msg => msg.id === newMessage.id)) {
      tempMessagesInMemory.unshift(newMessage);
      tempMessagesInMemory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
    
  contactMessagesData = tempMessagesInMemory; // Update in-memory first for SSE

  if (saveContactMessagesToFile()) {
    contactEmitter.emit('update', [...contactMessagesData]);
    console.log(`[API/Contact] Message ${newMessage.id} received and saved. Total: ${contactMessagesData.length}`);
    return NextResponse.json(newMessage, { status: 201 });
  } else {
    loadContactMessagesFromFile(); 
    console.error(`[API/Contact] Failed to save message ${newMessage.id} to file. In-memory change has been reverted.`);
    return NextResponse.json({ message: "Sunucu hatası: İletişim mesajı kalıcı olarak kaydedilemedi. Değişiklik geri alındı." }, { status: 500 });
  }
}


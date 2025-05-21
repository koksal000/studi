
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
    if (fs.existsSync(CONTACT_MESSAGES_FILE_PATH)) {
      const fileData = fs.readFileSync(CONTACT_MESSAGES_FILE_PATH, 'utf-8');
      contactMessagesData = (JSON.parse(fileData) as ContactMessage[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      console.log(`[API/Contact] Successfully loaded ${contactMessagesData.length} contact messages from ${CONTACT_MESSAGES_FILE_PATH}`);
    } else {
      contactMessagesData = [];
      if (process.env.DATA_PATH) { // Only attempt to create if on Render with persistent disk
         saveContactMessagesToFile();
         console.log(`[API/Contact] File ${CONTACT_MESSAGES_FILE_PATH} not found. Initialized with empty array and created file on persistent disk.`);
      } else {
         console.log(`[API/Contact] File ${CONTACT_MESSAGES_FILE_PATH} not found. Initialized with empty array (in-memory only, file not created as DATA_PATH not set).`);
      }
    }
  } catch (error) {
    console.error("[API/Contact] Error loading contact_messages file:", error);
    contactMessagesData = [];
  }
};

const saveContactMessagesToFile = () => {
  try {
    const dir = path.dirname(CONTACT_MESSAGES_FILE_PATH);
    if (!fs.existsSync(dir) && process.env.DATA_PATH ) { // Only attempt mkdir if DATA_PATH is set
      fs.mkdirSync(dir, { recursive: true });
    }
    const sortedData = [...contactMessagesData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    fs.writeFileSync(CONTACT_MESSAGES_FILE_PATH, JSON.stringify(sortedData, null, 2));
    console.log(`[API/Contact] Contact messages data saved to ${CONTACT_MESSAGES_FILE_PATH}`);
  } catch (error) {
    console.error("[API/Contact] Error saving contact messages to file (this is expected on Vercel, but not on Render with persistent disk):", error);
  }
};

if (!initialized) {
  loadContactMessagesFromFile();
  initialized = true;
}

export async function GET() {
  try {
    return NextResponse.json([...contactMessagesData]);
  } catch (error) {
    console.error("[API/Contact] Error fetching contact messages (GET):", error);
    return NextResponse.json({ message: "Internal server error while fetching contact messages." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const newMessage: ContactMessage = await request.json();

    if (!newMessage.id || !newMessage.name || !newMessage.email || !newMessage.subject || !newMessage.message || !newMessage.date) {
      return NextResponse.json({ message: 'Invalid contact message payload. Missing required fields.' }, { status: 400 });
    }

    if (!contactMessagesData.some(msg => msg.id === newMessage.id)) {
        contactMessagesData.unshift(newMessage);
        contactMessagesData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    
    saveContactMessagesToFile();
    contactEmitter.emit('update', [...contactMessagesData]);
    
    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    console.error("[API/Contact] Error creating contact message (POST):", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
    }
    return NextResponse.json({ message: "Internal server error while creating contact message." }, { status: 500 });
  }
}

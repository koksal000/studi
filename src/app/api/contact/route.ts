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

const MESSAGES_FILE_PATH = path.join(process.cwd(), '_contact_messages.json');

const loadMessagesFromFile = (): ContactMessage[] => {
  try {
    if (fs.existsSync(MESSAGES_FILE_PATH)) {
      const fileData = fs.readFileSync(MESSAGES_FILE_PATH, 'utf-8');
      const parsedData = JSON.parse(fileData) as ContactMessage[];
      // Sort by date descending when loading
      return parsedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  } catch (error) {
    console.error("Error reading contact messages file:", error);
  }
  return [];
};

const saveMessagesToFile = (data: ContactMessage[]) => {
  try {
    // Sort by date descending before saving
    const sortedData = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    fs.writeFileSync(MESSAGES_FILE_PATH, JSON.stringify(sortedData, null, 2));
  } catch (error) {
    console.error("Error writing contact messages file:", error);
  }
};

let contactMessagesData: ContactMessage[] = loadMessagesFromFile();

export async function GET() {
  try {
    return NextResponse.json([...contactMessagesData]);
  } catch (error) {
    console.error("Error fetching contact messages:", error);
    return NextResponse.json({ message: "Internal server error while fetching contact messages." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ message: 'Missing required fields: name, email, subject, or message' }, { status: 400 });
    }

    const newMessage: ContactMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name,
      email,
      subject,
      message,
      date: new Date().toISOString(),
    };

    contactMessagesData.unshift(newMessage); // Add to the beginning to keep newest first
    saveMessagesToFile(contactMessagesData);
    
    contactEmitter.emit('update', [...contactMessagesData]);

    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    console.error("Error creating contact message:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
    }
    return NextResponse.json({ message: "Internal server error while creating contact message." }, { status: 500 });
  }
}


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

const dataPath = process.env.DATA_PATH || process.cwd();
const MESSAGES_FILE_PATH = path.join(dataPath, '_contact_messages.json');

let contactMessagesData: ContactMessage[] | null = null;

const loadMessagesFromFile = (): ContactMessage[] => {
  try {
    if (fs.existsSync(MESSAGES_FILE_PATH)) {
      const fileData = fs.readFileSync(MESSAGES_FILE_PATH, 'utf-8');
      const parsedData = JSON.parse(fileData) as ContactMessage[];
      console.log(`[API/Contact] Successfully loaded ${parsedData.length} contact messages from ${MESSAGES_FILE_PATH}.`);
      return parsedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    console.warn(`[API/Contact] Contact messages file not found at ${MESSAGES_FILE_PATH}. Returning empty array. This is expected if starting with an empty Git repo.`);
    return [];
  } catch (error) {
    console.error("[API/Contact] Error reading contact messages file:", error);
    return [];
  }
};

// Initialize data only once when the module is first loaded
const initializeData = () => {
  if (contactMessagesData === null) {
    contactMessagesData = loadMessagesFromFile();
  }
};
initializeData();

// Function to save messages to file (currently disabled for "Git as DB" on free tier)
const saveMessagesToFile = (data: ContactMessage[]) => {
  // This function is disabled if not using a persistent disk on Render.
  // For "Git as DB" approach, changes should be made by editing the JSON file in Git and redeploying.
  console.log("[API/Contact] File saving is disabled in API; commit changes to Git for persistence.");
  /*
  try {
    if (!fs.existsSync(dataPath) && dataPath !== process.cwd()) {
      fs.mkdirSync(dataPath, { recursive: true });
    }
    const sortedData = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    fs.writeFileSync(MESSAGES_FILE_PATH, JSON.stringify(sortedData, null, 2));
    console.log("[API/Contact] Contact messages saved to file (if persistent disk is configured):", MESSAGES_FILE_PATH);
  } catch (error) {
    console.error("[API/Contact] Error writing contact messages file:", error);
  }
  */
};


export async function GET() {
  try {
    if (contactMessagesData === null) { // Should ideally not happen
        console.warn("[API/Contact] contactMessagesData is null in GET, re-initializing. This might indicate an issue.");
        initializeData();
    }
    return NextResponse.json([...(contactMessagesData || [])]);
  } catch (error) {
    console.error("[API/Contact] Error fetching contact messages (GET):", error);
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

    if (contactMessagesData === null) { // Ensure data is initialized
        initializeData();
    }
    contactMessagesData = contactMessagesData || []; // Ensure it's an array

    const newMessage: ContactMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name,
      email,
      subject,
      message,
      date: new Date().toISOString(),
    };

    contactMessagesData.unshift(newMessage);
    console.log("[API/Contact] New contact message added to in-memory store. File saving is disabled; commit changes to Git for persistence.");
    // saveMessagesToFile(contactMessagesData); // Disabled for GitHub as data source
    
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


// src/app/api/contact/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import contactEmitter from '@/lib/contact-emitter';
// fs and path are no longer needed

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  date: string;
}

// Data will be in-memory for each serverless function instance
let contactMessagesData: ContactMessage[] = [];
let initialized = false;

const loadInitialContactMessages = () => {
  if (initialized) return;
  // console.log("[API/Contact] Initializing in-memory contact messages array.");
  // Seed from _contact_messages.json if needed (read-only)
  /*
  try {
    const seedFilePath = path.join(process.cwd(), '_contact_messages.json');
    if (fs.existsSync(seedFilePath)) {
      const fileData = fs.readFileSync(seedFilePath, 'utf-8');
      contactMessagesData = (JSON.parse(fileData) as ContactMessage[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      console.log(`[API/Contact] Successfully seeded ${contactMessagesData.length} contact messages.`);
    }
  } catch (error) {
    console.error("[API/Contact] Error reading seed contact_messages file:", error);
  }
  */
  initialized = true;
};

loadInitialContactMessages();

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
    // Client now sends the full ContactMessage object
    const newMessage: ContactMessage = await request.json();

    if (!newMessage.id || !newMessage.name || !newMessage.email || !newMessage.subject || !newMessage.message || !newMessage.date) {
      return NextResponse.json({ message: 'Invalid contact message payload. Missing required fields.' }, { status: 400 });
    }

    // Add to in-memory store for this instance
    if (!contactMessagesData.some(msg => msg.id === newMessage.id)) {
        contactMessagesData.unshift(newMessage);
        contactMessagesData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    
    contactEmitter.emit('update', [...contactMessagesData]);
    // console.log("[API/Contact] New contact message processed for SSE broadcast.");

    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    console.error("[API/Contact] Error creating contact message (POST):", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
    }
    return NextResponse.json({ message: "Internal server error while creating contact message." }, { status: 500 });
  }
}

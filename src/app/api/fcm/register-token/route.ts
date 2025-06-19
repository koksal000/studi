
// src/app/api/fcm/register-token/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface FCMTokenRecord {
  token: string;
  userId?: string; // Optional: associate token with a user
  createdAt: string;
}

const dataDir = process.env.DATA_PATH || process.cwd();
const TOKENS_FILE_PATH = path.join(dataDir, '_fcm_tokens.json');

let fcmTokens: FCMTokenRecord[] = [];

const loadTokensFromFile = () => {
  try {
    if (fs.existsSync(TOKENS_FILE_PATH)) {
      const fileData = fs.readFileSync(TOKENS_FILE_PATH, 'utf-8');
      if (fileData.trim() === '') {
        fcmTokens = [];
      } else {
        fcmTokens = JSON.parse(fileData) as FCMTokenRecord[];
      }
    } else {
      fcmTokens = [];
      saveTokensToFile(); // Create file if not exists
    }
  } catch (error) {
    console.error("[API/FCMTokens] Error loading tokens from file:", error);
    fcmTokens = [];
  }
};

const saveTokensToFile = (): boolean => {
  try {
    const dir = path.dirname(TOKENS_FILE_PATH);
    if (!fs.existsSync(dir) && dataDir !== process.cwd()) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TOKENS_FILE_PATH, JSON.stringify(fcmTokens, null, 2));
    return true;
  } catch (error) {
    console.error("[API/FCMTokens] CRITICAL: Error saving tokens to file:", error);
    return false;
  }
};

// Load tokens once on server start (for this simple file-based storage)
loadTokensFromFile();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, userId } = body; // userId can be added later

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ message: 'Invalid FCM token provided.' }, { status: 400 });
    }

    loadTokensFromFile(); // Ensure we have the latest tokens before modifying

    const existingTokenIndex = fcmTokens.findIndex(t => t.token === token);
    if (existingTokenIndex === -1) {
      fcmTokens.push({
        token,
        userId, // Store if provided
        createdAt: new Date().toISOString(),
      });
      console.log(`[API/FCMTokens] New FCM token registered: ${token.substring(0, 20)}...`);
    } else {
      // Optionally update createdAt or userId if token already exists
      fcmTokens[existingTokenIndex].createdAt = new Date().toISOString();
      if (userId) fcmTokens[existingTokenIndex].userId = userId;
      console.log(`[API/FCMTokens] FCM token already registered, updated timestamp: ${token.substring(0, 20)}...`);
    }

    if (saveTokensToFile()) {
      return NextResponse.json({ message: 'FCM token registered successfully.' }, { status: 200 });
    } else {
      // Revert in-memory change if save failed
      loadTokensFromFile();
      return NextResponse.json({ message: 'Server error: Failed to save FCM token.' }, { status: 500 });
    }
  } catch (error) {
    console.error("[API/FCMTokens] POST Error:", error);
    return NextResponse.json({ message: 'Invalid request payload or internal server error.' }, { status: 400 });
  }
}

export async function GET() {
    // This endpoint is primarily for admin/debugging to see registered tokens.
    // In a production app, this should be secured.
    loadTokensFromFile();
    return NextResponse.json({ tokens: fcmTokens, count: fcmTokens.length });
}

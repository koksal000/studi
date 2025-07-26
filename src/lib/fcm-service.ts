
'use server';

import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// --- Service Account Initialization ---
try {
  if (!admin.apps.length) {
    const serviceAccountString = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountString || serviceAccountString === 'PASTE_YOUR_FIREBASE_SERVICE_ACCOUNT_JSON_HERE') {
      console.warn("[FCM-Service] Firebase Admin SDK not initialized. `GOOGLE_SERVICE_ACCOUNT_JSON` env var is missing. Push notifications will be simulated.");
    } else {
        const serviceAccount = JSON.parse(serviceAccountString);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log("[FCM-Service] Firebase Admin SDK initialized successfully.");
    }
  }
} catch (error: any) {
  console.error('[FCM-Service] Firebase Admin SDK initialization failed:', error.message);
}

// --- Token Reading Logic ---
interface FCMTokenRecord {
  token: string;
  userId?: string;
  createdAt: string;
}

const dataDir = process.env.DATA_PATH || process.cwd();
const TOKENS_FILE_PATH = path.join(dataDir, '_fcm_tokens.json');

const readTokensFromFile = (): FCMTokenRecord[] => {
  try {
    if (fs.existsSync(TOKENS_FILE_PATH)) {
      const fileData = fs.readFileSync(TOKENS_FILE_PATH, 'utf-8');
      if (fileData.trim() === '') return [];
      return JSON.parse(fileData);
    }
    return [];
  } catch (error) {
    console.error("[FCM-Service] Error reading tokens file:", error);
    return [];
  }
};


// --- Notification Sending Logic ---
async function sendPushNotification({
  tokens,
  title,
  body,
  link,
}: {
  tokens: string[];
  title: string;
  body: string;
  link: string;
}) {
  if (!tokens || tokens.length === 0) {
    console.log('[FCM-Service] No tokens provided, skipping notification.');
    return;
  }
  
  if (!admin.apps.length) {
    console.warn(`[FCM-Service] SIMULATING SEND (Admin SDK not initialized): Title: "${title}", Body: "${body}", Link: "${link}" to ${tokens.length} token(s).`);
    return;
  }

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: {
      title,
      body,
    },
    webpush: {
      fcmOptions: {
        link: link,
      },
      notification: {
        icon: '/favicon.ico',
      },
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[FCM-Service] Notifications sent: ${response.successCount} success, ${response.failureCount} failure.`);
    
    if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                console.error(`[FCM-Service] Failed to send to token ${tokens[idx]}:`, resp.error);
                // Here you could add logic to remove invalid tokens from your database.
            }
        });
    }

  } catch (error) {
    console.error('[FCM-Service] Error sending push notifications:', error);
  }
}

// --- Exported Functions ---

export async function sendNotificationToAll(payload: { title: string; body: string; link: string; }) {
  const allTokens = readTokensFromFile().map(t => t.token);
  await sendPushNotification({ ...payload, tokens: allTokens });
}

export async function sendNotificationToUser(userId: string, payload: { title:string; body: string; link: string; }) {
  console.log(`[FCM-Service] Initiating notification send to user: ${userId}`);
  const allTokenRecords = readTokensFromFile();
  // Ensure userId is consistently lowercased for matching
  const userTokens = allTokenRecords
    .filter(t => t.userId && t.userId.toLowerCase() === userId.toLowerCase())
    .map(t => t.token);
  
  if (userTokens.length > 0) {
      console.log(`[FCM-Service] Found ${userTokens.length} token(s) for user ${userId}. Sending notification...`);
      await sendPushNotification({ ...payload, tokens: userTokens });
  } else {
      console.warn(`[FCM-Service] No tokens found for user ${userId}. Notification not sent.`);
  }
}

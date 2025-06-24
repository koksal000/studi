
'use server';

import fs from 'fs';
import path from 'path';

interface FCMTokenRecord {
  token: string;
  userId?: string; 
  createdAt: string;
}

const dataDir = process.env.DATA_PATH || process.cwd();
const TOKENS_FILE_PATH = path.join(dataDir, '_fcm_tokens.json');
const PROJECT_ID = 'amlca-village-connect'; // From firebase-config.ts

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

/**
 * Sends a push notification to the specified tokens using the FCM v1 API.
 * NOTE: This function requires a valid OAuth 2.0 access token for authentication.
 * In a real-world production environment, you would generate this token using a Google Service Account.
 * Since we don't have a service account set up in this context, this function will log the intended action
 * instead of making a live API call, allowing the application's structure to be complete.
 */
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
  
  // In a real application, you would obtain an access token here.
  // Example: const accessToken = await getAccessTokenFromServiceAccount();
  const accessToken = 'DUMMY_ACCESS_TOKEN_BECAUSE_SERVICE_ACCOUNT_IS_NOT_AVAILABLE';

  const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;
  
  console.log(`[FCM-Service] Preparing to send push notification. Title: "${title}", Body: "${body}", Link: "${link}"`);
  
  for (const token of tokens) {
    const message = {
      message: {
        token: token,
        notification: {
          title,
          body,
        },
        webpush: {
          fcm_options: {
            link: link,
          },
          notification: {
            icon: '/favicon.ico' // A default icon
          }
        },
      },
    };

    console.log(`[FCM-Service] SIMULATING SEND to token: ${token.substring(0,20)}...`);
    // The actual fetch call is commented out as it would fail without a valid access token.
    /*
    try {
      const response = await fetch(fcmEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[FCM-Service] Failed to send notification to token ${token}:`, errorData);
      } else {
        console.log(`[FCM-Service] Successfully sent notification to token ${token}.`);
      }
    } catch (error) {
      console.error(`[FCM-Service] Error sending push notification to token ${token}:`, error);
    }
    */
  }
}

/**
 * Sends a notification to all subscribed users.
 */
export async function sendNotificationToAll(payload: { title: string; body: string; link: string; }) {
  const allTokens = readTokensFromFile().map(t => t.token);
  await sendPushNotification({ ...payload, tokens: allTokens });
}

/**
 * Sends a notification to a specific user, identified by their email.
 */
export async function sendNotificationToUser(userId: string, payload: { title: string; body: string; link: string; }) {
  const allTokenRecords = readTokensFromFile();
  const userTokens = allTokenRecords.filter(t => t.userId === userId).map(t => t.token);
  await sendPushNotification({ ...payload, tokens: userTokens });
}

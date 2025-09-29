
// src/app/api/fcm/send-direct-message/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { sendNotificationToUser } from '@/lib/onesignal-service';
import fs from 'fs';
import path from 'path';

interface FcmTokenInfo {
    token: string;
    userId: string;
    createdAt: string;
}
type MessageType = 'normal' | 'uyari' | 'iyi';

const dataDir = process.env.DATA_PATH || process.cwd();
const FCM_TOKENS_FILE_PATH = path.join(dataDir, '_fcm_tokens.json');


const readTokensFromFile = (): FcmTokenInfo[] => {
  try {
    if (fs.existsSync(FCM_TOKENS_FILE_PATH)) {
      const fileData = fs.readFileSync(FCM_TOKENS_FILE_PATH, 'utf-8');
      if (fileData.trim() === '') return [];
      return JSON.parse(fileData);
    }
    return [];
  } catch (error) {
    console.error("[API/FCM] Error reading FCM tokens file:", error);
    return [];
  }
};


export async function POST(request: NextRequest) {
  let body: { userId: string, message: string, type: MessageType };
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ message: "Geçersiz JSON yükü." }, { status: 400 });
  }

  const { userId, message, type } = body;
  if (!userId || !message || !type) {
    return NextResponse.json({ message: "Eksik parametreler: userId, message ve type gereklidir." }, { status: 400 });
  }

  const allTokens = readTokensFromFile();
  const userTokens = allTokens.filter(t => t.userId === userId).map(t => t.token);
  
  if (userTokens.length === 0) {
    return NextResponse.json({ message: `Bu kullanıcı (${userId}) için kayıtlı bir bildirim alıcısı (token) bulunamadı. Kullanıcının bildirimlere izin verdiğinden emin olun.` }, { status: 404 });
  }

  let title = "Yöneticiden Mesaj";
  if (type === 'uyari') title = "Yöneticiden Uyarı";
  if (type === 'iyi') title = "Yöneticiden Bilgilendirme";
  
  try {
    // We send the notification via OneSignal which will handle targeting the user's devices
    await sendNotificationToUser(userId, {
        title: title,
        body: message,
        link: '/',
    });
    
    return NextResponse.json({ message: 'Bildirim başarıyla gönderim için sıraya alındı.' }, { status: 202 });

  } catch (error: any) {
    console.error(`[API/FCM/Send] Error sending notification to ${userId}:`, error);
    return NextResponse.json({ message: 'Bildirim gönderilirken bir sunucu hatası oluştu.', error: error.message }, { status: 500 });
  }
}

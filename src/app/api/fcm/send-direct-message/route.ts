
// src/app/api/fcm/send-direct-message/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { sendNotificationToUser } from '@/lib/fcm-service';

interface DirectMessagePayload {
  userId: string;
  message: string;
  type: 'normal' | 'uyari' | 'iyi';
}

export async function POST(request: NextRequest) {
  let payload: DirectMessagePayload;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ message: "Geçersiz JSON yükü." }, { status: 400 });
  }

  const { userId, message, type } = payload;

  if (!userId || !message || !type) {
    return NextResponse.json({ message: 'Eksik parametreler: userId, message ve type gereklidir.' }, { status: 400 });
  }

  let title = '';
  const body = message;
  const link = '/'; // Default link for direct messages

  switch (type) {
    case 'uyari':
      title = 'UYARI: Yönetimden önemli bir mesaj';
      break;
    case 'iyi':
      title = 'Yönetimden Mesajınız Var';
      break;
    case 'normal':
    default:
      title = 'Yönetim Hesabından bir mesajın var';
      break;
  }

  try {
    console.log(`[API/FCMDirectMessage] Attempting to send a '${type}' message to user ${userId}`);
    await sendNotificationToUser(userId, { title, body, link });
    return NextResponse.json({ message: 'Bildirim başarıyla gönderildi.' }, { status: 200 });
  } catch (error) {
    console.error(`[API/FCMDirectMessage] Failed to send direct message to ${userId}:`, error);
    return NextResponse.json({ message: 'Bildirim gönderilirken bir sunucu hatası oluştu.' }, { status: 500 });
  }
}

    
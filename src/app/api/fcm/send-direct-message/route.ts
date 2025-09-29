// src/app/api/fcm/send-direct-message/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { sendNotificationToUser } from '@/lib/onesignal-service';

type MessageType = 'normal' | 'uyari' | 'iyi';

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

  let title = "Yöneticiden Mesaj";
  if (type === 'uyari') title = "Yöneticiden Uyarı";
  if (type === 'iyi') title = "Yöneticiden Bilgilendirme";
  
  try {
    // This now correctly uses the OneSignal service to send a notification
    // to the user identified by their external ID (anonymousId).
    await sendNotificationToUser(userId, {
        title: title,
        body: message,
        link: '/', // The user's request was to open a modal on the home page.
                   // We direct them to the home page; client-side logic will handle the modal.
                   // Note: Implementing the modal part requires client-side changes not requested here.
    });
    
    return NextResponse.json({ message: 'Bildirim başarıyla gönderim için sıraya alındı.' }, { status: 202 });

  } catch (error: any) {
    console.error(`[API/FCM/Send] Error sending notification to ${userId}:`, error);
    return NextResponse.json({ message: 'Bildirim gönderilirken bir sunucu hatası oluştu.', error: error.message }, { status: 500 });
  }
}

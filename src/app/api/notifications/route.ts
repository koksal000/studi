
// src/app/api/notifications/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export interface AppNotification {
  id: string;
  type: 'reply';
  recipientUserId: string; // The authorId of the person being notified
  senderUserName: string;
  announcementId: string;
  announcementTitle: string;
  commentId: string;
  replyId?: string; // This links the notification to a specific reply
  date: string;
  read: boolean;
}

const dataDir = process.env.DATA_PATH || process.cwd();
const NOTIFICATIONS_FILE_PATH = path.join(dataDir, '_notifications.json');

const readNotificationsFromFile = (): AppNotification[] => {
  try {
    if (fs.existsSync(NOTIFICATIONS_FILE_PATH)) {
      const fileData = fs.readFileSync(NOTIFICATIONS_FILE_PATH, 'utf-8');
      if (fileData.trim() === '') return [];
      return (JSON.parse(fileData) as AppNotification[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return [];
  } catch (error) {
    console.error("[API/Notifications] Error reading notifications from file:", error);
    return [];
  }
};

const writeNotificationsToFile = (data: AppNotification[]): boolean => {
  try {
    const dir = path.dirname(NOTIFICATIONS_FILE_PATH);
    if (!fs.existsSync(dir) && dataDir !== process.cwd()) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const sortedData = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    fs.writeFileSync(NOTIFICATIONS_FILE_PATH, JSON.stringify(sortedData, null, 2));
    return true;
  } catch (error) {
    console.error("[API/Notifications] CRITICAL: Error saving notifications to file:", error);
    return false;
  }
};

// GET notifications for a specific user
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ message: 'User ID is required.' }, { status: 400 });
  }

  const allNotifications = readNotificationsFromFile();
  const userNotifications = allNotifications.filter(n => n.recipientUserId === userId);
  
  return NextResponse.json(userNotifications);
}

// POST to create a new notification (now only used for seeding or manual creation if needed)
export async function POST(request: NextRequest) {
  let payload: Omit<AppNotification, 'id' | 'date' | 'read'>;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  if (!payload.recipientUserId || !payload.senderUserName || !payload.announcementId || !payload.commentId) {
    return NextResponse.json({ message: 'Invalid notification payload. Missing required fields.' }, { status: 400 });
  }

  const newNotification: AppNotification = {
    ...payload,
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    date: new Date().toISOString(),
    read: false,
  };

  const notifications = readNotificationsFromFile();
  notifications.unshift(newNotification);

  if (writeNotificationsToFile(notifications)) {
    console.log(`[API/Notifications] Notification created for ${payload.recipientUserId}`);
    return NextResponse.json(newNotification, { status: 201 });
  } else {
    return NextResponse.json({ message: "Server error: Failed to save notification." }, { status: 500 });
  }
}

// PATCH to mark notifications as read
export async function PATCH(request: NextRequest) {
    let body: { userId: string };
    try {
        body = await request.json();
    } catch (error) {
        return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
    }

    const { userId } = body;
    if (!userId) {
        return NextResponse.json({ message: 'User ID is required to mark notifications as read.' }, { status: 400 });
    }

    const notifications = readNotificationsFromFile();
    let modified = false;
    const updatedNotifications = notifications.map(n => {
        if (n.recipientUserId === userId && !n.read) {
            modified = true;
            return { ...n, read: true };
        }
        return n;
    });

    if (modified) {
        if (writeNotificationsToFile(updatedNotifications)) {
            console.log(`[API/Notifications] Marked all notifications as read for ${userId}`);
            return NextResponse.json({ message: 'Notifications marked as read.' }, { status: 200 });
        } else {
            return NextResponse.json({ message: "Server error: Failed to update notifications." }, { status: 500 });
        }
    }

    return NextResponse.json({ message: 'No unread notifications to mark.' }, { status: 200 });
}

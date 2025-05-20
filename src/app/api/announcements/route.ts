// src/app/api/announcements/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Announcement, NewAnnouncementPayload } from '@/hooks/use-announcements';
import announcementEmitter from '@/lib/announcement-emitter';

// In-memory store for announcements.
// WARNING: This data will be lost if the server restarts.
// For persistent storage, a database (e.g., Firebase Firestore, Postgres, MongoDB) should be used.
let announcementsData: Announcement[] = [];

export async function GET() {
  try {
    // Return a copy to prevent direct modification of the in-memory store
    return NextResponse.json([...announcementsData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return NextResponse.json({ message: "Internal server error while fetching announcements." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: NewAnnouncementPayload = await request.json();

    if (!body.title || !body.content || !body.author) {
      return NextResponse.json({ message: 'Missing required fields: title, content, or author' }, { status: 400 });
    }

    const newAnnouncement: Announcement = {
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      date: new Date().toISOString(),
      title: body.title,
      content: body.content,
      media: body.media || null,
      mediaType: body.mediaType || null,
      author: body.author,
    };

    announcementsData.unshift(newAnnouncement); // Add to the beginning for chronological order (newest first)
    
    // Notify SSE stream listeners
    announcementEmitter.emit('update', [...announcementsData]);

    return NextResponse.json(newAnnouncement, { status: 201 });
  } catch (error) {
    console.error("Error creating announcement:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
    }
    return NextResponse.json({ message: "Internal server error while creating announcement." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ message: 'Announcement ID is required for deletion' }, { status: 400 });
    }

    const initialLength = announcementsData.length;
    announcementsData = announcementsData.filter(ann => ann.id !== id);

    if (announcementsData.length === initialLength) {
      return NextResponse.json({ message: 'Announcement not found' }, { status: 404 });
    }

    // Notify SSE stream listeners
    announcementEmitter.emit('update', [...announcementsData]);

    return NextResponse.json({ message: 'Announcement deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error("Error deleting announcement:", error);
    return NextResponse.json({ message: "Internal server error while deleting announcement." }, { status: 500 });
  }
}

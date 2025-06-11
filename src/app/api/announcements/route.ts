
// src/app/api/announcements/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Announcement, Comment, Reply, Like } from '@/hooks/use-announcements'; 
import announcementEmitter from '@/lib/announcement-emitter';
import fs from 'fs';
import path from 'path';

const dataDir = process.env.DATA_PATH || process.cwd();
const ANNOUNCEMENTS_FILE_PATH = path.join(dataDir, '_announcements.json');

const MAX_IMAGE_RAW_SIZE_MB_API = 5;
const MAX_VIDEO_CONVERSION_RAW_SIZE_MB_API = 7;
const MAX_IMAGE_PAYLOAD_SIZE_API = Math.floor(MAX_IMAGE_RAW_SIZE_MB_API * 1024 * 1024 * 1.37 * 1.05);
const MAX_VIDEO_PAYLOAD_SIZE_API = Math.floor(MAX_VIDEO_CONVERSION_RAW_SIZE_MB_API * 1024 * 1024 * 1.37 * 1.05);

let announcementsData: Announcement[] = [];
let initialized = false;

interface ToggleAnnouncementLikeApiPayload {
  action: "TOGGLE_ANNOUNCEMENT_LIKE";
  announcementId: string;
  userId: string;
  userName: string; 
}
interface AddCommentApiPayload {
  action: "ADD_COMMENT_TO_ANNOUNCEMENT";
  announcementId: string;
  comment: Omit<Comment, 'id' | 'date' | 'replies'>;
}
interface AddReplyApiPayload {
  action: "ADD_REPLY_TO_COMMENT";
  announcementId: string;
  commentId: string;
  reply: Omit<Reply, 'id' | 'date'>;
}
interface DeleteCommentApiPayload {
  action: "DELETE_COMMENT";
  announcementId: string;
  commentId: string;
}
interface DeleteReplyApiPayload {
  action: "DELETE_REPLY";
  announcementId: string;
  commentId: string;
  replyId: string;
}

type AnnouncementApiPayload = 
  | ToggleAnnouncementLikeApiPayload
  | AddCommentApiPayload
  | AddReplyApiPayload
  | DeleteCommentApiPayload
  | DeleteReplyApiPayload
  | Announcement;


const loadAnnouncementsFromFile = () => {
  try {
    if (!initialized) console.log(`[API/Announcements] DATA_PATH used: ${dataDir}`);
    if (fs.existsSync(ANNOUNCEMENTS_FILE_PATH)) {
      const fileData = fs.readFileSync(ANNOUNCEMENTS_FILE_PATH, 'utf-8');
      if (fileData.trim() === '') {
        announcementsData = [];
      } else {
        const parsedData = JSON.parse(fileData) as Announcement[];
        announcementsData = parsedData.map(ann => ({
          ...ann,
          likes: ann.likes || [],
          comments: (ann.comments || []).map(comment => ({
            ...comment,
            replies: (comment.replies || []).map(reply => ({
                ...reply,
            })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) 
          })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()), 
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); 
      }
      if (!initialized) console.log(`[API/Announcements] Successfully loaded ${announcementsData.length} announcements from file.`);
    } else {
      announcementsData = [];
      if (!initialized) console.log(`[API/Announcements] File ${ANNOUNCEMENTS_FILE_PATH} not found. Initializing with empty array.`);
      saveAnnouncementsToFile();
    }
  } catch (error) {
    console.error("[API/Announcements] Error loading announcements from file:", error);
    announcementsData = [];
  }
};

const saveAnnouncementsToFile = (dataToSave: Announcement[] = announcementsData): boolean => {
  try {
    const dir = path.dirname(ANNOUNCEMENTS_FILE_PATH);
    if (!fs.existsSync(dir) && dataDir !== process.cwd()) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const processedDataToSave = dataToSave.map(ann => ({
        ...ann, // Ensure all top-level properties are preserved
        likes: ann.likes || [],
        comments: (ann.comments || []).map(comment => ({
            ...comment, // Preserve comment properties
            replies: (comment.replies || []).map(reply => ({
                ...reply, // Preserve reply properties
            })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    fs.writeFileSync(ANNOUNCEMENTS_FILE_PATH, JSON.stringify(processedDataToSave, null, 2));
    // console.log(`[API/Announcements] Data saved to ${ANNOUNCEMENTS_FILE_PATH}. Count: ${processedDataToSave.length}`);
    return true;
  } catch (error) {
    console.error("[API/Announcements] CRITICAL: Error saving announcements to file:", error);
    return false;
  }
};

if (!initialized) {
  loadAnnouncementsFromFile();
  initialized = true;
}

export async function GET() {
  loadAnnouncementsFromFile(); // Ensure latest data is loaded for direct GET requests
  return NextResponse.json([...announcementsData]);
}

export async function POST(request: NextRequest) {
  let payload: AnnouncementApiPayload;
  try {
    const rawBody = await request.text();
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error("[API/Announcements] POST Error: Invalid JSON payload.", error);
    return NextResponse.json({ message: "Geçersiz JSON yükü." }, { status: 400 });
  }

  loadAnnouncementsFromFile(); // Load the latest state from file
  let currentDataFromFile = [...announcementsData.map(a => ({...a, comments: a.comments?.map(c => ({...c, replies: c.replies?.map(r => ({...r}))}))}))]; // Deep copy for modification
  let announcementModified = false;
  let modifiedAnnouncement: Announcement | null = null;


  if ('action' in payload) {
    const actionPayload = payload;
    const annIndex = currentDataFromFile.findIndex(ann => ann.id === actionPayload.announcementId);

    if (annIndex === -1) {
        return NextResponse.json({ message: 'İlgili duyuru bulunamadı.' }, { status: 404 });
    }
    
    // Work on a copy of the specific announcement
    let announcementToUpdate = JSON.parse(JSON.stringify(currentDataFromFile[annIndex])) as Announcement;
    announcementToUpdate.likes = announcementToUpdate.likes || [];
    announcementToUpdate.comments = (announcementToUpdate.comments || []).map(c => ({
        ...c, 
        replies: (c.replies || []).map(r => ({...r })),
    }));


    if (actionPayload.action === "TOGGLE_ANNOUNCEMENT_LIKE") {
      const likeExistsIndex = announcementToUpdate.likes.findIndex(like => like.userId === actionPayload.userId);
      if (likeExistsIndex > -1) {
        announcementToUpdate.likes.splice(likeExistsIndex, 1);
      } else {
        announcementToUpdate.likes.push({ userId: actionPayload.userId });
      }
      announcementModified = true;
    } else if (actionPayload.action === "ADD_COMMENT_TO_ANNOUNCEMENT") {
      const newComment: Comment = {
        ...actionPayload.comment,
        id: `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        date: new Date().toISOString(),
        replies: [],
      };
      announcementToUpdate.comments.push(newComment);
      announcementToUpdate.comments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      announcementModified = true;
    } else if (actionPayload.action === "ADD_REPLY_TO_COMMENT") {
      const commentIndex = announcementToUpdate.comments.findIndex(c => c.id === actionPayload.commentId);
      if (commentIndex === -1) {
        return NextResponse.json({ message: 'Yanıt eklenecek yorum bulunamadı.' }, { status: 404 });
      }
      const commentToUpdate = announcementToUpdate.comments[commentIndex];
      commentToUpdate.replies = commentToUpdate.replies || [];
      const newReply: Reply = {
        ...actionPayload.reply,
        id: `rpl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        date: new Date().toISOString(),
      };
      commentToUpdate.replies.push(newReply);
      commentToUpdate.replies.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      // No need to reassign commentToUpdate to announcementToUpdate.comments[commentIndex] as it's a reference modification
      announcementModified = true;
    } else if (actionPayload.action === "DELETE_COMMENT") {
      const commentIndex = announcementToUpdate.comments.findIndex(c => c.id === actionPayload.commentId);
      if (commentIndex === -1) {
        return NextResponse.json({ message: 'Silinecek yorum bulunamadı.' }, { status: 404 });
      }
      announcementToUpdate.comments.splice(commentIndex, 1);
      announcementModified = true;
    } else if (actionPayload.action === "DELETE_REPLY") {
      const commentIndex = announcementToUpdate.comments.findIndex(c => c.id === actionPayload.commentId);
      if (commentIndex === -1) {
        return NextResponse.json({ message: 'Yanıtın ait olduğu yorum bulunamadı.' }, { status: 404 });
      }
      const commentToUpdate = announcementToUpdate.comments[commentIndex];
      commentToUpdate.replies = commentToUpdate.replies || [];
      const replyIndex = commentToUpdate.replies.findIndex(r => r.id === actionPayload.replyId);
      if (replyIndex === -1) {
        return NextResponse.json({ message: 'Silinecek yanıt bulunamadı.' }, { status: 404 });
      }
      commentToUpdate.replies.splice(replyIndex, 1);
      announcementModified = true;
    }
    
    if (announcementModified) {
        currentDataFromFile[annIndex] = announcementToUpdate;
        modifiedAnnouncement = announcementToUpdate;
    }

  } else { 
    // Adding a new announcement
    const newAnnouncement = payload as Announcement; // Type assertion
    if (!newAnnouncement.id || !newAnnouncement.title?.trim() || !newAnnouncement.content?.trim() || !newAnnouncement.author || !newAnnouncement.date) {
      return NextResponse.json({ message: 'Geçersiz duyuru yükü. Gerekli alanlar eksik.' }, { status: 400 });
    }
    if (newAnnouncement.media && newAnnouncement.media.startsWith("data:")) {
      if (newAnnouncement.mediaType?.startsWith("image/") && newAnnouncement.media.length > MAX_IMAGE_PAYLOAD_SIZE_API) {
        return NextResponse.json({ message: `Resim içeriği çok büyük. Maksimum boyut yaklaşık ${MAX_IMAGE_RAW_SIZE_MB_API}MB ham dosya olmalıdır.` }, { status: 413 });
      }
      if (newAnnouncement.mediaType?.startsWith("video/") && newAnnouncement.media.length > MAX_VIDEO_PAYLOAD_SIZE_API) {
        return NextResponse.json({ message: `Video içeriği çok büyük. Maksimum boyut yaklaşık ${MAX_VIDEO_CONVERSION_RAW_SIZE_MB_API}MB ham dosya olmalıdır.` }, { status: 413 });
      }
    }
    newAnnouncement.likes = newAnnouncement.likes || [];
    newAnnouncement.comments = (newAnnouncement.comments || []).map(c => ({
        ...c, 
        replies: (c.replies || []).map(r => ({...r })),
    })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const existingIndex = currentDataFromFile.findIndex(ann => ann.id === newAnnouncement.id);
    if (existingIndex !== -1) {
      currentDataFromFile[existingIndex] = newAnnouncement; // Should ideally be an update action
    } else {
      currentDataFromFile.unshift(newAnnouncement);
    }
    announcementModified = true;
    modifiedAnnouncement = newAnnouncement;
  }

  if (announcementModified) {
    currentDataFromFile.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (saveAnnouncementsToFile(currentDataFromFile)) {
      announcementsData = currentDataFromFile; // Update global in-memory store
      announcementEmitter.emit('update', [...announcementsData]); // Emit copy to prevent external modification
      return NextResponse.json(modifiedAnnouncement || payload, { status: 'action' in payload ? 200 : 201 });
    } else {
      // If save fails, it's a server error. The in-memory `announcementsData` might be stale until next load.
      console.error(`[API/Announcements] Failed to save data to file after modification.`);
      return NextResponse.json({ message: "Sunucu hatası: Veri kalıcı olarak kaydedilemedi." }, { status: 500 });
    }
  } else {
    return NextResponse.json({ message: "İşlem yapılmadı veya geçersiz eylem." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'Duyuru IDsi silme için gerekli' }, { status: 400 });
  }

  loadAnnouncementsFromFile(); // Load latest
  const currentDataFromFile = [...announcementsData];
  const filteredAnnouncements = currentDataFromFile.filter(ann => ann.id !== id);

  if (filteredAnnouncements.length < currentDataFromFile.length) {
    if (saveAnnouncementsToFile(filteredAnnouncements)) {
      announcementsData = filteredAnnouncements; // Update global in-memory
      announcementEmitter.emit('update', [...announcementsData]);
      return NextResponse.json({ message: 'Duyuru başarıyla silindi' }, { status: 200 });
    } else {
      console.error(`[API/Announcements] Failed to save after deleting announcement ${id} from file.`);
      return NextResponse.json({ message: 'Sunucu hatası: Duyuru silindikten sonra değişiklikler kalıcı olarak kaydedilemedi.' }, { status: 500 });
    }
  } else {
    return NextResponse.json({ message: 'Silinecek duyuru bulunamadı' }, { status: 404 });
  }
}

    
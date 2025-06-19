
// src/app/api/announcements/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Announcement, Comment, Reply, Like } from '@/hooks/use-announcements'; 
import announcementEmitter from '@/lib/announcement-emitter';
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

const dataDir = process.env.DATA_PATH || process.cwd();
const ANNOUNCEMENTS_FILE_PATH = path.join(dataDir, '_announcements.json');
const TOKENS_FILE_PATH = path.join(dataDir, '_fcm_tokens.json'); // For reading tokens

const MAX_IMAGE_RAW_SIZE_MB_API = 5;
const MAX_VIDEO_CONVERSION_RAW_SIZE_MB_API = 7;
const MAX_IMAGE_PAYLOAD_SIZE_API = Math.floor(MAX_IMAGE_RAW_SIZE_MB_API * 1024 * 1024 * 1.37 * 1.05);
const MAX_VIDEO_PAYLOAD_SIZE_API = Math.floor(MAX_VIDEO_CONVERSION_RAW_SIZE_MB_API * 1024 * 1024 * 1.37 * 1.05);

let announcementsData: Announcement[] = [];
let initialized = false;

// Initialize Firebase Admin SDK
try {
  const serviceAccountPath = process.env.FIREBASE_ADMIN_SDK_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    if (admin.apps.length === 0) { // Check if already initialized
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("[Firebase Admin] SDK initialized successfully.");
    }
  } else if (process.env.NODE_ENV === 'production' && !serviceAccountPath) {
    console.warn("[Firebase Admin] FIREBASE_ADMIN_SDK_SERVICE_ACCOUNT_PATH not set. Push notifications for new announcements will not be sent.");
  } else if (serviceAccountPath && !fs.existsSync(serviceAccountPath)) {
     console.warn(`[Firebase Admin] Service account file not found at: ${serviceAccountPath}. Push notifications for new announcements will not be sent.`);
  }
} catch (error) {
  console.error("[Firebase Admin] Failed to initialize SDK:", error);
}


interface ToggleAnnouncementLikeApiPayload {
  action: "TOGGLE_ANNOUNCEMENT_LIKE";
  announcementId: string;
  userId: string;
  userName: string; 
}
interface AddCommentApiPayload {
  action: "ADD_COMMENT_TO_ANNOUNCEMENT";
  announcementId: string;
  comment: Omit<Comment, 'id' | 'date' | 'replies' | 'likes'>;
}
interface AddReplyApiPayload {
  action: "ADD_REPLY_TO_COMMENT";
  announcementId: string;
  commentId: string;
  reply: Omit<Reply, 'id' | 'date' | 'likes'>;
}
interface DeleteCommentApiPayload {
  action: "DELETE_COMMENT";
  announcementId: string;
  commentId: string;
  deleterAuthorId: string;
}
interface DeleteReplyApiPayload {
  action: "DELETE_REPLY";
  announcementId: string;
  commentId: string;
  replyId: string;
  deleterAuthorId: string;
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
            // likes removed from comments
            replies: (comment.replies || []).map(reply => ({
                ...reply,
                // likes removed from replies
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
        ...ann,
        likes: ann.likes || [],
        comments: (ann.comments || []).map(comment => ({
            ...comment,
            // likes removed
            replies: (comment.replies || []).map(reply => ({
                ...reply,
                // likes removed
            })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    fs.writeFileSync(ANNOUNCEMENTS_FILE_PATH, JSON.stringify(processedDataToSave, null, 2));
    return true;
  } catch (error) {
    console.error("[API/Announcements] CRITICAL: Error saving announcements to file:", error);
    return false;
  }
};

const sendFcmNotifications = async (title: string, body: string) => {
  if (admin.apps.length === 0) {
    console.log("[FCM Send] Firebase Admin SDK not initialized. Skipping notification send.");
    return;
  }

  let tokens: { token: string }[] = [];
  try {
    if (fs.existsSync(TOKENS_FILE_PATH)) {
      const tokensData = fs.readFileSync(TOKENS_FILE_PATH, 'utf-8');
      tokens = JSON.parse(tokensData).map((t: any) => t.token).filter(Boolean);
    }
  } catch (e) {
    console.error("[FCM Send] Error reading FCM tokens file:", e);
    return;
  }

  if (tokens.length === 0) {
    console.log("[FCM Send] No FCM tokens found to send notifications.");
    return;
  }
  
  const uniqueTokens = [...new Set(tokens)];


  const message = {
    notification: {
      title: title,
      body: body,
    },
    webpush: {
      notification: {
        icon: '/images/logo.png', // Ensure this icon exists in public/images
      },
      fcmOptions: {
         link: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/announcements` : undefined,
      }
    },
    // tokens: uniqueTokens, // This is for multicast
  };

  // Sending to multiple tokens requires admin.messaging().sendEachForMulticast or sendEach
  // For simplicity, let's iterate or use sendToDevice if tokens array is small.
  // sendMulticast is better.
  if (uniqueTokens.length > 0) {
    const multicastMessage = { ...message, tokens: uniqueTokens };
    try {
      const response = await admin.messaging().sendEachForMulticast(multicastMessage);
      console.log(`[FCM Send] Notifications sent: ${response.successCount} success, ${response.failureCount} failure.`);
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`[FCM Send] Failure for token ${uniqueTokens[idx].substring(0,20)}...: ${resp.error}`);
            // TODO: Handle failed tokens (e.g., remove them from storage if unrecoverable error)
          }
        });
      }
    } catch (error) {
      console.error('[FCM Send] Error sending notifications:', error);
    }
  }
};


if (!initialized) {
  loadAnnouncementsFromFile();
  initialized = true;
}

export async function GET() {
  loadAnnouncementsFromFile(); 
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

  loadAnnouncementsFromFile(); 
  let currentDataFromFile = [...announcementsData.map(a => ({...a, comments: (a.comments || []).map(c => ({...c, replies: (c.replies || []).map(r => ({...r}))}))}))]; 
  let announcementModified = false;
  let modifiedAnnouncement: Announcement | null = null;
  let isNewAnnouncement = false;


  if ('action' in payload) {
    const actionPayload = payload;
    const annIndex = currentDataFromFile.findIndex(ann => ann.id === actionPayload.announcementId);

    if (annIndex === -1) {
        return NextResponse.json({ message: 'İlgili duyuru bulunamadı.' }, { status: 404 });
    }
    
    let announcementToUpdate = JSON.parse(JSON.stringify(currentDataFromFile[annIndex])) as Announcement;
    announcementToUpdate.likes = announcementToUpdate.likes || [];
    announcementToUpdate.comments = (announcementToUpdate.comments || []).map(c => ({
        ...c, 
        // likes removed
        replies: (c.replies || []).map(r => ({...r /* likes removed */ })),
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
        // likes: [], // likes removed
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
        // likes: [], // likes removed
      };
      commentToUpdate.replies.push(newReply);
      commentToUpdate.replies.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      announcementModified = true;
    } else if (actionPayload.action === "DELETE_COMMENT") {
      const commentIndex = announcementToUpdate.comments.findIndex(c => c.id === actionPayload.commentId);
      if (commentIndex === -1) {
        return NextResponse.json({ message: 'Silinecek yorum bulunamadı.' }, { status: 404 });
      }
      if (announcementToUpdate.comments[commentIndex].authorId !== actionPayload.deleterAuthorId) {
        return NextResponse.json({ message: 'Bu yorumu silme yetkiniz yok.' }, { status: 403 });
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
      if (commentToUpdate.replies[replyIndex].authorId !== actionPayload.deleterAuthorId) {
        return NextResponse.json({ message: 'Bu yanıtı silme yetkiniz yok.' }, { status: 403 });
      }
      commentToUpdate.replies.splice(replyIndex, 1);
      announcementModified = true;
    }
    
    if (announcementModified) {
        currentDataFromFile[annIndex] = announcementToUpdate;
        modifiedAnnouncement = announcementToUpdate;
    }

  } else { 
    const newAnnouncement = payload as Announcement; 
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
        // likes removed
        replies: (c.replies || []).map(r => ({...r /* likes removed */ })),
    })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const existingIndex = currentDataFromFile.findIndex(ann => ann.id === newAnnouncement.id);
    if (existingIndex !== -1) {
      currentDataFromFile[existingIndex] = newAnnouncement; 
    } else {
      currentDataFromFile.unshift(newAnnouncement);
      isNewAnnouncement = true; // Mark as new announcement
    }
    announcementModified = true;
    modifiedAnnouncement = newAnnouncement;
  }

  if (announcementModified) {
    currentDataFromFile.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (saveAnnouncementsToFile(currentDataFromFile)) {
      announcementsData = currentDataFromFile; 
      announcementEmitter.emit('update', [...announcementsData]);
      
      // If it's a new announcement, try to send FCM notifications
      if (isNewAnnouncement && modifiedAnnouncement) {
        // Do not await this, let it run in the background
        sendFcmNotifications(
          `Yeni Duyuru: ${modifiedAnnouncement.title}`,
          modifiedAnnouncement.content.substring(0, 100) + (modifiedAnnouncement.content.length > 100 ? "..." : "")
        ).catch(e => console.error("FCM Send Background Error:", e));
      }
      
      return NextResponse.json(modifiedAnnouncement || payload, { status: 'action' in payload ? 200 : 201 });
    } else {
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

  loadAnnouncementsFromFile(); 
  const currentDataFromFile = [...announcementsData];
  const filteredAnnouncements = currentDataFromFile.filter(ann => ann.id !== id);

  if (filteredAnnouncements.length < currentDataFromFile.length) {
    if (saveAnnouncementsToFile(filteredAnnouncements)) {
      announcementsData = filteredAnnouncements; 
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

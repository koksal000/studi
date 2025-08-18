
// src/app/api/announcements/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Announcement, Comment, Reply } from '@/hooks/use-announcements';
import fs from 'fs';
import path from 'path';
import { sendNotificationToAll, sendNotificationToUser } from '@/lib/fcm-service';

// Re-define AppNotification type here to avoid circular dependencies from route files
interface AppNotification {
  id: string;
  type: 'reply';
  recipientUserId: string;
  senderUserName: string;
  announcementId: string;
  announcementTitle: string;
  commentId: string;
  replyId?: string; // Link notification to a specific reply
  date: string;
  read: boolean;
}

const dataDir = process.env.DATA_PATH || process.cwd();
const ANNOUNCEMENTS_FILE_PATH = path.join(dataDir, '_announcements.json');
const NOTIFICATIONS_FILE_PATH = path.join(dataDir, '_notifications.json');

const MAX_IMAGE_RAW_SIZE_MB_API = 5;
const MAX_VIDEO_CONVERSION_RAW_SIZE_MB_API = 7;
const MAX_IMAGE_PAYLOAD_SIZE_API = Math.floor(MAX_IMAGE_RAW_SIZE_MB_API * 1024 * 1024 * 1.37 * 1.05);
const MAX_VIDEO_PAYLOAD_SIZE_API = Math.floor(MAX_VIDEO_CONVERSION_RAW_SIZE_MB_API * 1024 * 1024 * 1.37 * 1.05);

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
  deleterAuthorId: string;
}
interface DeleteReplyApiPayload {
  action: "DELETE_REPLY";
  announcementId: string;
  commentId: string;
  replyId: string;
  deleterAuthorId: string;
}
interface TogglePinApiPayload {
    action: "TOGGLE_PIN_ANNOUNCEMENT";
    announcementId: string;
}

type AnnouncementApiPayload =
  | ToggleAnnouncementLikeApiPayload
  | AddCommentApiPayload
  | AddReplyApiPayload
  | DeleteCommentApiPayload
  | DeleteReplyApiPayload
  | TogglePinApiPayload
  | Announcement;

const readAnnouncementsFromFile = (): Announcement[] => {
  try {
    if (fs.existsSync(ANNOUNCEMENTS_FILE_PATH)) {
      const fileData = fs.readFileSync(ANNOUNCEMENTS_FILE_PATH, 'utf-8');
      if (fileData.trim() === '') {
        return [];
      }
      const parsedData = JSON.parse(fileData) as Announcement[];
      return parsedData.map(ann => ({
        ...ann,
        likes: ann.likes || [],
        comments: (ann.comments || []).map(comment => ({
          ...comment,
          replies: (comment.replies || []).map(reply => ({
              ...reply,
          })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      return [];
    }
  } catch (error) {
    console.error("[API/Announcements] Error reading announcements from file:", error);
    return [];
  }
};

const writeAnnouncementsToFile = (data: Announcement[]): boolean => {
  try {
    const dir = path.dirname(ANNOUNCEMENTS_FILE_PATH);
    if (!fs.existsSync(dir) && dataDir !== process.cwd()) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const processedDataToSave = data.map(ann => ({
        ...ann,
        likes: ann.likes || [],
        comments: (ann.comments || []).map(comment => ({
            ...comment,
            replies: (comment.replies || []).map(reply => ({
                ...reply,
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

const readNotificationsFromFile = (): AppNotification[] => {
  try {
    if (fs.existsSync(NOTIFICATIONS_FILE_PATH)) {
      const fileData = fs.readFileSync(NOTIFICATIONS_FILE_PATH, 'utf-8');
      if (fileData.trim() === '') return [];
      return (JSON.parse(fileData) as AppNotification[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return [];
  } catch (error) {
    console.error("[API/Announcements->Notifications] Error reading notifications from file:", error);
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
    console.error("[API/Announcements->Notifications] CRITICAL: Error saving notifications to file:", error);
    return false;
  }
};


export async function GET() {
  const announcements = readAnnouncementsFromFile();
  return NextResponse.json(announcements);
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

  let announcements = readAnnouncementsFromFile();
  let announcementModified = false;
  let modifiedAnnouncement: Announcement | null = null;
  let isNewAnnouncement = false;

  if ('action' in payload) {
    const actionPayload = payload;
    const annIndex = announcements.findIndex(ann => ann.id === actionPayload.announcementId);

    if (annIndex === -1) {
        return NextResponse.json({ message: 'İlgili duyuru bulunamadı.' }, { status: 404 });
    }

    let announcementToUpdate = JSON.parse(JSON.stringify(announcements[annIndex])) as Announcement;
    announcementToUpdate.likes = announcementToUpdate.likes || [];
    announcementToUpdate.comments = (announcementToUpdate.comments || []).map(c => ({
        ...c,
        replies: (c.replies || []).map(r => ({...r})),
    }));

    if (actionPayload.action === "TOGGLE_ANNOUNCEMENT_LIKE") {
      const likeExistsIndex = announcementToUpdate.likes.findIndex(like => like.userId === actionPayload.userId);
      if (likeExistsIndex > -1) {
        announcementToUpdate.likes.splice(likeExistsIndex, 1);
      } else {
        announcementToUpdate.likes.push({ userId: actionPayload.userId });
      }
      announcementModified = true;
    } else if (actionPayload.action === "TOGGLE_PIN_ANNOUNCEMENT") {
        const announcementToPin = announcementToUpdate;
        
        if (!announcementToPin.isPinned) {
            const pinnedCount = announcements.filter(a => a.isPinned).length;
            if (pinnedCount >= 5) {
                return NextResponse.json({ message: "Maksimum 5 duyuru sabitlenebilir. Lütfen önce mevcut sabitlenmiş bir duyuruyu kaldırın." }, { status: 400 });
            }
        }

        announcementToUpdate.isPinned = !announcementToUpdate.isPinned;
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
      announcementModified = true;

      const { replyingToAuthorId } = actionPayload.reply;
      const { authorId: replierId, authorName: replierName, text: replyText } = newReply;
      
      console.log(`[API/Announcements] Reply detected. Replier: ${replierId}, Recipient: ${replyingToAuthorId}`);
      if (replyingToAuthorId && announcementToUpdate.title && replyingToAuthorId !== replierId) {
          console.log(`[API/Announcements] Conditions met. Creating notifications for ${replyingToAuthorId}.`);
          
          const allNotifications = readNotificationsFromFile();
          const newInAppNotification: AppNotification = {
              id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              type: 'reply', 
              recipientUserId: replyingToAuthorId, 
              senderUserName: replierName, 
              announcementId: actionPayload.announcementId, 
              announcementTitle: announcementToUpdate.title, 
              commentId: actionPayload.commentId,
              replyId: newReply.id,
              date: new Date().toISOString(),
              read: false,
          };
          allNotifications.unshift(newInAppNotification);
          writeNotificationsToFile(allNotifications);

          await sendNotificationToUser(replyingToAuthorId, {
            title: `${replierName} yorumunuza yanıt verdi`,
            body: `${replyText.substring(0, 100)}${replyText.length > 100 ? '...' : ''}`,
            link: '/announcements',
          });
      } else {
        console.log(`[API/Announcements] Notification conditions not met. Skipping notification. replyingToAuthorId: ${replyingToAuthorId}, title: ${!!announcementToUpdate.title}, is self-reply: ${replyingToAuthorId === replierId}`);
      }

    } else if (actionPayload.action === "DELETE_COMMENT") {
      const commentIndex = announcementToUpdate.comments.findIndex(c => c.id === actionPayload.commentId);
      if (commentIndex === -1) {
        return NextResponse.json({ message: 'Silinecek yorum bulunamadı.' }, { status: 404 });
      }
      const commentToDelete = announcementToUpdate.comments[commentIndex];
      if (commentToDelete.authorId !== actionPayload.deleterAuthorId && actionPayload.deleterAuthorId !== 'ADMIN_ACCOUNT') {
         console.warn(`[API/Announcements] Unauthorized attempt to delete comment ${actionPayload.commentId} by ${actionPayload.deleterAuthorId}. Owner is ${commentToDelete.authorId}`);
        return NextResponse.json({ message: 'Bu yorumu silme yetkiniz yok.' }, { status: 403 });
      }

      const replyIdsToDelete = (commentToDelete.replies || []).map(r => r.id);

      announcementToUpdate.comments.splice(commentIndex, 1);
      announcementModified = true;

      // Delete notifications for all replies within the deleted comment
      if (replyIdsToDelete.length > 0) {
          const allNotifications = readNotificationsFromFile();
          const filteredNotifications = allNotifications.filter(n => !replyIdsToDelete.includes(n.replyId!));
          if (allNotifications.length > filteredNotifications.length) {
              console.log(`[API/Announcements] Deleting ${allNotifications.length - filteredNotifications.length} notifications for deleted comment ${actionPayload.commentId}.`);
              writeNotificationsToFile(filteredNotifications);
          }
      }
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
      const replyToDelete = commentToUpdate.replies[replyIndex];
      if (replyToDelete.authorId !== actionPayload.deleterAuthorId && actionPayload.deleterAuthorId !== 'ADMIN_ACCOUNT') {
        console.warn(`[API/Announcements] Unauthorized attempt to delete reply ${actionPayload.replyId} by ${actionPayload.deleterAuthorId}. Owner is ${replyToDelete.authorId}`);
        return NextResponse.json({ message: 'Bu yanıtı silme yetkiniz yok.' }, { status: 403 });
      }
      commentToUpdate.replies.splice(replyIndex, 1);
      announcementModified = true;

      // Delete notification for the specific deleted reply
      const allNotificationsForDelete = readNotificationsFromFile();
      const filteredNotifications = allNotificationsForDelete.filter(n => n.replyId !== actionPayload.replyId);
      if (allNotificationsForDelete.length > filteredNotifications.length) {
          console.log(`[API/Announcements] Deleting notification associated with reply ${actionPayload.replyId}.`);
          writeNotificationsToFile(filteredNotifications);
      }
    }

    if (announcementModified) {
        announcements[annIndex] = announcementToUpdate;
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
        replies: (c.replies || []).map(r => ({...r})),
    })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    newAnnouncement.isPinned = newAnnouncement.isPinned || false;

    const existingIndex = announcements.findIndex(ann => ann.id === newAnnouncement.id);
    if (existingIndex !== -1) {
      const originalAnnouncement = announcements[existingIndex];
      announcements[existingIndex] = {
        ...newAnnouncement,
        date: originalAnnouncement.date,
        author: originalAnnouncement.author,
        authorId: originalAnnouncement.authorId,
        likes: originalAnnouncement.likes,
        comments: originalAnnouncement.comments,
        isPinned: originalAnnouncement.isPinned,
      };
    } else {
      announcements.unshift(newAnnouncement);
      isNewAnnouncement = true;
    }
    announcementModified = true;
    modifiedAnnouncement = newAnnouncement;
  }

  if (announcementModified) {
    announcements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (writeAnnouncementsToFile(announcements)) {
      if (isNewAnnouncement && modifiedAnnouncement) {
          sendNotificationToAll({
            title: 'Yeni Duyuru: Çamlıca Köyü',
            body: modifiedAnnouncement.title,
            link: '/announcements'
          }).catch(err => console.error("[API/Announcements] Failed to send push notification:", err));
      }
      return NextResponse.json(modifiedAnnouncement || payload, { status: 'action' in payload ? 200 : (isNewAnnouncement ? 201 : 200) });
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

  const announcements = readAnnouncementsFromFile();
  const announcementToDelete = announcements.find(ann => ann.id === id);

  if (announcementToDelete) {
    // Also delete all notifications associated with this announcement
    const allNotifications = readNotificationsFromFile();
    const filteredNotifications = allNotifications.filter(n => n.announcementId !== id);
    if (allNotifications.length > filteredNotifications.length) {
        console.log(`[API/Announcements] Deleting ${allNotifications.length - filteredNotifications.length} notifications for deleted announcement ${id}.`);
        writeNotificationsToFile(filteredNotifications);
    }
    
    const filteredAnnouncements = announcements.filter(ann => ann.id !== id);
    if (writeAnnouncementsToFile(filteredAnnouncements)) {
      return NextResponse.json({ message: 'Duyuru ve ilişkili bildirimler başarıyla silindi' }, { status: 200 });
    } else {
      console.error(`[API/Announcements] Failed to save after deleting announcement ${id} from file.`);
      return NextResponse.json({ message: 'Sunucu hatası: Duyuru silindikten sonra değişiklikler kalıcı olarak kaydedilemedi.' }, { status: 500 });
    }
  } else {
    return NextResponse.json({ message: 'Silinecek duyuru bulunamadı' }, { status: 404 });
  }
}

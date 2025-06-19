
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

// --- EmailJS Config (from user input) ---
const EMAILJS_SERVICE_ID = 'service_c8hlgh8';
const EMAILJS_TEMPLATE_ID = 'template_a5i8fuh';
const EMAILJS_PUBLIC_KEY = 'V4zUqX1G76vK-6j56'; // This is the User ID / Public Key
// For server-side sending to users, an Access Token from EmailJS dashboard (Account > API Keys) would be needed.
// Since it's not provided, this function will be conceptual for sending.

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

// Conceptual function to send email to a single user via EmailJS REST API
async function sendEmailNotificationViaEmailJS(
  recipientEmail: string,
  announcementTitle: string,
  announcementContentSummary: string,
  announcementLink: string
) {
  const templateParams = {
    to_email: recipientEmail,
    from_name: "Çamlıca Köyü Yönetimi", // Or your desired sender name
    subject: `Yeni Duyuru: ${announcementTitle}`,
    announcement_title: announcementTitle,
    announcement_summary: announcementContentSummary,
    announcement_link: announcementLink,
    // Add any other params your EmailJS template expects
  };

  const emailJsPayload = {
    service_id: EMAILJS_SERVICE_ID,
    template_id: EMAILJS_TEMPLATE_ID,
    user_id: EMAILJS_PUBLIC_KEY, // Public Key (User ID)
    template_params: templateParams,
    // accessToken: 'YOUR_EMAILJS_ACCESS_TOKEN' // IMPORTANT: Needed for server-side API calls
                                                 // This should be stored securely, e.g., as an env variable.
                                                 // User did not provide this.
  };
  
  console.log(`[EmailJS Send] Conceptual: Preparing to send email to ${recipientEmail} for announcement: ${announcementTitle}`);
  console.log(`[EmailJS Send] Payload (excluding access token): ${JSON.stringify(emailJsPayload, null, 2)}`);

  try {
    // IMPORTANT: The 'accessToken' is required for the EmailJS API when sending from the server.
    // Without it, this call will likely fail or be rejected by EmailJS.
    // User needs to generate an Access Token in their EmailJS account (Integrations -> API Keys)
    // and provide it, ideally via an environment variable.
    
    // const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(emailJsPayload),
    // });

    // if (response.ok) {
    //   console.log(`[EmailJS Send] Successfully sent email to ${recipientEmail}. Response: ${await response.text()}`);
    // } else {
    //   console.error(`[EmailJS Send] Failed to send email to ${recipientEmail}. Status: ${response.status}, Body: ${await response.text()}`);
    // }
    console.warn(`[EmailJS Send] SKIPPING ACTUAL EMAIL SEND for ${recipientEmail} as EmailJS Access Token is not configured for server-side use.`);

  } catch (error) {
    console.error(`[EmailJS Send] Error sending email to ${recipientEmail}:`, error);
  }
}


async function sendEmailNotifications(announcement: Announcement) {
  console.log(`[Email Send] Triggered for announcement: "${announcement.title}"`);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'; // Default if not set
  const announcementLink = `${appUrl}/announcements`; // Or a more specific link if available

  // PROBLEM: This API route does not have access to all users' emails or their notification preferences,
  // as that data is stored in client-side localStorage.
  // To implement this properly, user email and notification preferences would need to be stored
  // in a server-accessible database.

  console.warn("[Email Send] ARCHITECTURAL LIMITATION: Cannot access all users' emails and notification preferences from client-side localStorage. Conceptual sending logic follows.");

  // Example of how it *would* work if we had a list of opted-in users:
  const MOCK_OPTED_IN_USERS = [
    // { email: "user1@example.com", name: "User One" },
    // { email: "user2@example.com", name: "User Two" },
  ];

  if (MOCK_OPTED_IN_USERS.length === 0) {
    console.log("[Email Send] No mock opted-in users to send emails to. Real implementation needs a user database.");
    return;
  }

  for (const user of MOCK_OPTED_IN_USERS) {
    await sendEmailNotificationViaEmailJS(
      user.email,
      announcement.title,
      announcement.content.substring(0, 100) + (announcement.content.length > 100 ? "..." : ""),
      announcementLink
    );
  }
  console.log(`[Email Send] Conceptual email sending process completed for ${MOCK_OPTED_IN_USERS.length} mock users.`);
}


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
    } else if (actionPayload.action === "DELETE_COMMENT") {
      const commentIndex = announcementToUpdate.comments.findIndex(c => c.id === actionPayload.commentId);
      if (commentIndex === -1) {
        return NextResponse.json({ message: 'Silinecek yorum bulunamadı.' }, { status: 404 });
      }
      const commentToDelete = announcementToUpdate.comments[commentIndex];
      if (commentToDelete.authorId !== actionPayload.deleterAuthorId) {
         console.warn(`[API/Announcements] Unauthorized attempt to delete comment ${actionPayload.commentId} by ${actionPayload.deleterAuthorId}. Owner is ${commentToDelete.authorId}`);
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
      const replyToDelete = commentToUpdate.replies[replyIndex];
      if (replyToDelete.authorId !== actionPayload.deleterAuthorId) {
        console.warn(`[API/Announcements] Unauthorized attempt to delete reply ${actionPayload.replyId} by ${actionPayload.deleterAuthorId}. Owner is ${replyToDelete.authorId}`);
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
        replies: (c.replies || []).map(r => ({...r})),
    })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const existingIndex = currentDataFromFile.findIndex(ann => ann.id === newAnnouncement.id);
    if (existingIndex !== -1) {
      currentDataFromFile[existingIndex] = newAnnouncement; 
    } else {
      currentDataFromFile.unshift(newAnnouncement);
      isNewAnnouncement = true; 
    }
    announcementModified = true;
    modifiedAnnouncement = newAnnouncement;
  }

  if (announcementModified) {
    currentDataFromFile.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (saveAnnouncementsToFile(currentDataFromFile)) {
      announcementsData = currentDataFromFile; 
      announcementEmitter.emit('update', [...announcementsData]);
      
      if (isNewAnnouncement && modifiedAnnouncement) {
        console.log(`[API/Announcements] New announcement posted: "${modifiedAnnouncement.title}".`);
        // Trigger email notifications
        sendEmailNotifications(modifiedAnnouncement).catch(err => {
            console.error("[API/Announcements] Error during email notification process:", err);
        });
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

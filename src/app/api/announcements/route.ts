
// src/app/api/announcements/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Announcement, Comment, Reply } from '@/hooks/use-announcements'; 
import announcementEmitter from '@/lib/announcement-emitter';
import fs from 'fs';
import path from 'path';
import type { UserProfile } from '@/app/api/user-profile/route';
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';

const dataDir = process.env.DATA_PATH || process.cwd();
const ANNOUNCEMENTS_FILE_PATH = path.join(dataDir, '_announcements.json');
const USER_DATA_FILE_PATH = path.join(dataDir, '_user_data.json');

const MAX_IMAGE_RAW_SIZE_MB_API = 5;
const MAX_VIDEO_CONVERSION_RAW_SIZE_MB_API = 7;
const MAX_IMAGE_PAYLOAD_SIZE_API = Math.floor(MAX_IMAGE_RAW_SIZE_MB_API * 1024 * 1024 * 1.37 * 1.05);
const MAX_VIDEO_PAYLOAD_SIZE_API = Math.floor(MAX_VIDEO_CONVERSION_RAW_SIZE_MB_API * 1024 * 1024 * 1.37 * 1.05);

let announcementsData: Announcement[] = [];
let initializedFs = false;
let firebaseAdminInitialized = false;

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
    if (!initializedFs) console.log(`[API/Announcements] DATA_PATH used: ${dataDir}`);
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
      if (!initializedFs) console.log(`[API/Announcements] Successfully loaded ${announcementsData.length} announcements from file.`);
    } else {
      announcementsData = [];
      if (!initializedFs) console.log(`[API/Announcements] File ${ANNOUNCEMENTS_FILE_PATH} not found. Initializing with empty array.`);
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

function initializeFirebaseAdmin() {
    if (firebaseAdminInitialized) return;
    try {
        const serviceAccountPath = process.env.FIREBASE_ADMIN_SDK_SERVICE_ACCOUNT_PATH;
        const googleAppCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;

        if (admin.apps.length === 0) { // Check if SDK is already initialized
            if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
                const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
                console.log("[Firebase Admin] SDK initialized successfully via service account file.");
            } else if (googleAppCreds) {
                admin.initializeApp({
                    credential: admin.credential.applicationDefault()
                });
                console.log("[Firebase Admin] SDK initialized successfully via GOOGLE_APPLICATION_CREDENTIALS.");
            } else {
                console.error("[Firebase Admin] Firebase Admin SDK could not be initialized. Service account file path or GOOGLE_APPLICATION_CREDENTIALS not set or file not found.");
                return; // Do not set firebaseAdminInitialized to true
            }
        } else {
            console.log("[Firebase Admin] SDK already initialized.");
        }
        firebaseAdminInitialized = true;
    } catch (error) {
        console.error('[Firebase Admin] Error initializing Firebase Admin SDK:', error);
    }
}

const generateAnnouncementEmailHtml = (
    userName: string,
    announcementTitle: string,
    announcementContent: string,
    announcementLink: string,
    siteUrl: string,
    currentYear: number
): string => {
    // Sanitize content for HTML display
    const sanitizedContent = announcementContent
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\n/g, "<br />");

    return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Yeni Duyuru: ${announcementTitle}</title>
    <style type="text/css">
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f0f4f8; color: #333333; }
        table { border-collapse: collapse; }
        td { padding: 0; }
        .container { width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header-section { background-color: #4CAF50; padding: 40px 20px; text-align: center; color: #ffffff; }
        .header-section h1 { font-family: 'Montserrat', Arial, sans-serif; font-size: 28px; margin: 0 0 10px 0; line-height: 1.2; }
        .header-section p { font-size: 16px; margin: 0; }
        .button { display: inline-block; background-color: #3498db; color: #ffffff !important; padding: 12px 25px; border-radius: 25px; font-weight: bold; font-size: 16px; text-decoration: none; margin-top: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); -webkit-text-size-adjust: none; mso-hide: all; }
        .content-section { padding: 30px; text-align: left; color: #333333; }
        .content-section h2 { font-family: 'Montserrat', Arial, sans-serif; font-size: 24px; margin-top: 0; margin-bottom: 15px; color: #1a202c; text-align:center; }
        .content-section p.announcement-content { font-size: 15px; line-height: 1.8; margin-bottom: 15px; }
        .footer-section { background-color: #1a202c; color: #e2e8f0; padding: 30px; text-align: center; font-size: 13px; }
        .footer-section img { width: 40px; height: auto; margin: 0 5px 5px 5px; vertical-align: middle; }
        .footer-section p { margin: 0 0 5px 0; color: #b0b0b0; }
        .footer-logo-text { color: #ffffff; font-weight: bold; display: block; font-size: 10px; margin-top: 3px; }
    </style>
</head>
<body>
    <center>
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
                <td align="center" style="padding: 20px 0;">
                    <table class="container" border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                            <td class="header-section">
                                <h1>Merhaba ${userName},</h1>
                                <p>Çamlıca Köyü'nden yeni bir duyuru var!</p>
                            </td>
                        </tr>
                        <tr>
                            <td class="content-section">
                                <h2>${announcementTitle}</h2>
                                <p class="announcement-content">${sanitizedContent}</p>
                                <div style="text-align: center; margin-top: 25px;">
                                 <a href="${announcementLink}" class="button" target="_blank" rel="noopener noreferrer">Duyuruyu Sitede Gör</a>
                                </div>
                            </td>
                        </tr>
                         <tr>
                            <td class="footer-section">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:10px;">
                                    <tr>
                                        <td align="center">
                                            <img src="https://files.catbox.moe/c8jbn0.png" alt="Domaniç Çamlıca Köyü Logosu"><span class="footer-logo-text">Çamlıca Köyü Sitesi</span>
                                        </td>
                                    </tr>
                                </table>
                                <p>&copy; ${currentYear} Domaniç Çamlıca Köyü. Tüm Hakları Saklıdır.</p>
                                <p>Bu e-posta bildirimi, <a href="${siteUrl}/ayarlar" style="color: #b0b0b0; text-decoration: underline;">ayarlarınızda</a> e-posta bildirimlerini açık tuttuğunuz için gönderilmiştir.</p>
                                <p>Artık bildirim almak istemiyorsanız, site ayarlarından bu tercihinizi değiştirebilirsiniz.</p>
                                <p>site, domaniç çamlıca köyü için **Mücteba Köksal** tarafından tasarlanmıştır.</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </center>
</body>
</html>`;
};

async function sendEmailNotifications(announcement: Announcement) {
  console.log(`[Nodemailer Send] Triggered for announcement: "${announcement.title}"`);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
  const announcementLink = `${appUrl}/announcements`; // Link to the general announcements page

  let userProfiles: UserProfile[] = [];
  try {
    if (fs.existsSync(USER_DATA_FILE_PATH)) {
      const fileData = fs.readFileSync(USER_DATA_FILE_PATH, 'utf-8');
      userProfiles = JSON.parse(fileData) as UserProfile[];
    } else {
      console.warn(`[Nodemailer Send] User data file not found at ${USER_DATA_FILE_PATH}. No emails will be sent.`);
      return;
    }
  } catch (error) {
    console.error(`[Nodemailer Send] Error reading or parsing user data file:`, error);
    return;
  }

  const optedInUsers = userProfiles.filter(user => user.emailNotificationPreference);

  if (optedInUsers.length === 0) {
    console.log("[Nodemailer Send] No users opted-in for email notifications.");
    return;
  }

  console.log(`[Nodemailer Send] Found ${optedInUsers.length} users opted-in for email notifications.`);

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST,
    port: parseInt(process.env.EMAIL_SMTP_PORT || "587"),
    secure: parseInt(process.env.EMAIL_SMTP_PORT || "587") === 465, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_SMTP_USER,
      pass: process.env.EMAIL_SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: false // Sunucunuzun SSL sertifikası self-signed ise veya sorunluysa bunu ekleyebilirsiniz.
    }
  });
  
  if (!process.env.EMAIL_SMTP_HOST || !process.env.EMAIL_SMTP_USER || !process.env.EMAIL_SMTP_PASS || !process.env.EMAIL_FROM_ADDRESS) {
      console.error("[Nodemailer Send] SMTP configuration is missing in .env file. Cannot send emails.");
      return;
  }

  for (const user of optedInUsers) {
    if (user.email) {
      const emailHtml = generateAnnouncementEmailHtml(
        `${user.name} ${user.surname}`,
        announcement.title,
        announcement.content,
        announcementLink,
        appUrl,
        new Date().getFullYear()
      );

      const mailOptions = {
        from: process.env.EMAIL_FROM_ADDRESS,
        to: user.email,
        subject: `Yeni Duyuru: ${announcement.title}`,
        html: emailHtml,
      };

      try {
        let info = await transporter.sendMail(mailOptions);
        console.log(`[Nodemailer Send] Email sent successfully to ${user.email}. Message ID: ${info.messageId}`);
      } catch (error) {
        console.error(`[Nodemailer Send] Failed to send email to ${user.email}:`, error);
      }
    }
  }
  console.log(`[Nodemailer Send] Email sending process completed for ${optedInUsers.length} users.`);
}


if (!initializedFs) {
  loadAnnouncementsFromFile();
  initializedFs = true;
}
// Firebase Admin SDK initialization is not needed for Nodemailer directly
// initializeFirebaseAdmin(); // This was for FCM

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
        console.log(`[API/Announcements] New announcement posted: "${modifiedAnnouncement.title}". Triggering email notifications.`);
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

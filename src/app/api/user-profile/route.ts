
// src/app/api/user-profile/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export interface UserProfile {
  id: string; // email will be used as id
  name: string;
  surname: string;
  email: string;
  // emailNotificationPreference kaldırıldı
  joinedAt: string;
  lastUpdatedAt: string;
}

const dataDir = process.env.DATA_PATH || process.cwd();
const USER_DATA_FILE_PATH = path.join(dataDir, '_user_data.json');

let userProfilesData: UserProfile[] = [];

const loadUserProfilesFromFile = () => {
  try {
    // console.log(`[API/UserProfile] DATA_PATH used: ${dataDir}`); // Çok sık loglamaması için yorum satırı
    if (fs.existsSync(USER_DATA_FILE_PATH)) {
      const fileData = fs.readFileSync(USER_DATA_FILE_PATH, 'utf-8');
      if (fileData.trim() === '') {
        userProfilesData = [];
      } else {
        userProfilesData = JSON.parse(fileData) as UserProfile[];
      }
      // console.log(`[API/UserProfile] Successfully loaded ${userProfilesData.length} user profiles from file.`);
    } else {
      userProfilesData = [];
      // console.log(`[API/UserProfile] File ${USER_DATA_FILE_PATH} not found. Initializing with empty array.`);
      saveUserProfilesToFile(); 
    }
  } catch (error) {
    console.error("[API/UserProfile] Error loading user profiles file:", error);
    userProfilesData = [];
  }
};

const saveUserProfilesToFile = (): boolean => {
  try {
    const dir = path.dirname(USER_DATA_FILE_PATH);
    if (!fs.existsSync(dir) && dataDir !== process.cwd()) {
      fs.mkdirSync(dir, { recursive: true });
    }
    userProfilesData.sort((a, b) => a.email.localeCompare(b.email));
    fs.writeFileSync(USER_DATA_FILE_PATH, JSON.stringify(userProfilesData, null, 2));
    // console.log(`[API/UserProfile] User profiles data saved to ${USER_DATA_FILE_PATH}`);
    return true;
  } catch (error) {
    console.error("[API/UserProfile] CRITICAL: Error saving user profiles to file:", error);
    return false;
  }
};

loadUserProfilesFromFile();

export async function GET() {
  loadUserProfilesFromFile();
  return NextResponse.json(userProfilesData);
}

export async function POST(request: NextRequest) {
  let newProfileData: { name: string; surname: string; email: string };
  try {
    newProfileData = await request.json();
  } catch (error) {
    return NextResponse.json({ message: "Geçersiz JSON yükü." }, { status: 400 });
  }

  const { name, surname, email } = newProfileData;
  if (!name?.trim() || !surname?.trim() || !email?.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ message: 'Geçersiz kullanıcı verisi. Ad, soyad ve geçerli e-posta gereklidir.' }, { status: 400 });
  }

  loadUserProfilesFromFile(); 
  const existingProfileIndex = userProfilesData.findIndex(p => p.email.toLowerCase() === email.toLowerCase());
  const now = new Date().toISOString();

  if (existingProfileIndex !== -1) {
    userProfilesData[existingProfileIndex].name = name;
    userProfilesData[existingProfileIndex].surname = surname;
    userProfilesData[existingProfileIndex].lastUpdatedAt = now;
    // emailNotificationPreference ile ilgili bir işlem yok.
    console.log(`[API/UserProfile] Profile updated for email: ${email}`);
  } else {
    const newUserProfile: UserProfile = {
      id: email.toLowerCase(),
      name,
      surname,
      email: email.toLowerCase(),
      // emailNotificationPreference kaldırıldı
      joinedAt: now,
      lastUpdatedAt: now,
    };
    userProfilesData.push(newUserProfile);
    console.log(`[API/UserProfile] New profile created for email: ${email}`);
  }

  if (saveUserProfilesToFile()) {
    return NextResponse.json(userProfilesData.find(p => p.email.toLowerCase() === email.toLowerCase()), { status: existingProfileIndex !== -1 ? 200 : 201 });
  } else {
    loadUserProfilesFromFile(); 
    return NextResponse.json({ message: "Sunucu hatası: Kullanıcı profili kaydedilemedi." }, { status: 500 });
  }
}

// E-posta bildirim tercihlerini güncellemek için kullanılan PUT metodu kaldırıldı.
// export async function PUT(request: NextRequest) { ... }

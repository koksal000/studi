
// src/app/api/user-profile/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export interface UserProfile {
  id: string; // This will now be the anonymousId
  name: string;
  surname: string;
  email?: string | null; // Email is optional
  anonymousId: string;
  joinedAt: string;
  lastUpdatedAt: string;
}

const dataDir = process.env.DATA_PATH || process.cwd();
const USER_DATA_FILE_PATH = path.join(dataDir, '_user_data.json');

const readUserProfilesFromFile = (): UserProfile[] => {
  if (!fs.existsSync(USER_DATA_FILE_PATH)) {
    return [];
  }
  const fileData = fs.readFileSync(USER_DATA_FILE_PATH, 'utf-8');
  if (fileData.trim() === '') {
    return [];
  }
  try {
    return JSON.parse(fileData) as UserProfile[];
  } catch (error) {
    console.error("[API/UserProfile] CRITICAL: Could not parse _user_data.json. To prevent data loss, the operation will be aborted.", error);
    throw new Error("Kullanıcı veri dosyası okunamadı veya bozuk. Veri kaybını önlemek için işlem durduruldu.");
  }
};

const writeUserProfilesToFile = (profiles: UserProfile[]): boolean => {
  try {
    const dir = path.dirname(USER_DATA_FILE_PATH);
    if (!fs.existsSync(dir) && dataDir !== process.cwd()) {
      fs.mkdirSync(dir, { recursive: true });
    }
    profiles.sort((a, b) => a.anonymousId.localeCompare(b.anonymousId));
    fs.writeFileSync(USER_DATA_FILE_PATH, JSON.stringify(profiles, null, 2));
    return true;
  } catch (error) {
    console.error("[API/UserProfile] CRITICAL: Error saving user profiles to file:", error);
    return false;
  }
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId'); // Can be anonymousId or email

  const profiles = readUserProfilesFromFile();
  if (userId) {
      const profile = profiles.find(p => p.id === userId || p.anonymousId === userId || p.email === userId);
      if (profile) {
          return NextResponse.json(profile);
      }
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
  }

  return NextResponse.json(profiles);
}

export async function POST(request: NextRequest) {
  let newProfileData: Omit<UserProfile, 'id' | 'joinedAt' | 'lastUpdatedAt'>;
  try {
    newProfileData = await request.json();
  } catch (error) {
    return NextResponse.json({ message: "Geçersiz JSON yükü." }, { status: 400 });
  }

  const { name, surname, email, anonymousId } = newProfileData;
  if (!name?.trim() || !surname?.trim() || !anonymousId?.trim()) {
    return NextResponse.json({ message: 'Geçersiz kullanıcı verisi. Ad, soyad ve anonim ID gereklidir.' }, { status: 400 });
  }

  try {
    const profiles = readUserProfilesFromFile();
    const existingProfileIndex = profiles.findIndex(p => p.anonymousId === anonymousId);
    const now = new Date().toISOString();

    if (existingProfileIndex !== -1) {
      profiles[existingProfileIndex].name = name;
      profiles[existingProfileIndex].surname = surname;
      profiles[existingProfileIndex].email = email; // Update email (can be null)
      profiles[existingProfileIndex].lastUpdatedAt = now;
      console.log(`[API/UserProfile] Profile updated for anonymousId: ${anonymousId}`);
    } else {
      const newUserProfile: UserProfile = {
        id: anonymousId, // Use anonymousId as the main ID
        anonymousId,
        name,
        surname,
        email: email || null,
        joinedAt: now,
        lastUpdatedAt: now,
      };
      profiles.push(newUserProfile);
      console.log(`[API/UserProfile] New profile created for anonymousId: ${anonymousId}`);
    }

    if (writeUserProfilesToFile(profiles)) {
      const savedProfile = profiles.find(p => p.anonymousId === anonymousId);
      return NextResponse.json(savedProfile, { status: existingProfileIndex !== -1 ? 200 : 201 });
    } else {
      return NextResponse.json({ message: "Sunucu hatası: Kullanıcı profili kaydedilemedi." }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Kullanıcı profilleri işlenirken kritik bir sunucu hatası oluştu." }, { status: 500 });
  }
}

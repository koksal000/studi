
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
  joinedAt: string;
  lastUpdatedAt: string;
}

const dataDir = process.env.DATA_PATH || process.cwd();
const USER_DATA_FILE_PATH = path.join(dataDir, '_user_data.json');

const readUserProfilesFromFile = (): UserProfile[] => {
  try {
    if (fs.existsSync(USER_DATA_FILE_PATH)) {
      const fileData = fs.readFileSync(USER_DATA_FILE_PATH, 'utf-8');
      if (fileData.trim() === '') {
        return [];
      }
      return JSON.parse(fileData) as UserProfile[];
    } else {
      return [];
    }
  } catch (error) {
    console.error("[API/UserProfile] Error loading user profiles file:", error);
    return [];
  }
};

const writeUserProfilesToFile = (profiles: UserProfile[]): boolean => {
  try {
    const dir = path.dirname(USER_DATA_FILE_PATH);
    if (!fs.existsSync(dir) && dataDir !== process.cwd()) {
      fs.mkdirSync(dir, { recursive: true });
    }
    profiles.sort((a, b) => a.email.localeCompare(b.email));
    fs.writeFileSync(USER_DATA_FILE_PATH, JSON.stringify(profiles, null, 2));
    return true;
  } catch (error) {
    console.error("[API/UserProfile] CRITICAL: Error saving user profiles to file:", error);
    return false;
  }
};

export async function GET() {
  const profiles = readUserProfilesFromFile();
  return NextResponse.json(profiles);
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

  const profiles = readUserProfilesFromFile();
  const existingProfileIndex = profiles.findIndex(p => p.email.toLowerCase() === email.toLowerCase());
  const now = new Date().toISOString();

  if (existingProfileIndex !== -1) {
    profiles[existingProfileIndex].name = name;
    profiles[existingProfileIndex].surname = surname;
    profiles[existingProfileIndex].lastUpdatedAt = now;
    console.log(`[API/UserProfile] Profile updated for email: ${email}`);
  } else {
    const newUserProfile: UserProfile = {
      id: email.toLowerCase(),
      name,
      surname,
      email: email.toLowerCase(),
      joinedAt: now,
      lastUpdatedAt: now,
    };
    profiles.push(newUserProfile);
    console.log(`[API/UserProfile] New profile created for email: ${email}`);
  }

  if (writeUserProfilesToFile(profiles)) {
    const savedProfile = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
    return NextResponse.json(savedProfile, { status: existingProfileIndex !== -1 ? 200 : 201 });
  } else {
    return NextResponse.json({ message: "Sunucu hatası: Kullanıcı profili kaydedilemedi." }, { status: 500 });
  }
}

    
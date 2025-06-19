
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
  emailNotificationPreference: boolean;
  joinedAt: string;
  lastUpdatedAt: string;
}

const dataDir = process.env.DATA_PATH || process.cwd();
const USER_DATA_FILE_PATH = path.join(dataDir, '_user_data.json');

let userProfilesData: UserProfile[] = [];

const loadUserProfilesFromFile = () => {
  try {
    console.log(`[API/UserProfile] DATA_PATH used: ${dataDir}`);
    if (fs.existsSync(USER_DATA_FILE_PATH)) {
      const fileData = fs.readFileSync(USER_DATA_FILE_PATH, 'utf-8');
      if (fileData.trim() === '') {
        userProfilesData = [];
      } else {
        userProfilesData = JSON.parse(fileData) as UserProfile[];
      }
      console.log(`[API/UserProfile] Successfully loaded ${userProfilesData.length} user profiles from file.`);
    } else {
      userProfilesData = [];
      console.log(`[API/UserProfile] File ${USER_DATA_FILE_PATH} not found. Initializing with empty array.`);
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
    // Sort by joinedAt or email for consistency, if desired
    userProfilesData.sort((a, b) => a.email.localeCompare(b.email));
    fs.writeFileSync(USER_DATA_FILE_PATH, JSON.stringify(userProfilesData, null, 2));
    console.log(`[API/UserProfile] User profiles data saved to ${USER_DATA_FILE_PATH}`);
    return true;
  } catch (error) {
    console.error("[API/UserProfile] CRITICAL: Error saving user profiles to file:", error);
    return false;
  }
};

// Load profiles once on server start (for this simple file-based storage)
loadUserProfilesFromFile();

// Get all user profiles (potentially for admin use in future, ensure security)
export async function GET() {
  // In a real app, this endpoint should be secured.
  loadUserProfilesFromFile();
  return NextResponse.json(userProfilesData);
}

// Create or Update user profile (e.g., on first login)
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

  loadUserProfilesFromFile(); // Ensure latest data
  const existingProfileIndex = userProfilesData.findIndex(p => p.email.toLowerCase() === email.toLowerCase());
  const now = new Date().toISOString();

  if (existingProfileIndex !== -1) {
    // Update existing profile (name/surname might change if user re-enters)
    userProfilesData[existingProfileIndex].name = name;
    userProfilesData[existingProfileIndex].surname = surname;
    userProfilesData[existingProfileIndex].lastUpdatedAt = now;
    // Do not change emailNotificationPreference here, that's for PUT
    console.log(`[API/UserProfile] Profile updated for email: ${email}`);
  } else {
    // Create new profile
    const newUserProfile: UserProfile = {
      id: email.toLowerCase(),
      name,
      surname,
      email: email.toLowerCase(),
      emailNotificationPreference: true, // Default to true
      joinedAt: now,
      lastUpdatedAt: now,
    };
    userProfilesData.push(newUserProfile);
    console.log(`[API/UserProfile] New profile created for email: ${email}`);
  }

  if (saveUserProfilesToFile()) {
    return NextResponse.json(userProfilesData.find(p => p.email.toLowerCase() === email.toLowerCase()), { status: existingProfileIndex !== -1 ? 200 : 201 });
  } else {
    loadUserProfilesFromFile(); // Revert in-memory change
    return NextResponse.json({ message: "Sunucu hatası: Kullanıcı profili kaydedilemedi." }, { status: 500 });
  }
}

// Update email notification preference
export async function PUT(request: NextRequest) {
  let updateData: { email: string; emailNotificationPreference: boolean };
  try {
    updateData = await request.json();
  } catch (error) {
    return NextResponse.json({ message: "Geçersiz JSON yükü." }, { status: 400 });
  }

  const { email, emailNotificationPreference } = updateData;
  if (!email?.trim() || typeof emailNotificationPreference !== 'boolean') {
    return NextResponse.json({ message: 'Geçersiz güncelleme verisi. E-posta ve tercih durumu (true/false) gereklidir.' }, { status: 400 });
  }

  loadUserProfilesFromFile(); // Ensure latest data
  const profileIndex = userProfilesData.findIndex(p => p.email.toLowerCase() === email.toLowerCase());

  if (profileIndex === -1) {
    return NextResponse.json({ message: 'Güncellenecek kullanıcı profili bulunamadı.' }, { status: 404 });
  }

  userProfilesData[profileIndex].emailNotificationPreference = emailNotificationPreference;
  userProfilesData[profileIndex].lastUpdatedAt = new Date().toISOString();
  console.log(`[API/UserProfile] Email notification preference updated for ${email} to ${emailNotificationPreference}`);

  if (saveUserProfilesToFile()) {
    return NextResponse.json(userProfilesData[profileIndex], { status: 200 });
  } else {
    loadUserProfilesFromFile(); // Revert in-memory change
    return NextResponse.json({ message: "Sunucu hatası: Kullanıcı tercihi güncellenemedi." }, { status: 500 });
  }
}

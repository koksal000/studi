
// src/app/api/stats/entry-count/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface EntryStats {
  entryCount: number;
}

const dataDir = process.env.DATA_PATH || process.cwd();
const STATS_FILE_PATH = path.join(dataDir, '_entry_stats.json');

let entryStats: EntryStats = { entryCount: 0 };
let initialized = false;

const loadEntryStatsFromFile = () => {
  try {
    if (!initialized) console.log(`[API/EntryStats] DATA_PATH used: ${dataDir}`);
    if (fs.existsSync(STATS_FILE_PATH)) {
      const fileData = fs.readFileSync(STATS_FILE_PATH, 'utf-8');
      if (fileData.trim() === '') {
        entryStats = { entryCount: 0 };
      } else {
        entryStats = JSON.parse(fileData) as EntryStats;
      }
      if (!initialized) console.log(`[API/EntryStats] Successfully loaded entry stats: Count = ${entryStats.entryCount}`);
    } else {
      entryStats = { entryCount: 0 };
      if (!initialized) console.log(`[API/EntryStats] File ${STATS_FILE_PATH} not found. Initializing with count 0 and attempting to create.`);
      saveEntryStatsToFile(); 
    }
  } catch (error) {
    console.error("[API/EntryStats] Error loading entry stats file:", error);
    entryStats = { entryCount: 0 };
  }
};

const saveEntryStatsToFile = (): boolean => {
  try {
    const dir = path.dirname(STATS_FILE_PATH);
    if (!fs.existsSync(dir) && dataDir !== process.cwd()) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATS_FILE_PATH, JSON.stringify(entryStats, null, 2));
    return true;
  } catch (error) {
    console.error("[API/EntryStats] CRITICAL: Error saving entry stats to file:", error);
    return false;
  }
};

if (!initialized) {
  loadEntryStatsFromFile();
  initialized = true;
}

export async function GET() {
  loadEntryStatsFromFile(); // Ensure fresh data
  return NextResponse.json(entryStats);
}

export async function POST(request: NextRequest) {
  loadEntryStatsFromFile(); // Load current count before incrementing
  
  entryStats.entryCount += 1;

  if (saveEntryStatsToFile()) {
    console.log(`[API/EntryStats] Entry count incremented and saved. New count: ${entryStats.entryCount}`);
    return NextResponse.json(entryStats, { status: 200 });
  } else {
    // Attempt to revert in-memory change if save failed
    entryStats.entryCount -= 1; 
    console.error(`[API/EntryStats] Failed to save incremented entry count. Count remains ${entryStats.entryCount} in memory for this instance.`);
    return NextResponse.json({ message: "Sunucu hatası: Katılım sayısı kaydedilemedi." }, { status: 500 });
  }
}

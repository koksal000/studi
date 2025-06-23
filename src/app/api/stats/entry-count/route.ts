
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

const readStatsFromFile = (): EntryStats => {
  try {
    if (fs.existsSync(STATS_FILE_PATH)) {
      const fileData = fs.readFileSync(STATS_FILE_PATH, 'utf-8');
      if (fileData.trim() === '') {
        return { entryCount: 0 };
      }
      return JSON.parse(fileData) as EntryStats;
    } else {
      return { entryCount: 0 };
    }
  } catch (error) {
    console.error("[API/EntryStats] Error loading entry stats file:", error);
    return { entryCount: 0 };
  }
};

const writeStatsToFile = (stats: EntryStats): boolean => {
  try {
    const dir = path.dirname(STATS_FILE_PATH);
    if (!fs.existsSync(dir) && dataDir !== process.cwd()) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATS_FILE_PATH, JSON.stringify(stats, null, 2));
    return true;
  } catch (error) {
    console.error("[API/EntryStats] CRITICAL: Error saving entry stats to file:", error);
    return false;
  }
};

export async function GET() {
  const stats = readStatsFromFile();
  return NextResponse.json(stats);
}

export async function POST(request: NextRequest) {
  const stats = readStatsFromFile();
  
  stats.entryCount += 1;

  if (writeStatsToFile(stats)) {
    console.log(`[API/EntryStats] Entry count incremented and saved. New count: ${stats.entryCount}`);
    return NextResponse.json(stats, { status: 200 });
  } else {
    console.error(`[API/EntryStats] Failed to save incremented entry count.`);
    return NextResponse.json({ message: "Sunucu hatası: Katılım sayısı kaydedilemedi." }, { status: 500 });
  }
}

    
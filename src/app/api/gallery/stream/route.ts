
// src/app/api/gallery/stream/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // This stream is no longer used. The client now fetches data directly.
  // Returning a 404 to indicate the endpoint is not available.
  return NextResponse.json({ message: "This real-time stream is disabled." }, { status: 404 });
}

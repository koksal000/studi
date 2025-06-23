
// src/app/api/contact/stream/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { message: "This real-time stream endpoint is disabled and no longer in use." }, 
    { status: 410 } // 410 Gone
  );
}

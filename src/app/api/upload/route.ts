// src/app/api/upload/route.ts
import { NextResponse, type NextRequest } from 'next/server';

const CATBOX_API_URL = 'https://catbox.moe/user/api.php';
const USER_HASH = process.env.CATBOX_USER_HASH || null;

// Helper function to convert data URI to Blob
function dataURItoBlob(dataURI: string): Blob {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const { fileDataUri, fileName } = requestBody;

    if (!fileDataUri || !fileName) {
      return NextResponse.json({ message: 'Missing file data or file name.' }, { status: 400 });
    }

    const fileBlob = dataURItoBlob(fileDataUri);

    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    if (USER_HASH) {
      formData.append('userhash', USER_HASH);
    }
    formData.append('fileToUpload', fileBlob, fileName);

    const response = await fetch(CATBOX_API_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API/Upload] Catbox API Error (${response.status}):`, errorText);
      return NextResponse.json({ message: `Catbox API error: ${errorText}` }, { status: response.status });
    }

    const responseText = await response.text();
    
    // Check if the response is a valid URL
    if (responseText.startsWith('http')) {
      return NextResponse.json({ url: responseText }, { status: 200 });
    } else {
      console.error('[API/Upload] Catbox did not return a valid URL:', responseText);
      return NextResponse.json({ message: `Upload failed, Catbox response: ${responseText}` }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[API/Upload] Internal Server Error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.', error: error.message }, { status: 500 });
  }
}

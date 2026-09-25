import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { MAX_PHOTO_SIZE_BYTES } from '@/lib/constants'

// Issues short-lived client-upload tokens so the browser can send the photo
// directly to Vercel Blob (no route handler ever sees the file bytes).
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await getSession()
        if (!session || session.role !== 'tutor') {
          throw new Error('Not authenticated.')
        }
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_PHOTO_SIZE_BYTES,
        }
      },
      onUploadCompleted: async ({ blob }) => {
        // Not relied upon — doesn't fire on localhost without a tunnel. The
        // client persists photoUrl itself via PUT /api/tutor/me once upload()
        // resolves, which works in both dev and production.
        console.log('[tutor/photo/upload] blob upload completed', blob.url)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}

import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { auth } from '@/auth'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest): Promise<Response> {
  const body = (await req.json()) as HandleUploadBody

  // Only authenticate token-generation requests — upload-completed callbacks
  // come from Vercel Blob servers and have no user session.
  if (body.type === 'blob.generate-client-token') {
    const session = await auth()
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        maximumSizeInBytes: 10 * 1024 * 1024,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // no-op: proxy URL is constructed on the client from blob.url
      },
    })
    return Response.json(jsonResponse)
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 })
  }
}

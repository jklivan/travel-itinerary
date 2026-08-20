import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { auth } from '@/auth'
import { NextRequest } from 'next/server'

export async function GET(): Promise<Response> {
  return Response.json({ error: 'Method Not Allowed' }, { status: 405 })
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: HandleUploadBody
  try {
    body = (await req.json()) as HandleUploadBody
  } catch {
    console.error('[upload] Failed to parse request body as JSON — content-type:', req.headers.get('content-type'))
    return Response.json({ error: 'Request body must be JSON' }, { status: 400 })
  }

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
      }),
    })
    return Response.json(jsonResponse)
  } catch (error) {
    console.error('[upload] handleUpload error:', error)
    return Response.json({ error: (error as Error).message }, { status: 400 })
  }
}

import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { auth } from '@/auth'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest): Promise<Response> {
  let body: HandleUploadBody
  try {
    body = (await req.json()) as HandleUploadBody
  } catch {
    console.error('[upload-doc] Failed to parse request body as JSON — content-type:', req.headers.get('content-type'))
    return Response.json({ error: 'Request body must be JSON' }, { status: 400 })
  }

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
        allowedContentTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'text/plain',
          'text/html',
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
        ],
        maximumSizeInBytes: 100 * 1024 * 1024,
      }),
    })
    return Response.json(jsonResponse)
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 })
  }
}

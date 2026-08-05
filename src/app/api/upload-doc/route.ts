import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { auth } from '@/auth'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest): Promise<Response> {
  const body = (await req.json()) as HandleUploadBody

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
        maximumSizeInBytes: 25 * 1024 * 1024,
      }),
      onUploadCompleted: async () => {},
    })
    return Response.json(jsonResponse)
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 })
  }
}

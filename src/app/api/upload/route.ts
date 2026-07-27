import { auth } from '@/auth'
import { put } from '@vercel/blob'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
  if (!allowed.includes(file.type)) {
    return Response.json({ error: 'Invalid file type' }, { status: 400 })
  }

  try {
    const blob = await put(file.name, file, { access: 'private' })
    const proxyUrl = `/api/img?url=${encodeURIComponent(blob.url)}`
    return Response.json({ url: proxyUrl })
  } catch (err) {
    console.error('[upload] blob put failed:', err)
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }
}

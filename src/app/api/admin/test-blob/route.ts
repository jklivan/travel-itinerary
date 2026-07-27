import { NextRequest } from 'next/server'
import { put, del } from '@vercel/blob'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return Response.json({ ok: false, error: 'BLOB_READ_WRITE_TOKEN not set' })

  try {
    const blob = await put('_test.txt', 'test', { access: 'public' })
    await del(blob.url)
    return Response.json({ ok: true, url: blob.url })
  } catch (err) {
    return Response.json({ ok: false, error: String(err) })
  }
}

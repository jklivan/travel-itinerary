import { NextRequest } from 'next/server'
import { get } from '@vercel/blob'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return new Response('Missing url', { status: 400 })

  // Only proxy Vercel Blob URLs
  try {
    const { hostname } = new URL(url)
    if (!hostname.endsWith('.blob.vercel-storage.com')) {
      return new Response('Invalid url', { status: 400 })
    }
  } catch {
    return new Response('Invalid url', { status: 400 })
  }

  try {
    const blob = await get(url, { access: 'private' })
    if (!blob) return new Response('Not found', { status: 404 })

    const res = await fetch(blob.url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    })
    if (!res.ok) return new Response('Blob fetch failed', { status: 502 })

    return new Response(res.body, {
      headers: {
        'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    console.error('[img proxy] error:', err)
    return new Response('Error', { status: 500 })
  }
}

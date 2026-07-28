import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return new Response('Missing url', { status: 400 })

  // Only proxy Vercel Blob URLs
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    return new Response('Invalid url', { status: 400 })
  }
  if (!hostname.endsWith('.blob.vercel-storage.com')) {
    return new Response('Invalid url', { status: 400 })
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return new Response('Token not configured', { status: 500 })

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return new Response('Blob fetch failed', { status: res.status })

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

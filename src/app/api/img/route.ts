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
    const result = await get(url, { access: 'private' })
    if (!result) return new Response('Not found', { status: 404 })

    return new Response(result.stream, {
      headers: {
        'Content-Type': result.headers.get('Content-Type') ?? result.blob.contentType ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    console.error('[img proxy] error:', err)
    return new Response('Error', { status: 500 })
  }
}

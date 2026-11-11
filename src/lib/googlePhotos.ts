import { put } from '@vercel/blob'

// Google Photos Picker (https://developers.google.com/photos/picker): the person picks photos in Google's own screen and
// Postcard gets only those. The access token comes from the person's browser or app each time and is never stored.
const API = 'https://photospicker.googleapis.com/v1'
const MAX_PHOTOS = 100

async function call<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers }, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Google Photos ${response.status}`)
  return response.json() as Promise<T>
}

export async function createSession(token: string) {
  const session = await call<{ id: string; pickerUri: string; pollingConfig?: { pollInterval?: string } }>(token, '/sessions', { method: 'POST', body: JSON.stringify({ pickingConfig: { maxItemCount: String(MAX_PHOTOS) } }) })
  return { id: session.id, pickerUri: session.pickerUri, pollMs: Math.max(2000, Math.round(parseFloat(session.pollingConfig?.pollInterval ?? '3') * 1000) || 3000) }
}

export async function sessionDone(token: string, id: string) {
  const session = await call<{ mediaItemsSet?: boolean }>(token, `/sessions/${encodeURIComponent(id)}`)
  return !!session.mediaItemsSet
}

type Item = { type?: string; mediaFile?: { baseUrl: string; mimeType?: string; filename?: string } }

// The picked photos (not videos), copied into Postcard's storage at a good size; returns their app addresses in order.
export async function importPicked(token: string, id: string) {
  const items: Item[] = []
  let pageToken = ''
  do {
    const page = await call<{ mediaItems?: Item[]; nextPageToken?: string }>(token, `/mediaItems?sessionId=${encodeURIComponent(id)}&pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`)
    items.push(...(page.mediaItems ?? []))
    pageToken = page.nextPageToken ?? ''
  } while (pageToken && items.length < MAX_PHOTOS)
  const photos = items.filter(item => item.type !== 'VIDEO' && item.mediaFile?.baseUrl).slice(0, MAX_PHOTOS)
  const urls: (string | null)[] = photos.map(() => null)
  let next = 0
  async function worker() {
    while (next < photos.length) {
      const index = next++
      try {
        const file = photos[index].mediaFile!
        const response = await fetch(`${file.baseUrl}=w2048-h2048`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) })
        if (!response.ok) continue
        const type = response.headers.get('content-type') || 'image/jpeg'
        const blob = await put(`event-${crypto.randomUUID()}-google.${type.includes('png') ? 'png' : 'jpg'}`, Buffer.from(await response.arrayBuffer()), { access: 'private', contentType: type })
        urls[index] = `/api/img?url=${encodeURIComponent(blob.url)}`
      } catch { /* skipped; the rest still come in */ }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  // Done with the session (Google deletes it anyway after a while).
  await fetch(`${API}/sessions/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
  return { urls: urls.filter((url): url is string => !!url), skipped: photos.length - urls.filter(Boolean).length }
}

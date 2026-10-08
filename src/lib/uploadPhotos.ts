'use client'

import { upload } from '@vercel/blob/client'
import { compressPhoto } from '@/lib/photoSizing'

// Shrinks each photo, then uploads up to three at a time, keeping the order they were picked in. Returns the
// photos' app URLs (in order) and how many failed (over 10 MB once shrunk, or the upload failed).
export async function uploadPhotos(files: File[], onProgress?: (done: number) => void) {
  const added: (string | null)[] = files.map(() => null)
  let failed = 0, done = 0, next = 0
  async function worker() {
    while (next < files.length) {
      const index = next++
      try {
        const file = await compressPhoto(files[index])
        if (file.size > 10 * 1024 * 1024) { failed++; continue }
        const blob = await upload(`event-${crypto.randomUUID()}-${file.name}`, file, { access: 'private', handleUploadUrl: '/api/upload' })
        added[index] = `/api/img?url=${encodeURIComponent(blob.url)}`
      } catch { failed++ } finally { onProgress?.(++done) }
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return { urls: added.filter((url): url is string => !!url), failed }
}

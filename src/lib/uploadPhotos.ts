'use client'

import { upload } from '@vercel/blob/client'
import { compressPhoto, MAX_PHOTO_BYTES, MAX_PHOTO_MB } from '@/lib/photoSizing'
import { reportClientError } from '@/lib/clientErrors'

// Shrinks each photo, then uploads up to three at a time, keeping the order they were picked in. Returns the
// photos' app URLs (in order), how many failed, and why the first one failed (shown to the person, and sent to
// the server logs with the file's type and size so problems can be tracked down).
export async function uploadPhotos(files: File[], onProgress?: (done: number) => void) {
  const added: (string | null)[] = files.map(() => null)
  let failed = 0, done = 0, next = 0
  let reason = ''
  let reported = 0
  async function worker() {
    while (next < files.length) {
      const index = next++
      const original = files[index]
      try {
        const file = withType(await compressPhoto(original))
        if (file.size > MAX_PHOTO_BYTES) throw new Error(`over ${MAX_PHOTO_MB} MB`)
        const blob = await upload(`event-${crypto.randomUUID()}-${file.name}`, file, { access: 'private', handleUploadUrl: '/api/upload' })
        added[index] = `/api/img?url=${encodeURIComponent(blob.url)}`
      } catch (error) {
        failed++
        const message = error instanceof Error ? error.message : String(error)
        reason ||= message
        // A few reports per batch is enough to see the cause.
        if (reported++ < 3) reportClientError('photo-upload', `${message} | type=${original.type || 'none'} size=${(original.size / 1048576).toFixed(1)}MB ext=${original.name.split('.').pop()?.toLowerCase() ?? ''}`)
      } finally { onProgress?.(++done) }
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return { urls: added.filter((url): url is string => !!url), failed, reason }
}

// "3 photos couldn't be uploaded (over 25 MB)." in plain words for the common causes.
export function uploadFailureMessage(failed: number, reason: string) {
  const plain = /over \d+ MB|maximumSizeInBytes|too large|exceeds/i.test(reason) ? `files must be under ${MAX_PHOTO_MB} MB`
    : /content type|not allowed|contentType/i.test(reason) ? 'that photo format isn’t supported; try JPEG or PNG'
    : /network|fetch|timed out|offline/i.test(reason) ? 'the connection dropped; try again'
    : reason || 'please try again'
  return `${failed} photo${failed === 1 ? '' : 's'} couldn’t be uploaded (${plain}).`
}

// Some phones and browsers hand over photos with no type (e.g. a HEIC the browser can't read); storage refuses those,
// so take the type from the file name.
const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif' }
function withType(file: File) {
  if (file.type) return file
  const type = TYPES[file.name.split('.').pop()?.toLowerCase() ?? '']
  return type ? new File([file], file.name, { type }) : file
}

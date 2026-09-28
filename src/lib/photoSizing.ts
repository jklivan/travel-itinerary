// Photos are uploaded and shown far smaller than a phone camera's originals (often 3–8 MB).

const MAX_EDGE = 2048
const QUALITY = 0.82

// Shrinks a photo in the browser before upload: longest edge at most 2048 px, JPEG. Returns the original
// file for GIFs, small files, or anything the browser can't decode, so an upload is never blocked.
export async function compressPhoto(file: File): Promise<File> {
  if (file.type === 'image/gif' || file.size < 400 * 1024 || typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch { return file }
}

// A resized, CDN-cached copy for display, via Next's image optimizer. Widths must be one of Next's
// configured sizes (e.g. 256, 640, 1080). Hosts the optimizer doesn't allow are returned unchanged.
export function sizedPhoto(url: string, width: 256 | 640 | 1080) {
  const optimizable = url.startsWith('/api/img?') || /^https:\/\/([^/]+\.public\.blob\.vercel-storage\.com|images\.pexels\.com|images\.unsplash\.com)\//.test(url)
  return optimizable ? `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=75` : url
}

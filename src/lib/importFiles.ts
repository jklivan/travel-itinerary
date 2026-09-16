import { upload } from '@vercel/blob/client'

type RawDestItem = { type: string; mealType?: string; rating?: number; name: string; notes?: string; link?: string; dayIndex?: number }
type RawDest = { name?: string; country?: string; items?: RawDestItem[] }
type ExtractionData = { title?: string; description?: string; startDate?: string; endDate?: string; notes?: string; destinations?: RawDest[] }

// Binary files (images, PDFs, XLSX) are uploaded to Vercel Blob to avoid the 4.5MB
// function body limit. The public Blob URL is sent to the API route instead of base64.
const MAX_IMPORT_FILE_SIZE = 100 * 1024 * 1024
// Base64 expands an image by roughly one third. Keep direct requests comfortably
// below server request limits; larger images use the more reliable Blob route.
const DIRECT_IMAGE_LIMIT = 2 * 1024 * 1024
const IMPORT_TIMEOUT_MS = 5 * 60 * 1000

export async function readFileForUpload(
  file: File,
  externalSignal?: AbortSignal,
): Promise<{ text: string } | { base64: string; mediaType: string } | { blobUrl: string; mediaType: string; filename: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mime = file.type
  const isPdf = ext === 'pdf' || mime === 'application/pdf'
  const isDocx = ext === 'docx' || mime.includes('wordprocessingml')
  const isXlsx = ext === 'xlsx' || ext === 'xls' || mime.includes('spreadsheet') || mime.includes('excel')
  const isImage = mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
  const isHtml = ext === 'html' || ext === 'htm' || mime === 'text/html'

  // Small screenshots can go directly to vision. This avoids a second network
  // hop through Blob and keeps the common import path fast and reliable.
  if (isImage && file.size <= DIRECT_IMAGE_LIMIT) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read image.'))
      reader.readAsDataURL(file)
    })
    return { base64: dataUrl.split(',')[1], mediaType: file.type || 'image/jpeg' }
  }

  // Word docs are small — read directly as base64, no Blob upload needed
  if (isDocx) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        resolve(dataUrl.split(',')[1])
      }
      reader.onerror = () => reject(new Error('Failed to read file.'))
      reader.readAsDataURL(file)
    })
    return { base64, mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
  }

  if (isPdf || isXlsx || isImage) {
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      throw new Error('Files must be 100 MB or smaller.')
    }
    const ext2 = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
    const uniqueName = `extractions/${Date.now()}-${Math.random().toString(36).slice(2)}${ext2}`
    const controller = new AbortController()
    const cancelUpload = () => controller.abort()
    externalSignal?.addEventListener('abort', cancelUpload, { once: true })
    const timeout = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS)
    let blob: Awaited<ReturnType<typeof upload>>
    try {
      blob = await upload(uniqueName, file, {
        access: isPdf ? 'private' : 'public',
        handleUploadUrl: '/api/upload-doc',
        abortSignal: controller.signal,
        // Multipart is for genuinely large uploads. For normal PDFs it adds an
        // unnecessary control-plane round trip and can stall before extraction.
        multipart: file.size > 10 * 1024 * 1024,
      })
    } catch (err) {
      if (externalSignal?.aborted) throw new Error('Import cancelled.')
      if (controller.signal.aborted) throw new Error('Upload timed out. Please check your connection and try again.')
      throw err
    } finally {
      clearTimeout(timeout)
      externalSignal?.removeEventListener('abort', cancelUpload)
    }
    const mediaType = file.type || (isPdf ? 'application/pdf' : isDocx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : isImage ? 'image/jpeg' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    return { blobUrl: blob.url, mediaType, filename: file.name }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      let text = (e.target?.result as string) ?? ''
      if (isHtml) {
        const doc = new DOMParser().parseFromString(text, 'text/html')
        text = doc.body.textContent ?? text
      }
      resolve({ text })
    }
    reader.readAsText(file)
    reader.onerror = () => reject(new Error('Failed to read file.'))
  })
}

export async function fetchExtraction(payload: { text: string } | { base64: string; mediaType: string } | { blobUrl: string; mediaType: string; filename: string }, label = 'your file', externalSignal?: AbortSignal): Promise<ExtractionData> {
    if ('text' in payload && !payload.text.trim()) throw new Error('No text to extract from.')
    let lastError: unknown
    // Retrying is safe: extraction only reads the document and does not write data.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (externalSignal?.aborted) throw new Error('Import cancelled.')
      const controller = new AbortController()
      const cancelReading = () => controller.abort()
      externalSignal?.addEventListener('abort', cancelReading, { once: true })
      const timeout = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS)
      try {
        const res = await fetch('/api/extract-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        // Keep the timeout and Cancel listener active until the body is read.
        if (res.ok) {
          const data = await res.json()
          if (externalSignal?.aborted) throw new Error('Import cancelled.')
          return data
        }
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Extraction failed.')
      } catch (err) {
        lastError = err
        if (externalSignal?.aborted) throw new Error('Import cancelled.')
        if (controller.signal.aborted) throw new Error(`Reading ${label} timed out. Please try that file again.`)
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 750))
      } finally {
        clearTimeout(timeout)
        externalSignal?.removeEventListener('abort', cancelReading)
      }
    }
    const detail = lastError instanceof Error && lastError.message ? ` (${lastError.message})` : ''
    throw new Error(`Could not read ${label}. Please try again.${detail}`)
  }


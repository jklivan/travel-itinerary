'use client'

import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { ImageIcon, X } from 'lucide-react'
import { eventPhotos } from '@/lib/eventPhotos'
import { compressPhoto, sizedPhoto } from '@/lib/photoSizing'

export default function EventPhotoInput({ photos, name, onChange, onBusyChange, showThumbnails = true }: {
  showThumbnails?: boolean
  photos: string[]
  name: string
  onChange: (photos: string[]) => void
  onBusyChange: (busy: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const uploading = useRef(false)
  const [error, setError] = useState('')
  async function addPhotos(files: File[]) {
    if (uploading.current || !files.length) return
    uploading.current = true
    setBusy(true)
    setError('')
    onBusyChange(true)
    const added: (string | null)[] = files.map(() => null)
    let failed = 0
    try {
      // Shrink each photo first, then upload up to three at a time, keeping the order they were picked in.
      let next = 0
      async function worker() {
        while (next < files.length) {
          const index = next++
          try {
            const file = await compressPhoto(files[index])
            if (file.size > 10 * 1024 * 1024) { failed++; continue }
            const blob = await upload(`event-${crypto.randomUUID()}-${file.name}`, file, { access: 'private', handleUploadUrl: '/api/upload' })
            added[index] = `/api/img?url=${encodeURIComponent(blob.url)}`
          } catch { failed++ }
        }
      }
      await Promise.all([worker(), worker(), worker()])
      const uploaded = added.filter((url): url is string => !!url)
      if (uploaded.length) onChange(eventPhotos([...photos, ...uploaded]))
      if (failed) setError(`${failed} photo${failed === 1 ? '' : 's'} could not be added. Use files under 10 MB and try again.`)
    } finally {
      uploading.current = false
      setBusy(false)
      onBusyChange(false)
    }
  }
  return <div className="px-3 pb-2 pt-1 space-y-2">
    {showThumbnails && photos.length > 0 && <div className="flex flex-wrap gap-2">
      {photos.map((url, index) => <div key={url} className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sizedPhoto(url, 256)} alt={`${name}, photo ${index + 1}`} className="h-16 w-16 rounded-lg object-cover" />
        <button type="button" disabled={busy} onClick={() => onChange(photos.filter(photo => photo !== url))} aria-label={`Remove photo ${index + 1} for ${name}`} className="absolute -top-1 -right-1 rounded-full bg-[#2e4147] p-1 text-white disabled:opacity-50"><X size={12} /></button>
      </div>)}
    </div>}
    <label className={`inline-flex items-center gap-1.5 text-xs font-medium text-[#59694f] ${busy ? 'opacity-50' : 'cursor-pointer'}`}>
      <ImageIcon size={14} />{busy ? 'Uploading…' : photos.length ? 'Add more photos' : 'Add photos'}
      <input type="file" multiple accept="image/*" className="sr-only" disabled={busy} aria-label={`Add photos for ${name}`} onChange={event => {
        const files = Array.from(event.target.files ?? [])
        event.target.value = ''
        void addPhotos(files)
      }} />
    </label>
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </div>
}

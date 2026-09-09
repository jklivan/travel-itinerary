'use client'

import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { ImageIcon, X } from 'lucide-react'
import { eventPhotos } from '@/lib/eventPhotos'

export default function EventPhotoInput({ photos, name, onChange, onBusyChange }: {
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
    const added: string[] = []
    let failed = 0
    try {
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) { failed++; continue }
        try {
          const blob = await upload(`event-${crypto.randomUUID()}-${file.name}`, file, { access: 'private', handleUploadUrl: '/api/upload' })
          added.push(`/api/img?url=${encodeURIComponent(blob.url)}`)
        } catch { failed++ }
      }
      if (added.length) onChange(eventPhotos([...photos, ...added]))
      if (failed) setError(`${failed} photo${failed === 1 ? '' : 's'} could not be added. Use files under 10 MB and try again.`)
    } finally {
      uploading.current = false
      setBusy(false)
      onBusyChange(false)
    }
  }
  return <div className="px-3 pb-2 pt-1 space-y-2">
    {photos.length > 0 && <div className="flex flex-wrap gap-2">
      {photos.map((url, index) => <div key={url} className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`${name}, photo ${index + 1}`} className="h-16 w-16 rounded-lg object-cover" />
        <button type="button" disabled={busy} onClick={() => onChange(photos.filter(photo => photo !== url))} aria-label={`Remove photo ${index + 1} for ${name}`} className="absolute -top-1 -right-1 rounded-full bg-[#2e4147] p-1 text-white disabled:opacity-50"><X size={12} /></button>
      </div>)}
    </div>}
    <label className={`inline-flex items-center gap-1.5 text-xs font-medium text-[#507c76] ${busy ? 'opacity-50' : 'cursor-pointer'}`}>
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

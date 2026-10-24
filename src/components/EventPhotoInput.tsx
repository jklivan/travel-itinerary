'use client'

import { useCallback, useContext, useRef, useState } from 'react'
import { ImageIcon, X } from 'lucide-react'
import { eventPhotos } from '@/lib/eventPhotos'
import { sizedPhoto } from '@/lib/photoSizing'
import { uploadFailureMessage, uploadPhotos } from '@/lib/uploadPhotos'
import { canPickTripPhotos, TripDates } from '@/lib/tripPhotos'
import TripPhotoPicker from './TripPhotoPicker'

// large: a big dashed tile, where adding photos is the main thing on screen (the snapshot composer's first step).
export default function EventPhotoInput({ photos, name, onChange, onBusyChange, showThumbnails = true, large = false }: {
  large?: boolean
  showThumbnails?: boolean
  photos: string[]
  name: string
  onChange: (photos: string[]) => void
  onBusyChange: (busy: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const uploading = useRef(false)
  const [error, setError] = useState('')
  // In the iPhone app, "Add photos" opens your photos by date (the trip's dates when it has them); the usual picker is one tap away.
  const tripDates = useContext(TripDates)
  const [pickingTrip, setPickingTrip] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const closeTripPicker = useCallback(() => setPickingTrip(false), [])
  const openLibrary = useCallback(() => fileInput.current?.click(), [])
  async function addPhotos(files: File[]) {
    if (uploading.current || !files.length) return
    uploading.current = true
    setBusy(true)
    setError('')
    onBusyChange(true)
    try {
      const { urls: uploaded, failed, reason } = await uploadPhotos(files)
      if (uploaded.length) onChange(eventPhotos([...photos, ...uploaded]))
      if (failed) setError(uploadFailureMessage(failed, reason))
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
        <button type="button" disabled={busy} onClick={() => onChange(photos.filter(photo => photo !== url))} aria-label={`Remove photo ${index + 1} for ${name}`} className="absolute -top-1 -right-1 rounded-full bg-ink p-1 text-white disabled:opacity-50"><X size={12} /></button>
      </div>)}
    </div>}
    <label onClick={event => { if (event.target !== fileInput.current && canPickTripPhotos() && !busy) { event.preventDefault(); setPickingTrip(true) } }} className={large ? `panel-dashed flex min-h-40 w-full flex-col items-center justify-center gap-2 text-base font-semibold text-link ${busy ? 'opacity-50' : 'cursor-pointer hover:bg-cream'}` : `inline-flex items-center gap-1.5 text-xs font-medium text-link ${busy ? 'opacity-50' : 'cursor-pointer'}`}>
      {large ? <ImageIcon size={28} /> : <ImageIcon size={14} />}{busy ? 'Uploading…' : photos.length ? 'Add more photos' : 'Add photos'}
      <input ref={fileInput} type="file" multiple accept="image/*" className="sr-only" disabled={busy} aria-label={`Add photos for ${name}`} onChange={event => {
        const files = Array.from(event.target.files ?? [])
        event.target.value = ''
        void addPhotos(files)
      }} />
    </label>
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    {pickingTrip && <TripPhotoPicker start={tripDates?.start} end={tripDates?.end} name={name} onPick={files => void addPhotos(files)} onFallback={openLibrary} onClose={closeTripPicker} />}
  </div>
}

'use client'

import { useCallback, useContext, useRef, useState } from 'react'
import { ImageIcon, X } from 'lucide-react'
import { eventPhotos } from '@/lib/eventPhotos'
import { sizedPhoto } from '@/lib/photoSizing'
import { uploadPhotos } from '@/lib/uploadPhotos'
import { canPickTripPhotos, TripDates } from '@/lib/tripPhotos'
import TripPhotoPicker from './TripPhotoPicker'

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
  // In the iPhone app on a dated trip, "Add photos" opens that trip's photos; the usual picker is one tap away.
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
      const { urls: uploaded, failed } = await uploadPhotos(files)
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
        <button type="button" disabled={busy} onClick={() => onChange(photos.filter(photo => photo !== url))} aria-label={`Remove photo ${index + 1} for ${name}`} className="absolute -top-1 -right-1 rounded-full bg-ink p-1 text-white disabled:opacity-50"><X size={12} /></button>
      </div>)}
    </div>}
    <label onClick={event => { if (event.target !== fileInput.current && tripDates && canPickTripPhotos() && !busy) { event.preventDefault(); setPickingTrip(true) } }} className={`inline-flex items-center gap-1.5 text-xs font-medium text-link ${busy ? 'opacity-50' : 'cursor-pointer'}`}>
      <ImageIcon size={14} />{busy ? 'Uploading…' : photos.length ? 'Add more photos' : 'Add photos'}
      <input ref={fileInput} type="file" multiple accept="image/*" className="sr-only" disabled={busy} aria-label={`Add photos for ${name}`} onChange={event => {
        const files = Array.from(event.target.files ?? [])
        event.target.value = ''
        void addPhotos(files)
      }} />
    </label>
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    {pickingTrip && tripDates && <TripPhotoPicker start={tripDates.start} end={tripDates.end} name={name} onPick={files => void addPhotos(files)} onFallback={openLibrary} onClose={closeTripPicker} />}
  </div>
}

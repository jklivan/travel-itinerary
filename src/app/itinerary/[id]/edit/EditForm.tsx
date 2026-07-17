'use client'

import { useActionState, useState } from 'react'
import { updateItinerary } from '@/actions/itinerary'

type DestItem = {
  type: 'hotel' | 'food_drink' | 'activity'
  name: string
  notes: string
  rating: number
  link: string
}
type Destination = { name: string; country: string; items: DestItem[] }
type UploadedPhoto = { url: string; caption: string }

type ItineraryData = {
  id: string
  title: string
  description: string | null
  startDate: Date
  endDate: Date
  audience: string
  visibility: string
  notes: string | null
  destinations: {
    name: string
    country: string | null
    items: { type: string; name: string; notes: string | null; rating: number | null; link: string | null }[]
  }[]
  photos: { url: string; caption: string | null }[]
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-900 mb-1'

function fmt(d: Date) {
  return new Date(d).toISOString().slice(0, 10)
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button"
          onClick={() => onChange(value === star ? 0 : star)}
          className="text-lg leading-none focus:outline-none"
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}>
          <span className={star <= value ? 'text-yellow-400' : 'text-gray-300'}>★</span>
        </button>
      ))}
    </div>
  )
}

function ItemRow({
  item, onUpdate, onRemove,
}: {
  item: DestItem
  onUpdate: (field: keyof DestItem, val: string) => void
  onRemove: () => void
}) {
  const placeholder =
    item.type === 'hotel'
      ? 'e.g. The Marriott, Airbnb, Hostel name'
      : item.type === 'food_drink'
      ? 'e.g. Ramen Ichiran, Rooftop bar, Street market'
      : 'e.g. Temple tour, Hiking, Museum visit'

  return (
    <div className="flex gap-2 items-start">
      <div className="flex-1 space-y-1">
        <input type="text" value={item.name}
          onChange={(e) => onUpdate('name', e.target.value)}
          className={inputClass} placeholder={placeholder} />
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 shrink-0">Rate it!</span>
          <StarRating value={item.rating} onChange={(v) => onUpdate('rating', String(v))} />
        </div>
        <input type="text" value={item.notes}
          onChange={(e) => onUpdate('notes', e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          placeholder="Notes (optional)" />
        <input type="url" value={item.link}
          onChange={(e) => onUpdate('link', e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          placeholder="🔗 Link (optional)" />
      </div>
      <button type="button" onClick={onRemove}
        className="mt-1.5 text-gray-400 hover:text-red-500 text-xl leading-none">×</button>
    </div>
  )
}

const emptyItem = (type: DestItem['type'] = 'activity'): DestItem => ({
  type, name: '', notes: '', rating: 0, link: '',
})
const emptyDest = (): Destination => ({ name: '', country: '', items: [] })

const sections: { type: DestItem['type']; label: string; icon: string; btnLabel: string }[] = [
  { type: 'hotel',      label: 'Hotels',      icon: '🏨', btnLabel: '+ Add hotel' },
  { type: 'food_drink', label: 'Food & Drink', icon: '🍜', btnLabel: '+ Add place' },
  { type: 'activity',   label: 'Activities',  icon: '🎯', btnLabel: '+ Add activity' },
]

export default function EditForm({ itinerary }: { itinerary: ItineraryData }) {
  const boundAction = updateItinerary.bind(null, itinerary.id)
  const [state, action, pending] = useActionState(boundAction, undefined)

  const [title, setTitle] = useState(itinerary.title)
  const [description, setDescription] = useState(itinerary.description ?? '')
  const [startDate, setStartDate] = useState(fmt(itinerary.startDate))
  const [endDate, setEndDate] = useState(fmt(itinerary.endDate))
  const [isAdult, setIsAdult] = useState(itinerary.audience === 'adult')
  const [isPrivate, setIsPrivate] = useState(itinerary.visibility === 'private')
  const [notes, setNotes] = useState(itinerary.notes ?? '')
  const [destinations, setDestinations] = useState<Destination[]>(
    itinerary.destinations.length > 0
      ? itinerary.destinations.map((d) => ({
          name: d.name,
          country: d.country ?? '',
          items: d.items.map((item) => ({
            type: item.type as DestItem['type'],
            name: item.name,
            notes: item.notes ?? '',
            rating: item.rating ?? 0,
            link: item.link ?? '',
          })),
        }))
      : [emptyDest()]
  )
  const [photos, setPhotos] = useState<UploadedPhoto[]>(
    itinerary.photos.map((p) => ({ url: p.url, caption: p.caption ?? '' }))
  )
  const [uploading, setUploading] = useState(false)

  function addDest() { setDestinations((d) => [...d, emptyDest()]) }
  function removeDest(i: number) { setDestinations((d) => d.filter((_, idx) => idx !== i)) }
  function updateDest(i: number, field: 'name' | 'country', val: string) {
    setDestinations((d) => d.map((dest, idx) => idx === i ? { ...dest, [field]: val } : dest))
  }
  function addItem(destIdx: number, type: DestItem['type']) {
    setDestinations((d) => d.map((dest, i) =>
      i === destIdx ? { ...dest, items: [...dest.items, emptyItem(type)] } : dest
    ))
  }
  function removeItem(destIdx: number, itemIdx: number) {
    setDestinations((d) => d.map((dest, i) =>
      i === destIdx ? { ...dest, items: dest.items.filter((_, j) => j !== itemIdx) } : dest
    ))
  }
  function updateItem(destIdx: number, itemIdx: number, field: keyof DestItem, val: string) {
    setDestinations((d) => d.map((dest, i) =>
      i === destIdx ? {
        ...dest,
        items: dest.items.map((item, j) =>
          j === itemIdx ? { ...item, [field]: field === 'rating' ? Number(val) : val } : item
        ),
      } : dest
    ))
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    const uploaded: UploadedPhoto[] = []
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const { url } = await res.json()
        uploaded.push({ url, caption: '' })
      }
    }
    setPhotos((p) => [...p, ...uploaded])
    setUploading(false)
    e.target.value = ''
  }
  function removePhoto(i: number) { setPhotos((p) => p.filter((_, idx) => idx !== i)) }
  function updateCaption(i: number, val: string) {
    setPhotos((p) => p.map((ph, idx) => idx === i ? { ...ph, caption: val } : ph))
  }

  const byType = (dest: Destination, type: DestItem['type']) =>
    dest.items.filter((it) => it.type === type)

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="destinations" value={JSON.stringify(destinations)} />
      <input type="hidden" name="photos" value={JSON.stringify(photos)} />
      <input type="hidden" name="audience" value={isAdult ? 'adult' : 'family'} />
      <input type="hidden" name="visibility" value={isPrivate ? 'private' : 'public'} />

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {state.error}
        </p>
      )}

      {/* Basic Info */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Basic Info</h2>
        <div>
          <label htmlFor="title" className={labelClass}>Title *</label>
          <input id="title" name="title" type="text" required className={inputClass}
            value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor="description" className={labelClass}>Short description</label>
          <textarea id="description" name="description" rows={2} className={inputClass}
            value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className={labelClass}>Start date *</label>
            <input id="startDate" name="startDate" type="date" required className={inputClass}
              value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="endDate" className={labelClass}>End date *</label>
            <input id="endDate" name="endDate" type="date" required className={inputClass}
              value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div onClick={() => setIsAdult((v) => !v)}
            className={`w-10 h-6 rounded-full transition-colors relative ${isAdult ? 'bg-rose-500' : 'bg-gray-200'}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isAdult ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
          <span className="text-sm text-gray-900">
            Adults only{isAdult ? <span className="ml-1 text-rose-600 font-medium">(18+)</span> : ''}
          </span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div onClick={() => setIsPrivate((v) => !v)}
            className={`w-10 h-6 rounded-full transition-colors relative ${isPrivate ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
          <span className="text-sm text-gray-900">
            {isPrivate ? 'Private — only visible to you' : 'Public — visible to everyone'}
          </span>
        </label>
      </section>

      {/* Destinations */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-lg">Destinations</h2>
          <button type="button" onClick={addDest}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            + Add destination
          </button>
        </div>

        {destinations.map((dest, destIdx) => (
          <div key={destIdx} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <div className="flex gap-3 items-start">
              <div className="flex-1 grid grid-cols-2 gap-3">
                <input type="text" value={dest.name}
                  onChange={(e) => updateDest(destIdx, 'name', e.target.value)}
                  className={inputClass}
                  placeholder={`City / place${destinations.length > 1 ? ` ${destIdx + 1}` : ''}`} />
                <input type="text" value={dest.country}
                  onChange={(e) => updateDest(destIdx, 'country', e.target.value)}
                  className={inputClass} placeholder="Country" />
              </div>
              {destinations.length > 1 && (
                <button type="button" onClick={() => removeDest(destIdx)}
                  className="mt-1 text-gray-400 hover:text-red-500 text-xl leading-none">×</button>
              )}
            </div>

            {sections.map(({ type, label, icon, btnLabel }) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    {icon} {label}
                  </p>
                  <button type="button" onClick={() => addItem(destIdx, type)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    {btnLabel}
                  </button>
                </div>
                {byType(dest, type).length === 0 && (
                  <p className="text-xs text-gray-600 italic">None added yet.</p>
                )}
                {dest.items.map((item, itemIdx) =>
                  item.type !== type ? null : (
                    <ItemRow key={itemIdx} item={item}
                      onUpdate={(field, val) => updateItem(destIdx, itemIdx, field, val)}
                      onRemove={() => removeItem(destIdx, itemIdx)} />
                  )
                )}
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* Notes */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">General Notes</h2>
        <textarea name="notes" rows={3} className={inputClass}
          placeholder="Tips, packing list, visa info…"
          value={notes} onChange={(e) => setNotes(e.target.value)} />
      </section>

      {/* Photos */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Photos</h2>
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-indigo-400 transition-colors">
          <span className="text-2xl mb-2">📸</span>
          <span className="text-sm font-medium text-gray-900">
            {uploading ? 'Uploading…' : 'Click to upload photos'}
          </span>
          <span className="text-xs text-gray-600 mt-1">JPG, PNG, WEBP, GIF</span>
          <input type="file" accept="image/*" multiple className="sr-only"
            onChange={handlePhotoUpload} disabled={uploading} />
        </label>
        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photo, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" className="w-full h-32 object-cover rounded-lg" />
                <button type="button" onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  ×
                </button>
                <input type="text" value={photo.caption}
                  onChange={(e) => updateCaption(i, e.target.value)}
                  className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  placeholder="Caption (optional)" />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex gap-3">
        <button type="submit" disabled={pending || uploading}
          className="flex-1 bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-60 text-base">
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

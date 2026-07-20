'use client'

import { useActionState, useState } from 'react'
import { updateItinerary } from '@/actions/itinerary'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'

type FoodItem     = { name: string; mealType: string; notes: string; link: string; rating: number }
type ActivityItem = { name: string; notes: string; link: string; rating: number }
type StayGroup    = { hotelName: string; hotelNotes: string; hotelLink: string; hotelRating: number; food: FoodItem[]; activities: ActivityItem[] }
type Destination  = { name: string; country: string; groups: StayGroup[] }
type UploadedPhoto = { url: string; caption: string }

type ItineraryData = {
  id: string
  postType: string
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
    items: { type: string; mealType?: string | null; name: string; notes: string | null; rating: number | null; link: string | null; groupIndex?: number }[]
  }[]
  photos: { url: string; caption: string | null }[]
}

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const subInputClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400'
const labelClass = 'block text-sm font-medium text-gray-900 mb-1'

function fmt(d: Date) { return new Date(d).toISOString().slice(0, 10) }

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => onChange(value === star ? 0 : star)}
          className="text-lg leading-none focus:outline-none" aria-label={`${star} star${star !== 1 ? 's' : ''}`}>
          <span className={star <= value ? 'text-yellow-400' : 'text-gray-300'}>★</span>
        </button>
      ))}
    </div>
  )
}

const MEAL_TYPES = ['lunch', 'dinner', 'drinks'] as const

function FoodRow({ item, index, onUpdate, onRemove, showRating }: {
  item: FoodItem; index: number
  onUpdate: (field: keyof FoodItem, val: string) => void
  onRemove: () => void; showRating: boolean
}) {
  const rowBg = index % 2 === 0 ? 'bg-gray-50' : 'bg-gray-100'
  return (
    <div className={`rounded-xl border border-l-4 border-l-orange-400 ${rowBg} p-4 space-y-3`}>
      <div className="flex gap-2 items-start">
        <PlacesAutocomplete
          value={item.name}
          onChange={val => onUpdate('name', val)}
          type="restaurant"
          placeholder="e.g. Ramen Ichiran, Rooftop bar, Street market"
          className={inputClass}
        />
        <button type="button" onClick={onRemove} className="mt-1.5 text-gray-400 hover:text-red-500 text-xl leading-none shrink-0">×</button>
      </div>
      <div className="flex gap-1 flex-wrap">
        {MEAL_TYPES.map(mt => (
          <button key={mt} type="button" onClick={() => onUpdate('mealType', item.mealType === mt ? '' : mt)}
            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors capitalize ${item.mealType === mt ? mt === 'lunch' ? 'bg-orange-500 text-white border-orange-500' : mt === 'dinner' ? 'bg-purple-600 text-white border-purple-600' : 'bg-blue-500 text-white border-blue-500' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
            {mt === 'lunch' ? '☀️' : mt === 'dinner' ? '🌙' : '🍹'} {mt}
          </button>
        ))}
      </div>
      {showRating && <div className="flex items-center gap-2"><span className="text-xs text-gray-600 shrink-0">Rate it!</span><StarRating value={item.rating} onChange={v => onUpdate('rating', String(v))} /></div>}
      <div className="grid gap-2">
        <input type="text" value={item.notes} onChange={e => onUpdate('notes', e.target.value)} className={subInputClass} placeholder="📝 Notes (optional)" />
        <input type="url" value={item.link} onChange={e => onUpdate('link', e.target.value)} className={subInputClass} placeholder="🔗 Website link (optional)" />
      </div>
    </div>
  )
}

function ActivityRow({ item, index, onUpdate, onRemove, showRating }: {
  item: ActivityItem; index: number
  onUpdate: (field: keyof ActivityItem, val: string) => void
  onRemove: () => void; showRating: boolean
}) {
  const rowBg = index % 2 === 0 ? 'bg-gray-50' : 'bg-gray-100'
  return (
    <div className={`rounded-xl border border-l-4 border-l-green-400 ${rowBg} p-4 space-y-3`}>
      <div className="flex gap-2 items-start">
        <PlacesAutocomplete
          value={item.name}
          onChange={val => onUpdate('name', val)}
          type="activity"
          placeholder="e.g. Temple tour, Hiking, Museum visit"
          className={inputClass}
        />
        <button type="button" onClick={onRemove} className="mt-1.5 text-gray-400 hover:text-red-500 text-xl leading-none shrink-0">×</button>
      </div>
      {showRating && <div className="flex items-center gap-2"><span className="text-xs text-gray-600 shrink-0">Rate it!</span><StarRating value={item.rating} onChange={v => onUpdate('rating', String(v))} /></div>}
      <div className="grid gap-2">
        <input type="text" value={item.notes} onChange={e => onUpdate('notes', e.target.value)} className={subInputClass} placeholder="📝 Notes (optional)" />
        <input type="url" value={item.link} onChange={e => onUpdate('link', e.target.value)} className={subInputClass} placeholder="🔗 Website link (optional)" />
      </div>
    </div>
  )
}

const emptyFood     = (): FoodItem     => ({ name: '', mealType: '', notes: '', link: '', rating: 0 })
const emptyActivity = (): ActivityItem => ({ name: '', notes: '', link: '', rating: 0 })
const emptyGroup    = (): StayGroup    => ({ hotelName: '', hotelNotes: '', hotelLink: '', hotelRating: 0, food: [], activities: [] })
const emptyDest     = (): Destination  => ({ name: '', country: '', groups: [emptyGroup()] })

function itemsToGroups(items: ItineraryData['destinations'][0]['items']): StayGroup[] {
  const byGi = new Map<number, typeof items>()
  for (const item of items) {
    const gi = item.groupIndex ?? 0
    if (!byGi.has(gi)) byGi.set(gi, [])
    byGi.get(gi)!.push(item)
  }
  if (byGi.size === 0) return [emptyGroup()]
  return [...byGi.entries()].sort(([a], [b]) => a - b).map(([, grpItems]) => {
    const hotel = grpItems.find(i => i.type === 'hotel')
    return {
      hotelName: hotel?.name ?? '',
      hotelNotes: hotel?.notes ?? '',
      hotelLink: hotel?.link ?? '',
      hotelRating: hotel?.rating ?? 0,
      food: grpItems.filter(i => i.type === 'food_drink').map(f => ({ name: f.name, mealType: f.mealType ?? '', notes: f.notes ?? '', link: f.link ?? '', rating: f.rating ?? 0 })),
      activities: grpItems.filter(i => i.type === 'activity').map(a => ({ name: a.name, notes: a.notes ?? '', link: a.link ?? '', rating: a.rating ?? 0 })),
    }
  })
}

export default function EditForm({ itinerary }: { itinerary: ItineraryData }) {
  const boundAction = updateItinerary.bind(null, itinerary.id)
  const [state, action, pending] = useActionState(boundAction, undefined)

  const [postType, setPostType] = useState<'itinerary' | 'guide'>(itinerary.postType === 'guide' ? 'guide' : 'itinerary')
  const [title, setTitle] = useState(itinerary.title)
  const [description, setDescription] = useState(itinerary.description ?? '')
  const [startDate, setStartDate] = useState(fmt(itinerary.startDate))
  const [endDate, setEndDate] = useState(fmt(itinerary.endDate))
  const [isAdult, setIsAdult] = useState(itinerary.audience === 'adult')
  const [isPrivate, setIsPrivate] = useState(itinerary.visibility === 'private')
  const [notes, setNotes] = useState(itinerary.notes ?? '')
  const [destinations, setDestinations] = useState<Destination[]>(
    itinerary.destinations.length > 0
      ? itinerary.destinations.map(d => ({ name: d.name, country: d.country ?? '', groups: itemsToGroups(d.items) }))
      : [emptyDest()]
  )
  const [photos, setPhotos] = useState<UploadedPhoto[]>(itinerary.photos.map(p => ({ url: p.url, caption: p.caption ?? '' })))
  const [uploading, setUploading] = useState(false)

  const showRating = postType === 'itinerary'

  function addDest() { setDestinations(d => [...d, emptyDest()]) }
  function removeDest(i: number) { setDestinations(d => d.filter((_, idx) => idx !== i)) }
  function updateDest(i: number, field: 'name' | 'country', val: string) {
    setDestinations(d => d.map((dest, idx) => idx === i ? { ...dest, [field]: val } : dest))
  }
  function updGroup(di: number, gi: number, fn: (g: StayGroup) => StayGroup) {
    setDestinations(d => d.map((dest, i) => i !== di ? dest : { ...dest, groups: dest.groups.map((g, j) => j !== gi ? g : fn(g)) }))
  }
  function addGroup(di: number) { setDestinations(d => d.map((dest, i) => i !== di ? dest : { ...dest, groups: [...dest.groups, emptyGroup()] })) }
  function removeGroup(di: number, gi: number) { setDestinations(d => d.map((dest, i) => i !== di ? dest : { ...dest, groups: dest.groups.filter((_, j) => j !== gi) })) }
  function updateHotel(di: number, gi: number, field: keyof StayGroup, val: string) {
    updGroup(di, gi, g => ({ ...g, [field]: field === 'hotelRating' ? Number(val) : val }))
  }
  function addFood(di: number, gi: number) { updGroup(di, gi, g => ({ ...g, food: [...g.food, emptyFood()] })) }
  function removeFood(di: number, gi: number, ii: number) { updGroup(di, gi, g => ({ ...g, food: g.food.filter((_, j) => j !== ii) })) }
  function updateFood(di: number, gi: number, ii: number, field: keyof FoodItem, val: string) {
    updGroup(di, gi, g => ({ ...g, food: g.food.map((f, j) => j !== ii ? f : { ...f, [field]: field === 'rating' ? Number(val) : val }) }))
  }
  function addActivity(di: number, gi: number) { updGroup(di, gi, g => ({ ...g, activities: [...g.activities, emptyActivity()] })) }
  function removeActivity(di: number, gi: number, ii: number) { updGroup(di, gi, g => ({ ...g, activities: g.activities.filter((_, j) => j !== ii) })) }
  function updateActivity(di: number, gi: number, ii: number, field: keyof ActivityItem, val: string) {
    updGroup(di, gi, g => ({ ...g, activities: g.activities.map((a, j) => j !== ii ? a : { ...a, [field]: field === 'rating' ? Number(val) : val }) }))
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
      if (res.ok) { const { url } = await res.json(); uploaded.push({ url, caption: '' }) }
    }
    setPhotos(p => [...p, ...uploaded])
    setUploading(false)
    e.target.value = ''
  }
  function removePhoto(i: number) { setPhotos(p => p.filter((_, idx) => idx !== i)) }
  function updateCaption(i: number, val: string) { setPhotos(p => p.map((ph, idx) => idx === i ? { ...ph, caption: val } : ph)) }

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="destinations" value={JSON.stringify(destinations)} />
      <input type="hidden" name="photos" value={JSON.stringify(photos)} />
      <input type="hidden" name="audience" value={isAdult ? 'adult' : 'family'} />
      <input type="hidden" name="visibility" value={isPrivate ? 'private' : 'public'} />
      <input type="hidden" name="postType" value={postType} />

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{state.error}</p>
      )}

      {/* Basic Info */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Basic Info</h2>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 text-sm font-medium">
            <button type="button" onClick={() => setPostType('itinerary')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${postType === 'itinerary' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              ✈️ Itinerary
            </button>
            <button type="button" onClick={() => setPostType('guide')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${postType === 'guide' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              📖 Guide
            </button>
          </div>
        </div>
        {postType === 'guide' && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Guide mode — share your recommendations without dates or personal ratings.
          </p>
        )}
        <div>
          <label htmlFor="title" className={labelClass}>Title *</label>
          <input id="title" name="title" type="text" required className={inputClass} value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor="description" className={labelClass}>Short description</label>
          <textarea id="description" name="description" rows={2} className={inputClass} value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        {postType === 'itinerary' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className={labelClass}>Start date *</label>
              <input id="startDate" name="startDate" type="date" required className={inputClass} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="endDate" className={labelClass}>End date *</label>
              <input id="endDate" name="endDate" type="date" required className={inputClass} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
        )}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div onClick={() => setIsAdult(v => !v)} className={`w-10 h-6 rounded-full transition-colors relative ${!isAdult ? 'bg-green-500' : 'bg-gray-200'}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${!isAdult ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
          <span className="text-sm text-gray-900">Family friendly</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div onClick={() => setIsPrivate(v => !v)} className={`w-10 h-6 rounded-full transition-colors relative ${isPrivate ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
          <span className="text-sm text-gray-900">{isPrivate ? 'Private — only visible to you' : 'Public — visible to everyone'}</span>
        </label>
      </section>

      {/* Destinations */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-lg">Destinations</h2>
          <button type="button" onClick={addDest} className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add destination</button>
        </div>

        {destinations.map((dest, di) => (
          <div key={di} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            {/* City / Country */}
            <div className="flex gap-3 items-start">
              <div className="flex-1 grid grid-cols-2 gap-3">
                <PlacesAutocomplete
                  value={dest.name}
                  onChange={val => updateDest(di, 'name', val)}
                  onSelect={(main, secondary) => setDestinations(d => d.map((dst, idx) => idx === di ? { ...dst, name: main, country: secondary || dst.country } : dst))}
                  type="destination"
                  placeholder={`City / place${destinations.length > 1 ? ` ${di + 1}` : ''}`}
                  className={inputClass}
                />
                <input type="text" value={dest.country} onChange={e => updateDest(di, 'country', e.target.value)}
                  className={inputClass} placeholder="Country" />
              </div>
              {destinations.length > 1 && (
                <button type="button" onClick={() => removeDest(di)} className="mt-1 text-gray-400 hover:text-red-500 text-xl leading-none">×</button>
              )}
            </div>

            {/* Stays */}
            {dest.groups.map((group, gi) => (
              <div key={gi} className="rounded-xl border border-gray-200 overflow-hidden">
                {dest.groups.length > 1 && (
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Stay {gi + 1}</span>
                    <button type="button" onClick={() => removeGroup(di, gi)} className="text-xs text-red-400 hover:text-red-600 font-medium">Remove stay</button>
                  </div>
                )}
                <div className="p-4 space-y-4">
                  {/* Hotel */}
                  <div className="bg-blue-50 rounded-xl border border-l-4 border-l-blue-400 p-3 space-y-2">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">🏨 Hotel / Accommodation</p>
                    <PlacesAutocomplete
                      value={group.hotelName}
                      onChange={val => updateHotel(di, gi, 'hotelName', val)}
                      type="hotel"
                      placeholder="Hotel name (optional)"
                      className={inputClass}
                    />
                    {group.hotelName && (<>
                      {showRating && <div className="flex items-center gap-2"><span className="text-xs text-gray-600">Rate it!</span><StarRating value={group.hotelRating} onChange={v => updateHotel(di, gi, 'hotelRating', String(v))} /></div>}
                      <input type="text" value={group.hotelNotes} onChange={e => updateHotel(di, gi, 'hotelNotes', e.target.value)} className={subInputClass} placeholder="📝 Notes (optional)" />
                      <input type="url" value={group.hotelLink} onChange={e => updateHotel(di, gi, 'hotelLink', e.target.value)} className={subInputClass} placeholder="🔗 Website link (optional)" />
                    </>)}
                  </div>
                  {/* Food & Drink */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🍜 Food & Drink</p>
                    {group.food.length === 0 && <p className="text-xs text-gray-600 italic">None added yet.</p>}
                    <div className="space-y-3">{group.food.map((item, ii) => <FoodRow key={ii} item={item} index={ii} showRating={showRating} onUpdate={(f, v) => updateFood(di, gi, ii, f, v)} onRemove={() => removeFood(di, gi, ii)} />)}</div>
                    <button type="button" onClick={() => addFood(di, gi)} className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium border border-dashed border-blue-300 hover:border-blue-500 rounded-lg py-2 transition-colors">+ Add food / drink</button>
                  </div>
                  {/* Activities */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🎯 Activities</p>
                    {group.activities.length === 0 && <p className="text-xs text-gray-600 italic">None added yet.</p>}
                    <div className="space-y-3">{group.activities.map((item, ii) => <ActivityRow key={ii} item={item} index={ii} showRating={showRating} onUpdate={(f, v) => updateActivity(di, gi, ii, f, v)} onRemove={() => removeActivity(di, gi, ii)} />)}</div>
                    <button type="button" onClick={() => addActivity(di, gi)} className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium border border-dashed border-blue-300 hover:border-blue-500 rounded-lg py-2 transition-colors">+ Add activity</button>
                  </div>
                </div>
              </div>
            ))}

            <button type="button" onClick={() => addGroup(di)}
              className="w-full text-sm text-gray-500 hover:text-blue-600 border border-dashed border-gray-300 hover:border-blue-300 rounded-xl py-3 transition-colors">
              + Add another stay (different hotel)
            </button>
          </div>
        ))}
      </section>

      {/* Notes */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">General Notes</h2>
        <textarea name="notes" rows={3} className={inputClass} placeholder="Tips, packing list, visa info…" value={notes} onChange={e => setNotes(e.target.value)} />
      </section>

      {/* Photos */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Photos</h2>
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-blue-400 transition-colors">
          <span className="text-2xl mb-2">📸</span>
          <span className="text-sm font-medium text-gray-900">{uploading ? 'Uploading…' : 'Click to upload photos'}</span>
          <span className="text-xs text-gray-600 mt-1">JPG, PNG, WEBP, GIF</span>
          <input type="file" accept="image/*" multiple className="sr-only" onChange={handlePhotoUpload} disabled={uploading} />
        </label>
        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photo, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" className="w-full h-32 object-cover rounded-lg" />
                <button type="button" onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                <input type="text" value={photo.caption} onChange={e => updateCaption(i, e.target.value)}
                  className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Caption (optional)" />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex gap-3">
        <button type="submit" disabled={pending || uploading}
          className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 text-base">
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { upload } from '@vercel/blob/client'
import { createItineraryDirect } from '@/actions/itinerary'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import TagPicker from '@/components/TagPicker'
import { TripRatingPicker } from '@/components/TripRatingPicker'

// Binary files (images, PDFs, XLSX) are uploaded to Vercel Blob to avoid the 4.5MB
// function body limit. The public Blob URL is sent to the API route instead of base64.
const MAX_IMPORT_FILE_SIZE = 100 * 1024 * 1024
const DIRECT_IMAGE_LIMIT = 3 * 1024 * 1024
const IMPORT_TIMEOUT_MS = 5 * 60 * 1000

async function readFileForUpload(
  file: File,
  onUploadProgress?: (percentage: number) => void,
): Promise<{ text: string } | { base64: string; mediaType: string } | { blobUrl: string; mediaType: string; filename: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mime = file.type
  const isPdf = ext === 'pdf' || mime === 'application/pdf'
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

  if (isPdf || isXlsx || isImage) {
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      throw new Error('Files must be 100 MB or smaller.')
    }
    const ext2 = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
    const uniqueName = `extractions/${Date.now()}-${Math.random().toString(36).slice(2)}${ext2}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS)
    let blob: Awaited<ReturnType<typeof upload>>
    try {
      blob = await upload(uniqueName, file, {
        access: 'public',
        handleUploadUrl: '/api/upload-doc',
        abortSignal: controller.signal,
        // Multipart is for genuinely large uploads. For normal PDFs it adds an
        // unnecessary control-plane round trip and can stall before extraction.
        multipart: file.size > 10 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => onUploadProgress?.(percentage),
      })
    } catch (err) {
      if (controller.signal.aborted) throw new Error('Upload timed out. Please check your connection and try again.')
      throw err
    } finally {
      clearTimeout(timeout)
    }
    const mediaType = file.type || (isPdf ? 'application/pdf' : isImage ? 'image/jpeg' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
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

type FoodItem     = { name: string; mealType: string; notes: string; link: string; rating: number; priceLevel: number | null; familyFriendly: boolean | null; familyFriendlySource: string | null; lat: number | null; lng: number | null; tags: string[] }
type ActivityItem = { name: string; notes: string; link: string; rating: number }
type StayGroup    = { hotelName: string; hotelNotes: string; hotelLink: string; hotelRating: number; hotelPriceLevel: number | null; hotelNightlyRate: string; hotelLat: number | null; hotelLng: number | null; hotelTags: string[]; food: FoodItem[]; activities: ActivityItem[] }
type Destination  = { name: string; country: string; notes: string; groups: StayGroup[] }
type UploadedPhoto = { url: string; caption: string }

type RawDestItem = { type: string; mealType?: string; rating?: number; name: string; notes?: string; link?: string }
type RawDest = { name?: string; country?: string; items?: RawDestItem[] }
type ExtractionData = { title?: string; description?: string; startDate?: string; endDate?: string; notes?: string; destinations?: RawDest[] }

const DOC_ACCEPT = '.pdf,.xlsx,.xls,.csv,.txt,.html,.htm,image/jpeg,image/png,image/gif,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain,text/html'

function mapExtractionDests(rawDests: RawDest[]): Destination[] {
  return rawDests.map((d) => {
    const items = Array.isArray(d.items) ? d.items : []
    const hotels = items.filter(i => i.type === 'hotel')
    const food   = items.filter(i => i.type === 'food_drink').map(f => ({ name: f.name ?? '', mealType: f.mealType ?? '', notes: f.notes ?? '', link: f.link ?? '', rating: f.rating ?? 0, priceLevel: null, familyFriendly: null, familyFriendlySource: null, lat: null, lng: null, tags: [] }))
    const acts   = items.filter(i => i.type === 'activity').map(a => ({ name: a.name ?? '', notes: a.notes ?? '', link: a.link ?? '', rating: a.rating ?? 0 }))
    const groups: StayGroup[] = hotels.length === 0
      ? [{ hotelName: '', hotelNotes: '', hotelLink: '', hotelRating: 0, hotelPriceLevel: null, hotelNightlyRate: '', hotelLat: null, hotelLng: null, hotelTags: [], food, activities: acts }]
      : hotels.map((h, hi) => ({ hotelName: h.name ?? '', hotelNotes: h.notes ?? '', hotelLink: h.link ?? '', hotelRating: h.rating ?? 0, hotelPriceLevel: null, hotelNightlyRate: '', hotelLat: null, hotelLng: null, hotelTags: [], food: hi === 0 ? food : [], activities: hi === 0 ? acts : [] }))
    return { name: d.name ?? '', country: d.country ?? '', notes: '', groups }
  })
}

const emptyFood     = (): FoodItem     => ({ name: '', mealType: '', notes: '', link: '', rating: 0, priceLevel: null, familyFriendly: null, familyFriendlySource: null, lat: null, lng: null, tags: [] })
const emptyActivity = (): ActivityItem => ({ name: '', notes: '', link: '', rating: 0 })
const emptyGroup    = (): StayGroup    => ({ hotelName: '', hotelNotes: '', hotelLink: '', hotelRating: 0, hotelPriceLevel: null, hotelNightlyRate: '', hotelLat: null, hotelLng: null, hotelTags: [], food: [], activities: [] })

const FOOD_TAGS = ['Worth the Hype', 'Great Food', 'Hidden Gem', 'Local Favorite', "Can't-Miss", 'Good for Groups', 'Family Friendly', 'Great Cocktails', 'Great Ambiance', 'Lively', 'Romantic', 'Chic', 'Casual', 'Outdoor Dining', 'Great Views']
const HOTEL_TAGS = ['Great Service', 'Worth the Splurge', 'Great Value', 'Hidden Gem', 'Boutique', 'Luxury', 'Romantic', 'Family-Friendly', 'Great Location', 'Great Views', 'Amazing Spa']
const emptyDest     = (): Destination  => ({ name: '', country: '', notes: '', groups: [emptyGroup()] })

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-900 mb-1'
const subInputClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'drinks', 'coffee', 'dessert', 'bakery'] as const
const MEAL_TYPE_META: Record<string, { emoji: string; active: string }> = {
  breakfast: { emoji: '🍳', active: 'bg-yellow-500 text-white border-yellow-500' },
  lunch:     { emoji: '☀️', active: 'bg-orange-500 text-white border-orange-500' },
  dinner:    { emoji: '🌙', active: 'bg-purple-600 text-white border-purple-600' },
  drinks:    { emoji: '🍹', active: 'bg-blue-500 text-white border-blue-500' },
  coffee:    { emoji: '☕', active: 'bg-amber-700 text-white border-amber-700' },
  dessert:   { emoji: '🍰', active: 'bg-pink-500 text-white border-pink-500' },
  bakery:    { emoji: '🥐', active: 'bg-orange-400 text-white border-orange-400' },
}

function nightlyRateToTier(rate: number): number {
  if (rate < 150) return 1
  if (rate < 350) return 2
  if (rate < 600) return 3
  if (rate < 1000) return 4
  return 5
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => onChange(value === star ? 0 : star)}
          className="text-lg leading-none focus:outline-none" aria-label={`${star} star`}>
          <span className={star <= value ? 'text-yellow-400' : 'text-gray-300'}>★</span>
        </button>
      ))}
    </div>
  )
}

function FoodRow({ item, index, onUpdate, onUpdateFF, onToggleTag, onRemove, showRating, onSelectPlace }: {
  item: FoodItem; index: number
  onUpdate: (field: keyof Omit<FoodItem, 'priceLevel' | 'familyFriendly' | 'tags'>, val: string) => void
  onUpdateFF: (val: boolean | null) => void
  onToggleTag: (tag: string) => void
  onRemove: () => void; showRating: boolean
  onSelectPlace?: (placeId: string | null) => void
}) {
  return (
    <div className={`rounded-xl border border-l-4 border-l-orange-400 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-gray-100'} p-4 space-y-3`}>
      <div className="flex gap-2 items-start">
        <PlacesAutocomplete value={item.name}
          onChange={val => { onUpdate('name', val); if (!val) onSelectPlace?.(null) }}
          onSelect={(_, __, placeId) => { if (placeId) onSelectPlace?.(placeId) }}
          type="restaurant" placeholder="e.g. Ramen Ichiran, Rooftop bar, Street market" className={inputClass} />
        <button type="button" onClick={onRemove} className="mt-1.5 text-gray-400 hover:text-red-500 text-xl leading-none shrink-0">×</button>
      </div>
      <div className="flex gap-1 flex-wrap">
        {MEAL_TYPES.map(mt => (
          <button key={mt} type="button" onClick={() => onUpdate('mealType', item.mealType === mt ? '' : mt)}
            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors capitalize ${item.mealType === mt ? MEAL_TYPE_META[mt].active : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
            {MEAL_TYPE_META[mt].emoji} {mt}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {item.priceLevel != null && (
          <p className="text-xs text-green-700 font-medium">
            {'$'.repeat(item.priceLevel)}<span className="text-gray-300">{'$'.repeat(4 - item.priceLevel)}</span>
          </p>
        )}
        <button type="button" onClick={() => onUpdateFF(item.familyFriendly === true ? null : true)}
          className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${item.familyFriendly === true ? 'bg-green-500 text-white border-green-500' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
          👨‍👩‍👧 Family friendly
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FOOD_TAGS.map(tag => (
          <button key={tag} type="button" onClick={() => onToggleTag(tag)}
            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${item.tags.includes(tag) ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
            {tag}
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
  return (
    <div className={`rounded-xl border border-l-4 border-l-green-400 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-gray-100'} p-4 space-y-3`}>
      <div className="flex gap-2 items-start">
        <PlacesAutocomplete value={item.name} onChange={val => onUpdate('name', val)}
          type="activity" placeholder="e.g. Temple tour, Hiking, Museum visit" className={inputClass} />
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

// ── Steps ─────────────────────────────────────────────────────────────────────
const STEPS = ['start', 'basics', 'places', 'photos', 'details'] as const
type Step = typeof STEPS[number]

export default function CreatePage() {
  const [formError, setFormError] = useState<string | undefined>()
  const [pending, setPending] = useState(false)
  const [step, setStep] = useState<Step>('start')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [postType, setPostType] = useState<'itinerary' | 'guide'>('itinerary')
  const [isAdult, setIsAdult] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [notes, setNotes] = useState('')
  const [highlights, setHighlights] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tripRating, setTripRating] = useState<number | null>(null)
  const [destinations, setDestinations] = useState<Destination[]>([emptyDest()])
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [extractProgress, setExtractProgress] = useState<{ current: number; total: number } | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const showRating = postType === 'itinerary'
  const stepIndex = STEPS.indexOf(step)

  function goNext() { setStep(STEPS[stepIndex + 1]) }
  function goBack() { setStep(STEPS[stepIndex - 1]) }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(isDraft: boolean) {
    setPending(true)
    setFormError(undefined)
    const result = await createItineraryDirect({
      title, description, startDate, endDate, notes, highlights,
      destinations, photos, tags, tripRating,
      postType, audience: isAdult ? 'adult' : 'family',
      visibility: isPrivate ? 'private' : 'public',
      isDraft,
    })
    setPending(false)
    if (result?.error) setFormError(result.error)
  }

  // ── Import ────────────────────────────────────────────────────────────────
  async function fetchExtraction(payload: { text: string } | { base64: string; mediaType: string } | { blobUrl: string; mediaType: string; filename: string }): Promise<ExtractionData> {
    if ('text' in payload && !payload.text.trim()) throw new Error('No text to extract from.')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch('/api/extract-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Extraction failed.')
    }
    return res.json()
  }

  function applyExtractionResults(results: ExtractionData[]) {
    const first = results[0]
    if (first.title) setTitle(first.title)
    if (first.description) setDescription(first.description)
    if (first.startDate) setStartDate(first.startDate)
    if (first.endDate) setEndDate(first.endDate)
    if (first.notes) setNotes(first.notes)
    const allDests = results.flatMap(r => Array.isArray(r.destinations) && r.destinations.length > 0 ? mapExtractionDests(r.destinations) : [])
    if (allDests.length > 0) setDestinations(allDests)
    setStep('basics')
  }

  async function handlePasteExtract() {
    if (!pasteText.trim()) return
    setExtracting(true)
    setExtractError(null)
    setUploadProgress(null)
    try {
      const data = await fetchExtraction({ text: pasteText })
      applyExtractionResults([data])
      setPasteMode(false)
      setPasteText('')
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setExtracting(false)
    }
  }

  function handleAddFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? [])
    if (incoming.length > 0) setPendingFiles(prev => [...prev, ...incoming])
    e.target.value = ''
  }

  function removePendingFile(i: number) {
    setPendingFiles(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleExtractAll() {
    if (pendingFiles.length === 0) return
    setExtracting(true)
    setExtractError(null)
    setExtractProgress(pendingFiles.length > 1 ? { current: 0, total: pendingFiles.length } : null)
    const results: ExtractionData[] = []
    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        if (pendingFiles.length > 1) setExtractProgress({ current: i + 1, total: pendingFiles.length })
        const payload = await readFileForUpload(pendingFiles[i], setUploadProgress)
        results.push(await fetchExtraction(payload))
        setUploadProgress(null)
      }
      applyExtractionResults(results)
      setPendingFiles([])
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setExtracting(false)
      setExtractProgress(null)
      setUploadProgress(null)
    }
  }

  // ── Destinations ──────────────────────────────────────────────────────────
  function addDest() { setDestinations(d => [...d, emptyDest()]) }
  function removeDest(i: number) { setDestinations(d => d.filter((_, idx) => idx !== i)) }
  function updateDest(i: number, field: 'name' | 'country' | 'notes', val: string) {
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
  async function fetchHotelPriceLevel(di: number, gi: number, placeId: string) {
    try {
      const res = await fetch(`/api/place-details?id=${encodeURIComponent(placeId)}`)
      const { priceLevel, lat, lng } = await res.json()
      updGroup(di, gi, g => ({
        ...g,
        ...(priceLevel !== null ? { hotelPriceLevel: priceLevel } : {}),
        ...(lat !== null ? { hotelLat: lat, hotelLng: lng } : {}),
      }))
    } catch { /* ignore */ }
  }
  function addFood(di: number, gi: number) { updGroup(di, gi, g => ({ ...g, food: [...g.food, emptyFood()] })) }
  function removeFood(di: number, gi: number, ii: number) { updGroup(di, gi, g => ({ ...g, food: g.food.filter((_, j) => j !== ii) })) }
  function updateFood(di: number, gi: number, ii: number, field: keyof Omit<FoodItem, 'priceLevel'>, val: string) {
    updGroup(di, gi, g => ({ ...g, food: g.food.map((f, j) => j !== ii ? f : { ...f, [field]: field === 'rating' ? Number(val) : val }) }))
  }
  function setFoodPriceLevel(di: number, gi: number, ii: number, val: number | null) {
    updGroup(di, gi, g => ({ ...g, food: g.food.map((f, j) => j !== ii ? f : { ...f, priceLevel: val }) }))
  }
  function setFoodFamilyFriendly(di: number, gi: number, ii: number, val: boolean | null) {
    updGroup(di, gi, g => ({ ...g, food: g.food.map((f, j) => j !== ii ? f : { ...f, familyFriendly: val, familyFriendlySource: val !== null ? 'user' : null }) }))
  }
  async function fetchFoodPriceLevel(di: number, gi: number, ii: number, placeId: string) {
    try {
      const res = await fetch(`/api/place-details?id=${encodeURIComponent(placeId)}`)
      const { priceLevel, lat, lng } = await res.json()
      if (priceLevel !== null) setFoodPriceLevel(di, gi, ii, priceLevel)
      if (lat !== null) updGroup(di, gi, g => ({ ...g, food: g.food.map((f, j) => j !== ii ? f : { ...f, lat, lng }) }))
    } catch { /* ignore */ }
  }
  function toggleFoodTag(di: number, gi: number, ii: number, tag: string) {
    updGroup(di, gi, g => ({ ...g, food: g.food.map((f, j) => j !== ii ? f : { ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] }) }))
  }
  function addActivity(di: number, gi: number) { updGroup(di, gi, g => ({ ...g, activities: [...g.activities, emptyActivity()] })) }
  function removeActivity(di: number, gi: number, ii: number) { updGroup(di, gi, g => ({ ...g, activities: g.activities.filter((_, j) => j !== ii) })) }
  function updateActivity(di: number, gi: number, ii: number, field: keyof ActivityItem, val: string) {
    updGroup(di, gi, g => ({ ...g, activities: g.activities.map((a, j) => j !== ii ? a : { ...a, [field]: field === 'rating' ? Number(val) : val }) }))
  }

  // ── Photos ────────────────────────────────────────────────────────────────
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    try {
      const uploaded: UploadedPhoto[] = []
      for (const file of Array.from(files)) {
        const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
        const blob = await upload(uniqueName, file, { access: 'private', handleUploadUrl: '/api/upload' })
        uploaded.push({ url: `/api/img?url=${encodeURIComponent(blob.url)}`, caption: '' })
      }
      setPhotos(p => [...p, ...uploaded])
    } catch (err) {
      console.error('[upload] error:', err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }
  function removePhoto(i: number) { setPhotos(p => p.filter((_, idx) => idx !== i)) }
  function updateCaption(i: number, val: string) { setPhotos(p => p.map((ph, idx) => idx === i ? { ...ph, caption: val } : ph)) }

  const hasItems = destinations.some(d => d.groups.some(g => g.hotelName.trim() || g.food.some(f => f.name.trim()) || g.activities.some(a => a.name.trim())))

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto px-4 py-8">

      {/* Progress bar (hidden on start step) */}
      {step !== 'start' && (
        <div className="mb-6 flex gap-1.5">
          {(['basics', 'places', 'photos', 'details'] as const).map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${stepIndex > i + 1 ? 'bg-blue-500' : stepIndex === i + 1 ? 'bg-blue-500' : 'bg-gray-200'}`} />
          ))}
        </div>
      )}

      <form onSubmit={e => e.preventDefault()}>
        {formError && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{formError}</p>
        )}

        {/* ── START ──────────────────────────────────────────────────────── */}
        {step === 'start' && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">New post</h1>
              <p className="text-sm text-gray-500">Share a trip or travel guide.</p>
            </div>

            {/* Import card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <div>
                <p className="font-semibold text-gray-900 mb-0.5">📄 Import</p>
                <p className="text-xs text-gray-500">Upload a PDF, spreadsheet, screenshot, or HTML export — or paste an email / booking confirmation. Works with Apple Notes (share as PDF or screenshot).</p>
              </div>

              {pendingFiles.length > 0 ? (
                <div className="space-y-2">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      <span className="text-sm flex-1 truncate text-gray-700">{f.name}</span>
                      <button type="button" onClick={() => removePendingFile(i)} disabled={extracting}
                        className="text-gray-400 hover:text-red-500 text-lg leading-none disabled:opacity-30">×</button>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <label className={`shrink-0 text-center cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium transition-colors border ${
                      extracting ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}>
                      + Add more files
                      <input type="file" multiple
                        accept={DOC_ACCEPT}
                        className="sr-only" onChange={handleAddFiles} disabled={extracting} />
                    </label>
                    <button type="button" onClick={handleExtractAll} disabled={extracting}
                      className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl px-4 py-2.5 hover:bg-blue-700 transition-colors disabled:opacity-60">
                      {extracting
                        ? extractProgress
                          ? `Reading ${extractProgress.current} of ${extractProgress.total}…`
                          : 'Reading…'
                        : 'Extract itinerary'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <label className={`flex-1 text-center cursor-pointer rounded-xl px-4 py-3 text-sm font-medium transition-colors border ${
                    extracting ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-blue-600 hover:text-white hover:border-blue-600'
                  }`}>
                    📎 Upload file
                    <input type="file" multiple
                      accept={DOC_ACCEPT}
                      className="sr-only" onChange={handleAddFiles} disabled={extracting} />
                  </label>
                  <button type="button" disabled={extracting}
                    onClick={() => { setPasteMode(v => !v); setExtractError(null) }}
                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-colors border ${
                      pasteMode ? 'bg-blue-600 text-white border-blue-600' :
                      extracting ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed' :
                      'bg-gray-50 text-gray-700 border-gray-200 hover:bg-blue-600 hover:text-white hover:border-blue-600'
                    }`}>
                    📋 Paste text
                  </button>
                </div>
              )}

              {pasteMode && (
                <div className="space-y-2">
                  <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
                    placeholder="Paste your itinerary — email confirmation, notes, booking details…"
                    rows={6}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  <div className="flex gap-2">
                    <button type="button" onClick={handlePasteExtract} disabled={extracting || !pasteText.trim()}
                      className="flex-1 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                      {extracting ? 'Extracting…' : 'Extract itinerary'}
                    </button>
                    <button type="button" onClick={() => { setPasteMode(false); setPasteText(''); setExtractError(null) }}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {extractError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{extractError}</p>
              )}
              {extracting && (
                <p className="text-xs text-blue-600 animate-pulse">
                  {extractProgress
                    ? `Reading file ${extractProgress.current} of ${extractProgress.total}…`
                    : uploadProgress != null
                      ? `Uploading file… ${Math.round(uploadProgress)}%`
                    : 'Reading your itinerary…'}
                </p>
              )}
            </div>

            <button type="button" onClick={() => setStep('basics')}
              className="w-full py-3.5 rounded-2xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
              Start from scratch →
            </button>
          </div>
        )}

        {/* ── BASICS ─────────────────────────────────────────────────────── */}
        {step === 'basics' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <h2 className="font-semibold text-gray-900 text-lg">What are you posting?</h2>

            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 text-sm font-medium">
              <button type="button" onClick={() => setPostType('itinerary')}
                className={`flex-1 py-2 rounded-lg transition-colors ${postType === 'itinerary' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                ✈️ Itinerary
              </button>
              <button type="button" onClick={() => setPostType('guide')}
                className={`flex-1 py-2 rounded-lg transition-colors ${postType === 'guide' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                📖 Guide
              </button>
            </div>

            <div>
              <label htmlFor="title" className={labelClass}>Title *</label>
              <input id="title" type="text" className={inputClass}
                placeholder="e.g. 10 days in Japan" value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <div>
              <label htmlFor="description" className={labelClass}>Short description <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea id="description" rows={2} className={inputClass}
                placeholder="A quick summary…" value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            {postType === 'itinerary' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="startDate" className={labelClass}>Start date *</label>
                  <input id="startDate" type="date" className={inputClass} value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="endDate" className={labelClass}>End date *</label>
                  <input id="endDate" type="date" className={inputClass} value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
            )}

            <div className="space-y-3 pt-1">
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
                <span className="text-sm text-gray-900">{isPrivate ? 'Private' : 'Public'}</span>
              </label>
            </div>
          </div>
        )}

        {/* ── PLACES ─────────────────────────────────────────────────────── */}
        {step === 'places' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900 text-lg">Where did you go?</h2>

            {destinations.map((dest, di) => (
              <div key={di} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                <div className="flex gap-3 items-start">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <PlacesAutocomplete value={dest.name}
                      onChange={val => updateDest(di, 'name', val)}
                      onSelect={(main, secondary) => setDestinations(d => d.map((dst, idx) => idx === di ? { ...dst, name: main, country: secondary || dst.country } : dst))}
                      type="destination" placeholder={`City / place${destinations.length > 1 ? ` ${di + 1}` : ''}`} className={inputClass} />
                    <input type="text" value={dest.country} onChange={e => updateDest(di, 'country', e.target.value)} className={inputClass} placeholder="Country" />
                  </div>
                  {destinations.length > 1 && (
                    <button type="button" onClick={() => removeDest(di)} className="mt-1 text-gray-400 hover:text-red-500 text-xl leading-none">×</button>
                  )}
                </div>

                <textarea value={dest.notes} onChange={e => updateDest(di, 'notes', e.target.value)} rows={2} className={inputClass} placeholder="Notes for this destination (optional)" />

                {dest.groups.map((group, gi) => (
                  <div key={gi} className="rounded-xl border border-gray-200 overflow-hidden">
                    {dest.groups.length > 1 && (
                      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Stay {gi + 1}</span>
                        <button type="button" onClick={() => removeGroup(di, gi)} className="text-xs text-red-400 hover:text-red-600 font-medium">Remove</button>
                      </div>
                    )}
                    <div className="p-4 space-y-4">
                      {/* Hotel */}
                      <div className="bg-blue-50 rounded-xl border border-l-4 border-l-blue-400 p-3 space-y-2">
                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">🏨 Hotel / Accommodation</p>
                        <PlacesAutocomplete value={group.hotelName}
                          onChange={val => { updateHotel(di, gi, 'hotelName', val); if (!val) updGroup(di, gi, g => ({ ...g, hotelPriceLevel: null, hotelNightlyRate: '' })) }}
                          onSelect={(_, __, placeId) => { if (placeId) fetchHotelPriceLevel(di, gi, placeId) }}
                          type="hotel" placeholder="Hotel name (optional)" className={inputClass} />
                        {group.hotelName && (<>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 shrink-0">$/night</span>
                            <input type="number" min="0" step="1" value={group.hotelNightlyRate}
                              onChange={e => {
                                const val = e.target.value
                                updGroup(di, gi, g => {
                                  const rate = parseFloat(val)
                                  return { ...g, hotelNightlyRate: val, hotelPriceLevel: val && !isNaN(rate) && rate > 0 ? nightlyRateToTier(rate) : g.hotelPriceLevel }
                                })
                              }}
                              className={subInputClass} placeholder="What did you pay per night? (optional)" />
                          </div>
                          {group.hotelPriceLevel !== null && (
                            <p className="text-xs text-green-700 font-medium">
                              {'$'.repeat(group.hotelPriceLevel)}<span className="text-gray-300">{'$'.repeat(5 - group.hotelPriceLevel)}</span>
                            </p>
                          )}
                          {showRating && <div className="flex items-center gap-2"><span className="text-xs text-gray-600">Rate it!</span><StarRating value={group.hotelRating} onChange={v => updateHotel(di, gi, 'hotelRating', String(v))} /></div>}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {HOTEL_TAGS.map(tag => (
                              <button key={tag} type="button" onClick={() => updGroup(di, gi, g => ({ ...g, hotelTags: g.hotelTags.includes(tag) ? g.hotelTags.filter(t => t !== tag) : [...g.hotelTags, tag] }))}
                                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${group.hotelTags.includes(tag) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
                                {tag}
                              </button>
                            ))}
                          </div>
                          <input type="text" value={group.hotelNotes} onChange={e => updateHotel(di, gi, 'hotelNotes', e.target.value)} className={subInputClass} placeholder="📝 Notes (optional)" />
                          <input type="url" value={group.hotelLink} onChange={e => updateHotel(di, gi, 'hotelLink', e.target.value)} className={subInputClass} placeholder="🔗 Website link (optional)" />
                        </>)}
                      </div>
                      {/* Food */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🍜 Food & Drink</p>
                        {group.food.length === 0 && <p className="text-xs text-gray-400 italic">None added yet.</p>}
                        <div className="space-y-3">{group.food.map((item, ii) => <FoodRow key={ii} item={item} index={ii} showRating={showRating} onUpdate={(f, v) => updateFood(di, gi, ii, f, v)} onUpdateFF={v => setFoodFamilyFriendly(di, gi, ii, v)} onToggleTag={tag => toggleFoodTag(di, gi, ii, tag)} onRemove={() => removeFood(di, gi, ii)} onSelectPlace={id => id ? fetchFoodPriceLevel(di, gi, ii, id) : setFoodPriceLevel(di, gi, ii, null)} />)}</div>
                        <button type="button" onClick={() => addFood(di, gi)} className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium border border-dashed border-blue-300 hover:border-blue-500 rounded-lg py-2 transition-colors">+ Add food / drink</button>
                      </div>
                      {/* Activities */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🎯 Activities</p>
                        {group.activities.length === 0 && <p className="text-xs text-gray-400 italic">None added yet.</p>}
                        <div className="space-y-3">{group.activities.map((item, ii) => <ActivityRow key={ii} item={item} index={ii} showRating={showRating} onUpdate={(f, v) => updateActivity(di, gi, ii, f, v)} onRemove={() => removeActivity(di, gi, ii)} />)}</div>
                        <button type="button" onClick={() => addActivity(di, gi)} className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium border border-dashed border-blue-300 hover:border-blue-500 rounded-lg py-2 transition-colors">+ Add activity</button>
                      </div>
                    </div>
                  </div>
                ))}

                <button type="button" onClick={() => addGroup(di)}
                  className="w-full text-sm text-gray-500 hover:text-blue-600 border border-dashed border-gray-300 hover:border-blue-300 rounded-xl py-2.5 transition-colors">
                  + Add another stay
                </button>
              </div>
            ))}

            <button type="button" onClick={addDest}
              className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium border border-dashed border-blue-300 hover:border-blue-500 rounded-2xl py-3 transition-colors">
              + Add destination
            </button>
          </div>
        )}

        {/* ── PHOTOS ─────────────────────────────────────────────────────── */}
        {step === 'photos' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900 text-lg mb-1">Photos</h2>
              <p className="text-xs text-gray-500">Add photos from your trip — they&apos;ll appear as a scrollable strip.</p>
            </div>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-blue-400 transition-colors">
              <span className="text-2xl mb-2">📸</span>
              <span className="text-sm font-medium text-gray-700">{uploading ? 'Uploading…' : 'Click to upload photos'}</span>
              <span className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP, GIF</span>
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
          </div>
        )}

        {/* ── DETAILS ────────────────────────────────────────────────────── */}
        {step === 'details' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900 text-lg">Finishing touches</h2>

            <section className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-medium text-gray-900 mb-1 text-sm">Tags</h3>
              <p className="text-xs text-gray-500 mb-3">Pick what best describes this trip</p>
              <TagPicker selected={tags} onChange={setTags} />
            </section>

            <section className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
              <h3 className="font-medium text-gray-900 mb-1 text-sm">✨ Highlights <span className="font-normal text-gray-400">(optional)</span></h3>
              <p className="text-xs text-gray-500 mb-3">Leave blank and we&apos;ll auto-generate one from your 5-star picks.</p>
              <textarea rows={3} className={inputClass}
                value={highlights} onChange={e => setHighlights(e.target.value)}
                placeholder="The ramen at Ichiran was life-changing…" />
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-medium text-gray-900 mb-3 text-sm">Notes <span className="font-normal text-gray-400">(optional)</span></h3>
              <textarea rows={3} className={inputClass}
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Tips, packing list, visa info…" />
            </section>

            {postType === 'itinerary' && (
              <section className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-medium text-gray-900 mb-0.5 text-sm">Overall trip rating <span className="font-normal text-gray-400">(optional)</span></h3>
                <p className="text-xs text-gray-500 mb-3">Would you go back?</p>
                <TripRatingPicker value={tripRating} onChange={setTripRating} />
              </section>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => handleSubmit(true)} disabled={pending || uploading}
                className="flex-1 bg-white text-gray-700 font-semibold py-3 rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-colors disabled:opacity-60">
                {pending ? 'Saving…' : 'Save as Draft'}
              </button>
              <button type="button" onClick={() => handleSubmit(false)} disabled={pending || uploading || !hasItems}
                title={!hasItems ? 'Add at least one hotel, restaurant, or activity first' : undefined}
                className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60">
                {pending ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        )}

        {/* ── Navigation ─────────────────────────────────────────────────── */}
        {step !== 'start' && step !== 'details' && (
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={goBack}
              className="px-5 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors">
              ← Back
            </button>
            <button type="button" onClick={goNext}
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
              Continue →
            </button>
          </div>
        )}
        {step === 'details' && (
          <button type="button" onClick={goBack}
            className="mt-4 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            ← Back
          </button>
        )}
      </form>
    </div>
  )
}

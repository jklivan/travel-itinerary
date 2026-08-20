'use client'

import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { createItineraryDirect } from '@/actions/itinerary'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import TagPicker from '@/components/TagPicker'
import { TripRatingPicker } from '@/components/TripRatingPicker'
import { dateRangeFromMonthAndDays, monthAndDaysFromDates } from '@/lib/tripDates'

// Binary files (images, PDFs, XLSX) are uploaded to Vercel Blob to avoid the 4.5MB
// function body limit. The public Blob URL is sent to the API route instead of base64.
const MAX_IMPORT_FILE_SIZE = 100 * 1024 * 1024
// Base64 expands an image by roughly one third. Keep direct requests comfortably
// below server request limits; larger images use the more reliable Blob route.
const DIRECT_IMAGE_LIMIT = 2 * 1024 * 1024
const IMPORT_TIMEOUT_MS = 5 * 60 * 1000

async function readFileForUpload(
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

type FoodItem     = { name: string; mealType: string; notes: string; link: string; rating: number; priceLevel: number | null; familyFriendly: boolean | null; familyFriendlySource: string | null; lat: number | null; lng: number | null; tags: string[]; dayIndex?: number | null; order?: number; isHighlight?: boolean }
type ActivityItem = { name: string; notes: string; link: string; rating: number; dayIndex?: number | null; order?: number; isHighlight?: boolean }
type DayGroup    = { dayIndex?: number; food: FoodItem[]; activities: ActivityItem[] }
type StayGroup   = { hotelName: string; hotelNotes: string; hotelLink: string; hotelRating: number; hotelPriceLevel: number | null; hotelNightlyRate: string; hotelLat: number | null; hotelLng: number | null; hotelTags: string[]; days: DayGroup[] }
type Destination  = { name: string; country: string; notes: string; groups: StayGroup[] }
type UploadedPhoto = { url: string; caption: string }

type RawDestItem = { type: string; mealType?: string; rating?: number; name: string; notes?: string; link?: string; dayIndex?: number }
type RawDest = { name?: string; country?: string; items?: RawDestItem[] }
type ExtractionData = { title?: string; description?: string; startDate?: string; endDate?: string; notes?: string; destinations?: RawDest[] }

const DOC_ACCEPT = '.pdf,.docx,.xlsx,.xls,.csv,.txt,.html,.htm,image/jpeg,image/png,image/gif,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain,text/html'

function buildDays(food: FoodItem[], acts: ActivityItem[]): DayGroup[] {
  // If no items have explicit day numbers, return a single group (no day labels will be shown)
  const hasAnyDay = food.some(f => f.dayIndex) || acts.some(a => a.dayIndex)
  if (!hasAnyDay) return [{ food, activities: acts }]

  // Group by the trip-wide day number, skipping empty slots entirely.
  // Items with no day go into day 1 of the destination.
  const byDay = new Map<number, { food: FoodItem[]; activities: ActivityItem[] }>()
  for (const f of food) {
    const di = f.dayIndex ?? 1
    if (!byDay.has(di)) byDay.set(di, { food: [], activities: [] })
    byDay.get(di)!.food.push(f)
  }
  for (const a of acts) {
    const di = a.dayIndex ?? 1
    if (!byDay.has(di)) byDay.set(di, { food: [], activities: [] })
    byDay.get(di)!.activities.push(a)
  }

  // Return sorted by trip-wide day, preserving the original dayIndex so
  // flattenGroups stores the right value in the DB (e.g. Day 3 of the trip,
  // not Day 1 just because it's first in this destination).
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([dayIndex, items]) => ({ dayIndex, ...items }))
}

function mapExtractionDests(rawDests: RawDest[]): Destination[] {
  return rawDests.map((d) => {
    const items = Array.isArray(d.items) ? d.items : []
    const isHotelType = (t: string) => ['hotel', 'accommodation', 'lodging', 'stay'].includes(t.toLowerCase())
    const hotels = items.filter(i => isHotelType(i.type))
    // Track each non-hotel item's position in the document so we can restore schedule order.
    const nonHotelItems = items.filter(i => !isHotelType(i.type))
    const food = nonHotelItems
      .map((item, docPos) => ({ item, docPos }))
      .filter(({ item }) => item.type === 'food_drink')
      .map(({ item: f, docPos }) => ({ name: f.name ?? '', mealType: f.mealType ?? '', notes: f.notes ?? '', link: f.link ?? '', rating: f.rating ?? 0, priceLevel: null, familyFriendly: null, familyFriendlySource: null, lat: null, lng: null, tags: [], dayIndex: f.dayIndex ?? null, order: docPos, isHighlight: false }))
    const acts = nonHotelItems
      .map((item, docPos) => ({ item, docPos }))
      .filter(({ item }) => item.type === 'activity')
      .map(({ item: a, docPos }) => ({ name: a.name ?? '', notes: a.notes ?? '', link: a.link ?? '', rating: a.rating ?? 0, dayIndex: a.dayIndex ?? null, order: docPos, isHighlight: false }))
    const groups: StayGroup[] = hotels.length === 0
      ? [{ hotelName: '', hotelNotes: '', hotelLink: '', hotelRating: 0, hotelPriceLevel: null, hotelNightlyRate: '', hotelLat: null, hotelLng: null, hotelTags: [], days: buildDays(food, acts) }]
      : hotels.map((h, hi) => ({ hotelName: h.name ?? '', hotelNotes: h.notes ?? '', hotelLink: h.link ?? '', hotelRating: h.rating ?? 0, hotelPriceLevel: null, hotelNightlyRate: '', hotelLat: null, hotelLng: null, hotelTags: [], days: hi === 0 ? buildDays(food, acts) : [emptyDay()] }))
    return { name: d.name ?? '', country: d.country ?? '', notes: '', groups }
  })
}

const emptyFood     = (): FoodItem     => ({ name: '', mealType: '', notes: '', link: '', rating: 0, priceLevel: null, familyFriendly: null, familyFriendlySource: null, lat: null, lng: null, tags: [], dayIndex: null, isHighlight: false })
const emptyActivity = (): ActivityItem => ({ name: '', notes: '', link: '', rating: 0, dayIndex: null, isHighlight: false })
const emptyDay      = (): DayGroup     => ({ food: [], activities: [] })
const emptyGroup    = (): StayGroup    => ({ hotelName: '', hotelNotes: '', hotelLink: '', hotelRating: 0, hotelPriceLevel: null, hotelNightlyRate: '', hotelLat: null, hotelLng: null, hotelTags: [], days: [emptyDay()] })

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
  onUpdate: (field: keyof Omit<FoodItem, 'priceLevel' | 'familyFriendly' | 'tags' | 'isHighlight'>, val: string) => void
  onUpdateFF: (val: boolean | null) => void
  onToggleTag: (tag: string) => void
  onRemove: () => void; showRating: boolean
  onSelectPlace?: (placeId: string | null) => void
}) {
  const [showDetails, setShowDetails] = useState(false)
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
        {MEAL_TYPES.map(mt => {
          const selected = item.mealType.split(',').filter(Boolean)
          const isSelected = selected.includes(mt)
          return (
          <button key={mt} type="button" onClick={() => onUpdate('mealType', isSelected ? selected.filter(type => type !== mt).join(',') : [...selected, mt].join(','))}
            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors capitalize ${isSelected ? MEAL_TYPE_META[mt].active : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
            {MEAL_TYPE_META[mt].emoji} {mt}
          </button>
          )
        })}
      </div>
      {showRating && (
        <div className="flex items-center gap-2"><span className="text-xs text-gray-600 shrink-0">Rate it!</span><StarRating value={item.rating} onChange={v => onUpdate('rating', String(v))} /></div>
      )}
      <button type="button" onClick={() => setShowDetails(value => !value)} className="text-xs font-medium text-gray-500 hover:text-gray-800">
        {showDetails ? '− Hide details' : '+ Add details'}
      </button>
      {showDetails && <>
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
      <div className="grid gap-2">
        <input type="text" value={item.notes} onChange={e => onUpdate('notes', e.target.value)} className={subInputClass} placeholder="📝 Notes (optional)" />
        <input type="url" value={item.link} onChange={e => onUpdate('link', e.target.value)} className={subInputClass} placeholder="🔗 Website link (optional)" />
      </div>
      </>}
    </div>
  )
}

function ActivityRow({ item, index, onUpdate, onRemove, showRating }: {
  item: ActivityItem; index: number
  onUpdate: (field: keyof Omit<ActivityItem, 'isHighlight'>, val: string) => void
  onRemove: () => void; showRating: boolean
}) {
  const [showDetails, setShowDetails] = useState(false)
  return (
    <div className={`rounded-xl border border-l-4 border-l-green-400 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-gray-100'} p-4 space-y-3`}>
      <div className="flex gap-2 items-start">
        <PlacesAutocomplete value={item.name} onChange={val => onUpdate('name', val)}
          type="activity" placeholder="e.g. Temple tour, Hiking, Museum visit" className={inputClass} />
        <button type="button" onClick={onRemove} className="mt-1.5 text-gray-400 hover:text-red-500 text-xl leading-none shrink-0">×</button>
      </div>
      {showRating && (
        <div className="flex items-center gap-2"><span className="text-xs text-gray-600 shrink-0">Rate it!</span><StarRating value={item.rating} onChange={v => onUpdate('rating', String(v))} /></div>
      )}
      <button type="button" onClick={() => setShowDetails(value => !value)} className="text-xs font-medium text-gray-500 hover:text-gray-800">
        {showDetails ? '− Hide details' : '+ Add details'}
      </button>
      {showDetails && <>
      <div className="grid gap-2">
        <input type="text" value={item.notes} onChange={e => onUpdate('notes', e.target.value)} className={subInputClass} placeholder="📝 Notes (optional)" />
        <input type="url" value={item.link} onChange={e => onUpdate('link', e.target.value)} className={subInputClass} placeholder="🔗 Website link (optional)" />
      </div>
      </>}
    </div>
  )
}

// ── Steps ─────────────────────────────────────────────────────────────────────
const STEPS = ['start', 'basics', 'places', 'photos', 'picks', 'details'] as const
type Step = typeof STEPS[number] | 'review'

export default function CreatePage() {
  const [formError, setFormError] = useState<string | undefined>()
  const [pending, setPending] = useState(false)
  const [step, setStep] = useState<Step>('start')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tripMonth, setTripMonth] = useState('')
  const [tripDays, setTripDays] = useState('')
  const [postType, setPostType] = useState<'itinerary' | 'guide'>('itinerary')
  const [tripAudience, setTripAudience] = useState<'family' | 'friends' | 'romantic' | 'adult'>('family')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tripRating, setTripRating] = useState<number | null>(null)
  const [destinations, setDestinations] = useState<Destination[]>([emptyDest()])
  const computedHighlightNames = destinations
    .flatMap(d => d.groups.flatMap(g => g.days.flatMap(day => [...day.food, ...day.activities])))
    .filter(i => i.isHighlight && i.name.trim())
    .map(i => i.name.trim())
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null)
  const [failedPhotoFiles, setFailedPhotoFiles] = useState<File[]>([])
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [extractProgress, setExtractProgress] = useState<{ current: number; total: number } | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [importSources, setImportSources] = useState<string[]>([])
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set())
  const [importStage, setImportStage] = useState<'uploading' | 'reading' | 'organizing' | null>(null)
  const importAbortRef = useRef<AbortController | null>(null)

  const showRating = postType === 'itinerary'
  const stepIndex = step === 'review' ? -1 : STEPS.indexOf(step)

  function goNext() { setStep(STEPS[stepIndex + 1]) }
  function goBack() { setStep(STEPS[stepIndex - 1]) }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(isDraft: boolean) {
    setPending(true)
    setFormError(undefined)
    const { startDate, endDate } = dateRangeFromMonthAndDays(tripMonth, tripDays)
    const submittableDests = destinations.map(dest => ({
      ...dest,
      groups: dest.groups.map(group => ({
        ...group,
        days: group.days.map(day => ({
          ...day,
          food: day.food.map(f => ({ ...f, tags: f.isHighlight ? [...f.tags.filter(t => t !== '__highlight'), '__highlight'] : f.tags })),
          activities: day.activities.map(a => ({ ...a, tags: a.isHighlight ? ['__highlight'] : [] })),
        })),
      })),
    }))
    const result = await createItineraryDirect({
      title, description, startDate, endDate, notes,
      highlights: computedHighlightNames.join('\n'),
      destinations: submittableDests, photos, tags, tripRating,
      postType, audience: tripAudience,
      visibility: 'public',
      isDraft,
    })
    setPending(false)
    if (result?.error) setFormError(result.error)
  }

  // ── Import ────────────────────────────────────────────────────────────────
  async function fetchExtraction(payload: { text: string } | { base64: string; mediaType: string } | { blobUrl: string; mediaType: string; filename: string }, label = 'your file', externalSignal?: AbortSignal): Promise<ExtractionData> {
    if ('text' in payload && !payload.text.trim()) throw new Error('No text to extract from.')
    let lastError: unknown
    // Retrying is safe: extraction only reads the document and does not write data.
    for (let attempt = 0; attempt < 2; attempt++) {
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
        if (res.ok) return res.json()
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

  function applyExtractionResults(results: ExtractionData[], sources: string[]) {
    const first = results[0]
    if (first.title) setTitle(first.title)
    if (first.description) setDescription(first.description)
    const extractedDates = monthAndDaysFromDates(first.startDate, first.endDate)
    if (extractedDates.month) setTripMonth(extractedDates.month)
    if (extractedDates.days) setTripDays(extractedDates.days)
    if (first.notes) setNotes(first.notes)
    const allDests = results.flatMap(r => Array.isArray(r.destinations) && r.destinations.length > 0 ? mapExtractionDests(r.destinations) : [])
    if (allDests.length > 0) setDestinations(allDests)
    setImportSources(sources)
    setStep('review')
  }

  async function handlePasteExtract() {
    if (!pasteText.trim()) return
    setExtracting(true)
    setExtractError(null)
    const controller = new AbortController()
    importAbortRef.current = controller
    setImportStage('organizing')
    try {
      const data = await fetchExtraction({ text: pasteText }, 'your pasted text', controller.signal)
      applyExtractionResults([data], ['Pasted text'])
      setPasteMode(false)
      setPasteText('')
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setExtracting(false)
      setImportStage(null)
      if (importAbortRef.current === controller) importAbortRef.current = null
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
  function toggleDetails(key: string) {
    setExpandedDetails(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleExtractAll() {
    if (pendingFiles.length === 0) return
    setExtracting(true)
    setExtractError(null)
    setExtractProgress(pendingFiles.length > 1 ? { current: 0, total: pendingFiles.length } : null)
    const results: ExtractionData[] = []
    const controller = new AbortController()
    importAbortRef.current = controller
    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        if (pendingFiles.length > 1) setExtractProgress({ current: i + 1, total: pendingFiles.length })
        setImportStage('uploading')
        const payload = await readFileForUpload(pendingFiles[i], controller.signal)
        setImportStage('organizing')
        results.push(await fetchExtraction(payload, pendingFiles[i].name, controller.signal))
      }
      applyExtractionResults(results, pendingFiles.map(file => file.name))
      setPendingFiles([])
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setExtracting(false)
      setExtractProgress(null)
      setImportStage(null)
      if (importAbortRef.current === controller) importAbortRef.current = null
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
      const { priceLevel, lat, lng, website } = await res.json()
      updGroup(di, gi, g => ({
        ...g,
        ...(priceLevel !== null ? { hotelPriceLevel: priceLevel } : {}),
        ...(lat !== null ? { hotelLat: lat, hotelLng: lng } : {}),
        ...(!g.hotelLink && website ? { hotelLink: website } : {}),
      }))
    } catch { /* ignore */ }
  }
  function updDay(di: number, gi: number, dyi: number, fn: (d: DayGroup) => DayGroup) {
    updGroup(di, gi, g => ({ ...g, days: g.days.map((d, i) => i !== dyi ? d : fn(d)) }))
  }
  function addDay(di: number, gi: number) { updGroup(di, gi, g => ({ ...g, days: [...g.days, emptyDay()] })) }
  function removeDay(di: number, gi: number, dyi: number) { updGroup(di, gi, g => ({ ...g, days: g.days.filter((_, i) => i !== dyi) })) }
  function addFood(di: number, gi: number, dyi: number) { updDay(di, gi, dyi, d => ({ ...d, food: [...d.food, emptyFood()] })) }
  function removeFood(di: number, gi: number, dyi: number, ii: number) { updDay(di, gi, dyi, d => ({ ...d, food: d.food.filter((_, j) => j !== ii) })) }
  function updateFood(di: number, gi: number, dyi: number, ii: number, field: keyof Omit<FoodItem, 'priceLevel' | 'familyFriendly' | 'tags'>, val: string) {
    updDay(di, gi, dyi, d => ({ ...d, food: d.food.map((f, j) => j !== ii ? f : { ...f, [field]: field === 'rating' ? Number(val) : val }) }))
  }
  function setFoodPriceLevel(di: number, gi: number, dyi: number, ii: number, val: number | null) {
    updDay(di, gi, dyi, d => ({ ...d, food: d.food.map((f, j) => j !== ii ? f : { ...f, priceLevel: val }) }))
  }
  function setFoodFamilyFriendly(di: number, gi: number, dyi: number, ii: number, val: boolean | null) {
    updDay(di, gi, dyi, d => ({ ...d, food: d.food.map((f, j) => j !== ii ? f : { ...f, familyFriendly: val, familyFriendlySource: val !== null ? 'user' : null }) }))
  }
  async function fetchFoodPriceLevel(di: number, gi: number, dyi: number, ii: number, placeId: string) {
    try {
      const res = await fetch(`/api/place-details?id=${encodeURIComponent(placeId)}`)
      const { priceLevel, lat, lng, website } = await res.json()
      if (priceLevel !== null) setFoodPriceLevel(di, gi, dyi, ii, priceLevel)
      if (lat !== null || website) updDay(di, gi, dyi, d => ({ ...d, food: d.food.map((f, j) => j !== ii ? f : { ...f, lat: lat ?? f.lat, lng: lng ?? f.lng, link: !f.link && website ? website : f.link }) }))
    } catch { /* ignore */ }
  }
  function toggleFoodTag(di: number, gi: number, dyi: number, ii: number, tag: string) {
    updDay(di, gi, dyi, d => ({ ...d, food: d.food.map((f, j) => j !== ii ? f : { ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] }) }))
  }
  function setTopPickFood(di: number, name: string | null) {
    setDestinations(dests => dests.map((dest, i) => i !== di ? dest : {
      ...dest,
      groups: dest.groups.map(g => ({
        ...g,
        days: g.days.map(d => ({
          ...d,
          food: d.food.map(f => ({ ...f, isHighlight: name !== null && f.name.trim() === name }))
        }))
      }))
    }))
  }
  function setTopPickActivity(di: number, name: string | null) {
    setDestinations(dests => dests.map((dest, i) => i !== di ? dest : {
      ...dest,
      groups: dest.groups.map(g => ({
        ...g,
        days: g.days.map(d => ({
          ...d,
          activities: d.activities.map(a => ({ ...a, isHighlight: name !== null && a.name.trim() === name }))
        }))
      }))
    }))
  }
  function addActivity(di: number, gi: number, dyi: number) { updDay(di, gi, dyi, d => ({ ...d, activities: [...d.activities, emptyActivity()] })) }
  function removeActivity(di: number, gi: number, dyi: number, ii: number) { updDay(di, gi, dyi, d => ({ ...d, activities: d.activities.filter((_, j) => j !== ii) })) }
  function updateActivity(di: number, gi: number, dyi: number, ii: number, field: keyof Omit<ActivityItem, 'isHighlight'>, val: string) {
    updDay(di, gi, dyi, d => ({ ...d, activities: d.activities.map((a, j) => j !== ii ? a : { ...a, [field]: field === 'rating' ? Number(val) : val }) }))
  }

  // ── Photos ────────────────────────────────────────────────────────────────
  async function uploadPhotos(files: File[]) {
    if (!files.length) return
    setUploading(true)
    setPhotoUploadError(null)
    setFailedPhotoFiles([])
    try {
      const results = await Promise.all(files.map(async file => {
        const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
        try {
          const blob = await upload(uniqueName, file, { access: 'private', handleUploadUrl: '/api/upload' })
          return { url: `/api/img?url=${encodeURIComponent(blob.url)}`, caption: '' }
        } catch {
          return { failed: file }
        }
      }))
      const uploaded = results.filter((r): r is UploadedPhoto => 'url' in r)
      const failed = results.filter((r): r is { failed: File } => 'failed' in r).map(r => r.failed)
      setPhotos(p => [...p, ...uploaded])
      if (failed.length > 0) {
        setFailedPhotoFiles(failed)
        setPhotoUploadError(`${failed.length} photo${failed.length === 1 ? '' : 's'} could not be uploaded.`)
      }
    } finally {
      setUploading(false)
    }
  }
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    await uploadPhotos(files)
  }
  function cancelImport() { importAbortRef.current?.abort() }
  function removePhoto(i: number) { setPhotos(p => p.filter((_, idx) => idx !== i)) }
  function updateCaption(i: number, val: string) { setPhotos(p => p.map((ph, idx) => idx === i ? { ...ph, caption: val } : ph)) }

  const hasItems = destinations.some(d => d.groups.some(g => g.hotelName.trim() || g.days.some(day => day.food.some(f => f.name.trim()) || day.activities.some(a => a.name.trim()))))
  const importSummary = {
    destinations: destinations.filter(d => d.name.trim()).length,
    hotels: destinations.flatMap(d => d.groups).filter(g => g.hotelName.trim()).length,
    restaurants: destinations.flatMap(d => d.groups).flatMap(g => g.days).flatMap(d => d.food).filter(f => f.name.trim()).length,
    activities: destinations.flatMap(d => d.groups).flatMap(g => g.days).flatMap(d => d.activities).filter(a => a.name.trim()).length,
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto px-4 py-8">

      {/* Progress bar (hidden on start step) */}
      {step !== 'start' && step !== 'review' && (
        <div className="mb-7 grid grid-cols-5 gap-1">
          {([
            ['basics', 'Basics'],
            ['places', 'Places'],
            ['photos', 'Photos'],
            ['picks', 'Picks'],
            ['details', 'Finish'],
          ] as const).map(([stepName, label], index) => {
            const isComplete = stepIndex > index + 1
            const isCurrent = step === stepName
            return (
              <div key={stepName} className="min-w-0">
                <div className={`h-1.5 rounded-full transition-colors ${isComplete || isCurrent ? 'bg-blue-600' : 'bg-gray-200'}`} />
                <p className={`mt-1.5 text-center text-[11px] font-medium truncate ${isCurrent ? 'text-blue-700' : isComplete ? 'text-blue-600' : 'text-gray-400'}`}>
                  {index + 1} {label}
                </p>
              </div>
            )
          })}
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
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 space-y-2">
                  <p className="text-xs font-medium text-blue-800">
                    {importStage === 'uploading' ? 'Uploading securely…' :
                      importStage === 'reading' ? 'Reading your file…' :
                      'Organizing your trip…'}
                  </p>
                  <p className="text-xs text-blue-600">
                    {extractProgress ? `File ${extractProgress.current} of ${extractProgress.total}` : 'Large PDFs can take a few minutes.'}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-blue-700">
                    <span className={importStage === 'uploading' ? 'font-semibold' : ''}>1 Upload</span><span>→</span>
                    <span className={importStage === 'reading' || importStage === 'organizing' ? 'font-semibold' : ''}>2 Read</span><span>→</span>
                    <span className={importStage === 'organizing' ? 'font-semibold' : ''}>3 Organize</span><span>→</span>
                    <span>4 Review</span>
                  </div>
                  <button type="button" onClick={cancelImport} className="text-xs font-medium text-blue-700 underline hover:text-blue-900">Cancel import</button>
                </div>
              )}
            </div>

            <button type="button" onClick={() => setStep('basics')}
              className="w-full py-3.5 rounded-2xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
              Start from scratch →
            </button>
          </div>
        )}

        {/* ── IMPORT REVIEW ─────────────────────────────────────────────── */}
        {step === 'review' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <div>
              <p className="text-3xl mb-2">✨</p>
              <h1 className="text-xl font-bold text-gray-900">Your trip is ready to review</h1>
              <p className="text-sm text-gray-500 mt-1">
                We organized {importSources.length === 1 ? 'your file' : `${importSources.length} files`} into a draft. You can edit everything before publishing.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ['Destinations', importSummary.destinations],
                ['Hotels', importSummary.hotels],
                ['Restaurants', importSummary.restaurants],
                ['Activities', importSummary.activities],
              ].map(([label, count]) => (
                <div key={String(label)} className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                  <p className="text-xl font-bold text-blue-800">{count}</p>
                  <p className="text-xs font-medium text-blue-700">{label}</p>
                </div>
              ))}
            </div>

            {importSources.length > 1 && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                We combined places from all {importSources.length} files. Trip title and dates come from the first file when available.
              </p>
            )}

            {importSummary.destinations === 0 && (
              <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                We couldn&apos;t confidently identify any destinations. Continue to add them yourself, or try a clearer file.
              </div>
            )}

            <div className="rounded-xl border border-gray-200 p-4 space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trip details</p>
              <p className="font-medium text-gray-900">{title || 'No title found yet'}</p>
              <p className="text-sm text-gray-500">
                {tripMonth && tripDays ? `${tripMonth} · ${tripDays} days` : 'No travel dates found yet'}
              </p>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('start')}
                className="px-4 py-3 text-sm font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
                Try another file
              </button>
              <button type="button" onClick={() => setStep('basics')}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
                Review and continue
              </button>
            </div>
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
                  <label htmlFor="tripMonth" className={labelClass}>Month and year *</label>
                  <input id="tripMonth" type="month" className={inputClass} value={tripMonth} onChange={e => setTripMonth(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="tripDays" className={labelClass}>Number of days *</label>
                  <input id="tripDays" type="number" min="1" step="1" inputMode="numeric" placeholder="e.g. 8" className={inputClass} value={tripDays} onChange={e => setTripDays(e.target.value)} />
                </div>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <p className={labelClass}>Trip type</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'family', label: '👨‍👩‍👧 Family' },
                  { value: 'friends', label: '🥳 Friends' },
                  { value: 'romantic', label: '💋 Romantic' },
                  { value: 'adult', label: '🍷 Other' },
                ].map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => setTripAudience(value as typeof tripAudience)}
                    className={`text-sm px-3 py-1.5 rounded-full border font-medium transition-colors ${tripAudience === value ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                    {label}
                  </button>
                ))}
              </div>
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
                          <button type="button" onClick={() => toggleDetails(`${di}-${gi}-hotel`)} className="text-xs font-medium text-blue-700 hover:text-blue-900">
                            {expandedDetails.has(`${di}-${gi}-hotel`) ? '− Hide details' : '+ Add details'}
                          </button>
                          {expandedDetails.has(`${di}-${gi}-hotel`) && <>
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
                          </>}
                        </>)}
                      </div>
                      {/* Days */}
                      {group.days.map((day, dyi) => (
                        <div key={dyi} className="rounded-xl border border-gray-100 overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Day {dyi + 1}</span>
                            {group.days.length > 1 && (
                              <button type="button" onClick={() => removeDay(di, gi, dyi)} className="text-xs text-red-400 hover:text-red-600 font-medium">Remove day</button>
                            )}
                          </div>
                          <div className="p-3 space-y-3">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🍜 Food & Drink</p>
                              {day.food.length === 0 && <p className="text-xs text-gray-400 italic">None added yet.</p>}
                              <div className="space-y-3">{day.food.map((item, ii) => <FoodRow key={ii} item={item} index={ii} showRating={showRating} onUpdate={(f, v) => updateFood(di, gi, dyi, ii, f, v)} onUpdateFF={v => setFoodFamilyFriendly(di, gi, dyi, ii, v)} onToggleTag={tag => toggleFoodTag(di, gi, dyi, ii, tag)} onRemove={() => removeFood(di, gi, dyi, ii)} onSelectPlace={id => id ? fetchFoodPriceLevel(di, gi, dyi, ii, id) : setFoodPriceLevel(di, gi, dyi, ii, null)} />)}</div>
                              <button type="button" onClick={() => addFood(di, gi, dyi)} className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium border border-dashed border-blue-300 hover:border-blue-500 rounded-lg py-2 transition-colors">+ Add food / drink</button>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🎯 Activities</p>
                              {day.activities.length === 0 && <p className="text-xs text-gray-400 italic">None added yet.</p>}
                              <div className="space-y-3">{day.activities.map((item, ii) => <ActivityRow key={ii} item={item} index={ii} showRating={showRating} onUpdate={(f, v) => updateActivity(di, gi, dyi, ii, f, v)} onRemove={() => removeActivity(di, gi, dyi, ii)} />)}</div>
                              <button type="button" onClick={() => addActivity(di, gi, dyi)} className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium border border-dashed border-blue-300 hover:border-blue-500 rounded-lg py-2 transition-colors">+ Add activity</button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={() => addDay(di, gi)} className="w-full text-xs text-gray-500 hover:text-blue-600 border border-dashed border-gray-200 hover:border-blue-300 rounded-lg py-2 transition-colors">+ Add day</button>
                    </div>
                  </div>
                ))}

                <button type="button" onClick={() => addGroup(di)}
                  className="w-full text-sm text-gray-500 hover:text-blue-600 border border-dashed border-gray-300 hover:border-blue-300 rounded-xl py-2.5 transition-colors">
                  + Add stay (new hotel)
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
            {photoUploadError && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <span>{photoUploadError}</span>
                <button type="button" onClick={() => uploadPhotos(failedPhotoFiles)} disabled={uploading} className="shrink-0 font-semibold underline disabled:opacity-50">Retry</button>
              </div>
            )}
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

        {/* ── PICKS ──────────────────────────────────────────────────────── */}
        {step === 'picks' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900 text-lg">Top Picks</h2>
              <p className="text-sm text-gray-500 mt-0.5">Select your favourite restaurant and activity for each destination.</p>
            </div>
            {destinations.map((dest, di) => {
              const allFood = dest.groups.flatMap(g => g.days.flatMap(d => d.food)).filter(f => f.name.trim())
              const allActs = dest.groups.flatMap(g => g.days.flatMap(d => d.activities)).filter(a => a.name.trim())
              if (allFood.length === 0 && allActs.length === 0) return null
              const topFood = allFood.find(f => f.isHighlight)?.name ?? null
              const topAct  = allActs.find(a => a.isHighlight)?.name ?? null
              return (
                <div key={di} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                  {destinations.length > 1 && (
                    <h3 className="font-medium text-gray-900 text-sm">{dest.name || `Destination ${di + 1}`}</h3>
                  )}
                  {allFood.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">🍽️ Top restaurant</p>
                      <div className="space-y-1.5">
                        {allFood.map(f => (
                          <button key={f.name} type="button"
                            onClick={() => setTopPickFood(di, topFood === f.name ? null : f.name)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${topFood === f.name ? 'bg-amber-50 border-amber-300 text-amber-900 font-medium' : 'border-gray-200 text-gray-700 hover:border-amber-200'}`}>
                            {topFood === f.name ? '⭐ ' : ''}{f.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {allActs.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">📍 Top activity</p>
                      <div className="space-y-1.5">
                        {allActs.map(a => (
                          <button key={a.name} type="button"
                            onClick={() => setTopPickActivity(di, topAct === a.name ? null : a.name)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${topAct === a.name ? 'bg-amber-50 border-amber-300 text-amber-900 font-medium' : 'border-gray-200 text-gray-700 hover:border-amber-200'}`}>
                            {topAct === a.name ? '⭐ ' : ''}{a.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {destinations.every(d => d.groups.flatMap(g => g.days.flatMap(day => [...day.food, ...day.activities])).filter(i => i.name.trim()).length === 0) && (
              <p className="text-sm text-gray-400 italic">No restaurants or activities added yet — go back to Places.</p>
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
              <h3 className="font-medium text-gray-900 mb-1 text-sm">⭐ Top Picks</h3>
              {computedHighlightNames.length > 0 ? (
                <ul className="space-y-1.5 mt-2">
                  {computedHighlightNames.map((name, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-amber-900">
                      <span>⭐</span><span>{name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-amber-700 italic mt-2">No top picks selected. Go back to choose your favourites.</p>
              )}
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

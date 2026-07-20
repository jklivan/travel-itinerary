'use client'

import { useActionState, useState } from 'react'
import { createItinerary } from '@/actions/itinerary'

async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mime = file.type

  // PDF
  if (ext === 'pdf' || mime === 'application/pdf') {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const pages: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
    }
    return pages.join('\n\n')
  }

  // Excel
  if (ext === 'xlsx' || ext === 'xls' || mime.includes('spreadsheet') || mime.includes('excel')) {
    const XLSX = await import('xlsx')
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    return workbook.SheetNames.map((name) =>
      `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`
    ).join('\n\n')
  }

  // CSV or plain text — read as-is
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve((e.target?.result as string) ?? '')
    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.readAsText(file)
  })
}

type FoodItem     = { name: string; mealType: string; notes: string; link: string; rating: number }
type ActivityItem = { name: string; notes: string; link: string; rating: number }
type StayGroup    = { hotelName: string; hotelNotes: string; hotelLink: string; hotelRating: number; food: FoodItem[]; activities: ActivityItem[] }
type Destination  = { name: string; country: string; groups: StayGroup[] }
type UploadedPhoto = { url: string; caption: string }

const emptyFood     = (): FoodItem     => ({ name: '', mealType: '', notes: '', link: '', rating: 0 })
const emptyActivity = (): ActivityItem => ({ name: '', notes: '', link: '', rating: 0 })
const emptyGroup    = (): StayGroup    => ({ hotelName: '', hotelNotes: '', hotelLink: '', hotelRating: 0, food: [], activities: [] })
const emptyDest     = (): Destination  => ({ name: '', country: '', groups: [emptyGroup()] })

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-900 mb-1'

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

const subInputClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400'
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
        <input type="text" value={item.name} onChange={e => onUpdate('name', e.target.value)}
          className={inputClass} placeholder="e.g. Ramen Ichiran, Rooftop bar, Street market" />
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
        <input type="text" value={item.name} onChange={e => onUpdate('name', e.target.value)}
          className={inputClass} placeholder="e.g. Temple tour, Hiking, Museum visit" />
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

export default function CreatePage() {
  const [state, action, pending] = useActionState(createItinerary, undefined)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [postType, setPostType] = useState<'itinerary' | 'guide'>('itinerary')
  const [isAdult, setIsAdult] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [notes, setNotes] = useState('')
  const [destinations, setDestinations] = useState<Destination[]>([emptyDest()])
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')

  // ── Shared extraction logic ───────────────────────────────────────────────
  async function runExtraction(text: string) {
    if (!text.trim()) throw new Error('No text to extract from.')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45000)
    let res: Response
    try {
      res = await fetch('/api/extract-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Extraction failed.')
    }
    const data = await res.json()
    if (data.title) setTitle(data.title)
    if (data.description) setDescription(data.description)
    if (data.startDate) setStartDate(data.startDate)
    if (data.endDate) setEndDate(data.endDate)
    if (data.notes) setNotes(data.notes)
    if (Array.isArray(data.destinations) && data.destinations.length > 0) {
      setDestinations(
        data.destinations.map((d: { name?: string; country?: string; items?: { type: string; mealType?: string; name: string; notes?: string; link?: string }[] }) => {
          const items = Array.isArray(d.items) ? d.items : []
          const hotels = items.filter(i => i.type === 'hotel')
          const food   = items.filter(i => i.type === 'food_drink').map(f => ({ name: f.name ?? '', mealType: f.mealType ?? '', notes: f.notes ?? '', link: f.link ?? '', rating: 0 }))
          const acts   = items.filter(i => i.type === 'activity').map(a => ({ name: a.name ?? '', notes: a.notes ?? '', link: a.link ?? '', rating: 0 }))
          const groups: StayGroup[] = hotels.length === 0
            ? [{ hotelName: '', hotelNotes: '', hotelLink: '', hotelRating: 0, food, activities: acts }]
            : hotels.map((h, hi) => ({ hotelName: h.name ?? '', hotelNotes: h.notes ?? '', hotelLink: h.link ?? '', hotelRating: 0, food: hi === 0 ? food : [], activities: hi === 0 ? acts : [] }))
          return { name: d.name ?? '', country: d.country ?? '', groups }
        })
      )
    }
  }

  // ── Paste text extraction ─────────────────────────────────────────────────
  async function handlePasteExtract() {
    if (!pasteText.trim()) return
    setExtracting(true)
    setExtractError(null)
    try {
      await runExtraction(pasteText)
      setPasteMode(false)
      setPasteText('')
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setExtracting(false)
    }
  }

  // ── Document import ───────────────────────────────────────────────────────
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    setExtractError(null)
    try {
      const text = await extractTextFromFile(file)
      await runExtraction(text)
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setExtracting(false)
      e.target.value = ''
    }
  }

  // ── Destinations ──────────────────────────────────────────────────────────
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

  // ── Photos ────────────────────────────────────────────────────────────────
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

  const showRating = postType === 'itinerary'

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Post an Itinerary</h1>
      <p className="text-gray-500 text-sm mb-6">Share your trip with the world.</p>

      {/* ── Document Import ─────────────────────────────────────────────── */}
      <div className="mb-8 bg-blue-50 border border-blue-200 rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl">📄</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-blue-900 text-sm">Import itinerary</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Upload a file or paste text (email, notes, etc.) and we&apos;ll fill in the fields automatically.
            </p>
          </div>
        </div>

        {/* Buttons row */}
        <div className="flex gap-2 mb-3">
          <label className={`flex-1 text-center cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors border ${
            extracting
              ? 'bg-blue-100 text-blue-300 border-blue-200 cursor-not-allowed'
              : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-600 hover:text-white hover:border-blue-600'
          }`}>
            {extracting ? 'Extracting…' : '📎 Upload file'}
            <input type="file"
              accept=".pdf,.xlsx,.xls,.csv,.txt,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain"
              className="sr-only"
              onChange={handleImport} disabled={extracting} />
          </label>
          <button
            type="button"
            disabled={extracting}
            onClick={() => { setPasteMode((v) => !v); setExtractError(null) }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors border ${
              pasteMode
                ? 'bg-blue-600 text-white border-blue-600'
                : extracting
                ? 'bg-blue-100 text-blue-300 border-blue-200 cursor-not-allowed'
                : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-600 hover:text-white hover:border-blue-600'
            }`}>
            📋 Paste text
          </button>
        </div>

        {/* Paste text area */}
        {pasteMode && (
          <div className="space-y-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your itinerary text here — email confirmation, notes, booking details…"
              rows={6}
              className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePasteExtract}
                disabled={extracting || !pasteText.trim()}
                className="flex-1 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                {extracting ? 'Extracting…' : 'Extract itinerary'}
              </button>
              <button
                type="button"
                onClick={() => { setPasteMode(false); setPasteText(''); setExtractError(null) }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {extractError && (
          <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {extractError}
          </p>
        )}
        {extracting && (
          <p className="mt-2 text-xs text-blue-700 animate-pulse">Reading your itinerary…</p>
        )}
      </div>

      <form action={action} className="space-y-8">
        <input type="hidden" name="destinations" value={JSON.stringify(destinations)} />
        <input type="hidden" name="photos" value={JSON.stringify(photos)} />
        <input type="hidden" name="audience" value={isAdult ? 'adult' : 'family'} />
        <input type="hidden" name="visibility" value={isPrivate ? 'private' : 'public'} />
        <input type="hidden" name="postType" value={postType} />

        {state?.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {state.error}
          </p>
        )}

        {/* ── Basic Info ─────────────────────────────────────────────── */}
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
            <input id="title" name="title" type="text" required className={inputClass}
              placeholder="e.g. 2 weeks through Southeast Asia"
              value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label htmlFor="description" className={labelClass}>Short description</label>
            <textarea id="description" name="description" rows={2} className={inputClass}
              placeholder="A brief summary of the trip…"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {postType === 'itinerary' && (
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
          )}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setIsAdult((v) => !v)}
              className={`w-10 h-6 rounded-full transition-colors relative ${!isAdult ? 'bg-green-500' : 'bg-gray-200'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${!isAdult ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm text-gray-900">Family friendly</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setIsPrivate((v) => !v)}
              className={`w-10 h-6 rounded-full transition-colors relative ${isPrivate ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm text-gray-900">
              {isPrivate ? 'Private — only visible to you' : 'Public — visible to everyone'}
            </span>
          </label>
        </section>

        {/* ── Destinations ───────────────────────────────────────────── */}
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
                  <input type="text" value={dest.name} onChange={e => updateDest(di, 'name', e.target.value)}
                    className={inputClass} placeholder={`City / place${destinations.length > 1 ? ` ${di + 1}` : ''}`} />
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
                      <input type="text" value={group.hotelName} onChange={e => updateHotel(di, gi, 'hotelName', e.target.value)}
                        className={inputClass} placeholder="Hotel name (optional)" />
                      {group.hotelName && (<>
                        {showRating && <div className="flex items-center gap-2"><span className="text-xs text-gray-600">Rate it!</span><StarRating value={group.hotelRating} onChange={v => updateHotel(di, gi, 'hotelRating', String(v))} /></div>}
                        <input type="text" value={group.hotelNotes} onChange={e => updateHotel(di, gi, 'hotelNotes', e.target.value)} className={subInputClass} placeholder="📝 Notes (optional)" />
                        <input type="url" value={group.hotelLink} onChange={e => updateHotel(di, gi, 'hotelLink', e.target.value)} className={subInputClass} placeholder="🔗 Website link (optional)" />
                      </>)}
                    </div>
                    {/* Food & Drink */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🍜 Food & Drink</p>
                      {group.food.length === 0 && <p className="text-xs text-gray-400 italic">None added yet.</p>}
                      <div className="space-y-3">{group.food.map((item, ii) => <FoodRow key={ii} item={item} index={ii} showRating={showRating} onUpdate={(f, v) => updateFood(di, gi, ii, f, v)} onRemove={() => removeFood(di, gi, ii)} />)}</div>
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
                className="w-full text-sm text-gray-500 hover:text-blue-600 border border-dashed border-gray-300 hover:border-blue-300 rounded-xl py-3 transition-colors">
                + Add another stay (different hotel)
              </button>
            </div>
          ))}
        </section>

        {/* ── Notes ──────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">General Notes</h2>
          <textarea name="notes" rows={3} className={inputClass}
            placeholder="Tips, packing list, visa info, anything useful for other travellers…"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </section>

        {/* ── Photos ─────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Photos</h2>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-indigo-400 transition-colors">
            <span className="text-2xl mb-2">📸</span>
            <span className="text-sm font-medium text-gray-600">
              {uploading ? 'Uploading…' : 'Click to upload photos'}
            </span>
            <span className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP, GIF</span>
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
                    className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    placeholder="Caption (optional)" />
                </div>
              ))}
            </div>
          )}
        </section>

        <button type="submit" disabled={pending || uploading}
          className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-60 text-base">
          {pending ? 'Publishing…' : 'Publish Itinerary'}
        </button>
      </form>
    </div>
  )
}

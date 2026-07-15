'use client'

import { useActionState, useState } from 'react'
import { createItinerary } from '@/actions/itinerary'
async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(pageText)
  }
  return pages.join('\n\n')
}

type DestItem = { type: 'activity' | 'food_drink'; name: string; notes: string; rating: number; link: string }
type Destination = { name: string; country: string; items: DestItem[] }
type UploadedPhoto = { url: string; caption: string }

const emptyItem = (): DestItem => ({ type: 'activity', name: '', notes: '', rating: 0, link: '' })

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(value === star ? 0 : star)}
          className="text-lg leading-none focus:outline-none"
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >
          <span className={star <= value ? 'text-yellow-400' : 'text-gray-300'}>★</span>
        </button>
      ))}
    </div>
  )
}
const emptyDest = (): Destination => ({ name: '', country: '', items: [emptyItem()] })

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

export default function CreatePage() {
  const [state, action, pending] = useActionState(createItinerary, undefined)

  // Basic fields (controlled so PDF import can pre-fill them)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [notes, setNotes] = useState('')

  const [destinations, setDestinations] = useState<Destination[]>([emptyDest()])
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [uploading, setUploading] = useState(false)

  // PDF import state
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)

  // ── PDF import ────────────────────────────────────────────────────────────
  async function handlePdfImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    setExtractError(null)
    try {
      // Extract text from PDF in the browser — no file upload needed
      const text = await extractTextFromPdf(file)
      if (!text.trim()) {
        throw new Error('Could not read text from this PDF. It may be a scanned image.')
      }

      const res = await fetch('/api/extract-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Extraction failed.')
      }
      const data = await res.json()
      if (data.title) setTitle(data.title)
      if (data.description) setDescription(data.description)
      if (data.startDate) setStartDate(data.startDate)
      if (data.endDate) setEndDate(data.endDate)
      if (data.budget != null) setBudget(String(data.budget))
      if (data.currency) setCurrency(data.currency)
      if (data.notes) setNotes(data.notes)
      if (Array.isArray(data.destinations) && data.destinations.length > 0) {
        setDestinations(
          data.destinations.map((d: Destination) => ({
            name: d.name ?? '',
            country: d.country ?? '',
            items: Array.isArray(d.items)
              ? d.items.map((item: DestItem) => ({
                  type: item.type ?? 'activity',
                  name: item.name ?? '',
                  notes: item.notes ?? '',
                  rating: 0,
                  link: item.link ?? '',
                }))
              : [],
          }))
        )
      }
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setExtracting(false)
      e.target.value = ''
    }
  }

  // ── Destinations ──────────────────────────────────────────────────────────
  function addDest() {
    setDestinations((d) => [...d, emptyDest()])
  }
  function removeDest(i: number) {
    setDestinations((d) => d.filter((_, idx) => idx !== i))
  }
  function updateDest(i: number, field: 'name' | 'country', val: string) {
    setDestinations((d) =>
      d.map((dest, idx) => (idx === i ? { ...dest, [field]: val } : dest))
    )
  }

  // ── Items (per destination) ───────────────────────────────────────────────
  function addItem(destIdx: number, type: 'activity' | 'food_drink') {
    setDestinations((d) =>
      d.map((dest, i) =>
        i === destIdx ? { ...dest, items: [...dest.items, { type, name: '', notes: '', rating: 0, link: '' }] } : dest
      )
    )
  }
  function removeItem(destIdx: number, itemIdx: number) {
    setDestinations((d) =>
      d.map((dest, i) =>
        i === destIdx
          ? { ...dest, items: dest.items.filter((_, j) => j !== itemIdx) }
          : dest
      )
    )
  }
  function updateItem(
    destIdx: number,
    itemIdx: number,
    field: keyof DestItem,
    val: string
  ) {
    setDestinations((d) =>
      d.map((dest, i) =>
        i === destIdx
          ? {
              ...dest,
              items: dest.items.map((item, j) =>
                j === itemIdx
                  ? { ...item, [field]: field === 'rating' ? Number(val) : val }
                  : item
              ),
            }
          : dest
      )
    )
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
  function removePhoto(i: number) {
    setPhotos((p) => p.filter((_, idx) => idx !== i))
  }
  function updateCaption(i: number, val: string) {
    setPhotos((p) => p.map((ph, idx) => (idx === i ? { ...ph, caption: val } : ph)))
  }

  const activities = (dest: Destination) => dest.items.filter((it) => it.type === 'activity')
  const foodDrink = (dest: Destination) => dest.items.filter((it) => it.type === 'food_drink')

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Post an Itinerary</h1>
      <p className="text-gray-500 text-sm mb-6">Share your trip with the world.</p>

      {/* ── PDF Import ─────────────────────────────────────────────────── */}
      <div className="mb-8 bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📄</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-indigo-900 text-sm">Import from PDF</p>
            <p className="text-xs text-indigo-600 mt-0.5">
              Upload a PDF itinerary and we&apos;ll extract the details automatically.
              Only confirmed trip items are imported — no AI suggestions.
            </p>
            {extractError && (
              <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {extractError}
              </p>
            )}
            {extracting && (
              <p className="mt-2 text-xs text-indigo-700 animate-pulse">
                Reading your itinerary…
              </p>
            )}
          </div>
          <label className={`shrink-0 cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            extracting
              ? 'bg-indigo-200 text-indigo-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}>
            {extracting ? 'Extracting…' : 'Choose PDF'}
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={handlePdfImport}
              disabled={extracting}
            />
          </label>
        </div>
      </div>

      <form action={action} className="space-y-8">
        <input type="hidden" name="destinations" value={JSON.stringify(destinations)} />
        <input type="hidden" name="photos" value={JSON.stringify(photos)} />

        {state?.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {state.error}
          </p>
        )}

        {/* ── Basic Info ─────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Basic Info</h2>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="budget" className={labelClass}>Total budget</label>
              <input id="budget" name="budget" type="number" min="0" step="0.01"
                className={inputClass} placeholder="e.g. 3000"
                value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
            <div>
              <label htmlFor="currency" className={labelClass}>Currency</label>
              <select id="currency" name="currency" className={inputClass}
                value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {['USD','EUR','GBP','JPY','AUD','CAD','CHF','CNY','INR','MXN','BRL'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* ── Destinations ───────────────────────────────────────────── */}
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
              {/* Destination header */}
              <div className="flex gap-3 items-start">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={dest.name}
                    onChange={(e) => updateDest(destIdx, 'name', e.target.value)}
                    className={inputClass}
                    placeholder={`City / place${destinations.length > 1 ? ` ${destIdx + 1}` : ''}`}
                  />
                  <input
                    type="text"
                    value={dest.country}
                    onChange={(e) => updateDest(destIdx, 'country', e.target.value)}
                    className={inputClass}
                    placeholder="Country"
                  />
                </div>
                {destinations.length > 1 && (
                  <button type="button" onClick={() => removeDest(destIdx)}
                    className="mt-1 text-gray-400 hover:text-red-500 text-xl leading-none">×</button>
                )}
              </div>

              {/* Activities */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Activities
                  </p>
                  <button type="button" onClick={() => addItem(destIdx, 'activity')}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    + Add activity
                  </button>
                </div>
                {activities(dest).length === 0 && (
                  <p className="text-xs text-gray-400 italic">No activities yet.</p>
                )}
                {dest.items.map((item, itemIdx) =>
                  item.type !== 'activity' ? null : (
                    <div key={itemIdx} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItem(destIdx, itemIdx, 'name', e.target.value)}
                          className={inputClass}
                          placeholder="e.g. Temple tour, Hiking, Museum visit"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 shrink-0">Rate it!</span>
                          <StarRating
                            value={item.rating}
                            onChange={(v) => updateItem(destIdx, itemIdx, 'rating', String(v))}
                          />
                        </div>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => updateItem(destIdx, itemIdx, 'notes', e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          placeholder="Notes (optional)"
                        />
                        <input
                          type="url"
                          value={item.link}
                          onChange={(e) => updateItem(destIdx, itemIdx, 'link', e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          placeholder="🔗 Link (optional)"
                        />
                      </div>
                      <button type="button" onClick={() => removeItem(destIdx, itemIdx)}
                        className="mt-1.5 text-gray-400 hover:text-red-500 text-xl leading-none">×</button>
                    </div>
                  )
                )}
              </div>

              {/* Food & Drink */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Food & Drink
                  </p>
                  <button type="button" onClick={() => addItem(destIdx, 'food_drink')}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    + Add place
                  </button>
                </div>
                {foodDrink(dest).length === 0 && (
                  <p className="text-xs text-gray-400 italic">No food & drink yet.</p>
                )}
                {dest.items.map((item, itemIdx) =>
                  item.type !== 'food_drink' ? null : (
                    <div key={itemIdx} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItem(destIdx, itemIdx, 'name', e.target.value)}
                          className={inputClass}
                          placeholder="e.g. Ramen Ichiran, Rooftop bar, Street market"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 shrink-0">Rate it!</span>
                          <StarRating
                            value={item.rating}
                            onChange={(v) => updateItem(destIdx, itemIdx, 'rating', String(v))}
                          />
                        </div>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => updateItem(destIdx, itemIdx, 'notes', e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          placeholder="Notes (optional)"
                        />
                        <input
                          type="url"
                          value={item.link}
                          onChange={(e) => updateItem(destIdx, itemIdx, 'link', e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          placeholder="🔗 Link (optional)"
                        />
                      </div>
                      <button type="button" onClick={() => removeItem(destIdx, itemIdx)}
                        className="mt-1.5 text-gray-400 hover:text-red-500 text-xl leading-none">×</button>
                    </div>
                  )
                )}
              </div>
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
                  <img src={photo.url} alt=""
                    className="w-full h-32 object-cover rounded-lg" />
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

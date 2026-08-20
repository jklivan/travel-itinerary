'use client'

import { useActionState, useEffect, useState } from 'react'
import { createItinerary } from '@/actions/itinerary'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import { MapPin, Hotel, Utensils, Camera, Star, ArrowRight, Plus, Check, X, FileText, ImageIcon, GripVertical } from 'lucide-react'
import TagPicker from '@/components/TagPicker'
import Link from 'next/link'
import { TripRatingPicker } from '@/components/TripRatingPicker'
import { dateRangeFromMonthAndDays } from '@/lib/tripDates'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemType = 'hotel' | 'food_drink' | 'activity'
type ActiveInput = ItemType | 'notes' | 'photos' | null

type GuidedItem = {
  id: string
  type: ItemType
  name: string
  mealType: string
  rating: number
  notes: string
  dayIndex: number
  isHighlight: boolean
}

type GuidedDest = {
  id: string
  name: string
  country: string
  notes: string
  items: GuidedItem[]
}

type UploadedPhoto = { url: string; caption: string }

type Phase = 'dest' | 'building' | 'more' | 'details'

type SavedState = {
  dests: GuidedDest[]
  curDest: { name: string; country: string }
  curItems: GuidedItem[]
  curDayIndex: number
  curNotes: string
  photos: UploadedPhoto[]
  phase: Phase
  title: string
  tags: string[]
  postType: 'itinerary' | 'guide'
  tripMonth: string
  tripDays: string
  tripAudience: 'family' | 'friends' | 'romantic' | 'adult'
  budget: number
  tripRating: number | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSION_KEY = 'guided-trip-draft'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'drinks', 'coffee', 'dessert', 'bakery'] as const
const MEAL_EMOJI: Record<string, string> = {
  breakfast: '🍳', lunch: '☀️', dinner: '🌙', drinks: '🍹', coffee: '☕', dessert: '🍰', bakery: '🥐',
}
const MEAL_ACTIVE: Record<string, string> = {
  breakfast: 'bg-yellow-500 text-white border-yellow-500',
  lunch:     'bg-orange-500 text-white border-orange-500',
  dinner:    'bg-purple-600 text-white border-purple-600',
  drinks:    'bg-blue-500 text-white border-blue-500',
  coffee:    'bg-amber-700 text-white border-amber-700',
  dessert:   'bg-pink-500 text-white border-pink-500',
  bakery:    'bg-orange-400 text-white border-orange-400',
}

const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white'

function uid() { return Math.random().toString(36).slice(2) }

// ── Star rating ───────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button" onClick={() => onChange(value === s ? 0 : s)} className="focus:outline-none">
          <Star size={22} className={s <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
        </button>
      ))}
    </div>
  )
}

// ── Added item row (sortable) ─────────────────────────────────────────────────

function AddedRow({ item, onRemove }: { item: GuidedItem; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const icon = item.type === 'hotel' ? <Hotel size={13} className="text-blue-500 shrink-0" />
    : item.type === 'food_drink' ? <Utensils size={13} className="text-orange-500 shrink-0" />
    : <Camera size={13} className="text-green-500 shrink-0" />

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5 gap-2">
      <button type="button" {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none">
        <GripVertical size={14} />
      </button>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {icon}
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {item.mealType && <span className="text-xs text-gray-500">{item.mealType.split(',').map(type => `${MEAL_EMOJI[type]} ${type}`).join(' · ')}</span>}
            {item.rating > 0 && <span className="text-xs text-yellow-500">{'★'.repeat(item.rating)}</span>}
            {item.isHighlight && <span className="text-amber-400 text-xs">⭐</span>}
            {item.notes && <span className="text-xs text-gray-400 truncate">{item.notes}</span>}
          </div>
        </div>
      </div>
      <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-lg leading-none shrink-0">×</button>
    </div>
  )
}

// ── Inline item form ──────────────────────────────────────────────────────────

function ItemForm({ type, onAdd, onClose }: {
  type: ItemType
  onAdd: (item: Omit<GuidedItem, 'id' | 'dayIndex'>) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [mealType, setMealType] = useState('')
  const [rating, setRating] = useState(0)
  const [notes, setNotes] = useState('')
  const [isHighlight, setIsHighlight] = useState(false)

  const cfg = {
    hotel:     { color: 'bg-blue-50 border-blue-200',   label: 'Hotel / Accommodation', placeholder: 'Hotel name', placeType: 'hotel' as const },
    food_drink:{ color: 'bg-orange-50 border-orange-200', label: 'Food & Drink',         placeholder: 'e.g. Ramen Ichiran, Rooftop bar…', placeType: 'restaurant' as const },
    activity:  { color: 'bg-green-50 border-green-200',  label: 'Activity',              placeholder: 'e.g. Eiffel Tower, Temple tour…',  placeType: 'activity' as const },
  }[type]

  function submit() {
    if (!name.trim()) return
    onAdd({ type, name: name.trim(), mealType, rating, notes: notes.trim(), isHighlight })
    setName(''); setMealType(''); setRating(0); setNotes(''); setIsHighlight(false)
  }

  return (
    <div className={`rounded-2xl border ${cfg.color} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{cfg.label}</p>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>
      <PlacesAutocomplete value={name} onChange={setName} type={cfg.placeType}
        placeholder={cfg.placeholder} className={inputCls} />
      {type === 'food_drink' && (
        <div className="flex flex-wrap gap-1.5">
          {MEAL_TYPES.map(mt => {
            const selected = mealType.split(',').filter(Boolean)
            const isSelected = selected.includes(mt)
            return (
            <button key={mt} type="button" onClick={() => setMealType(isSelected ? selected.filter(type => type !== mt).join(',') : [...selected, mt].join(','))}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors capitalize ${isSelected ? MEAL_ACTIVE[mt] : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
              {MEAL_EMOJI[mt]} {mt}
            </button>
            )
          })}
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Rate it</p>
          <StarRating value={rating} onChange={setRating} />
        </div>
        {type !== 'hotel' && (
          <button type="button" onClick={() => setIsHighlight(v => !v)}
            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors self-end mb-0.5 ${isHighlight ? 'bg-amber-400 text-white border-amber-400' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
            ⭐ Highlight
          </button>
        )}
      </div>
      <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="📝 Notes (optional)" className={inputCls} />
      <button type="button" onClick={submit} disabled={!name.trim()}
        className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
        <Check size={14} /> Add
      </button>
    </div>
  )
}

// ── Completed destination summary ─────────────────────────────────────────────

function DestSummary({ dest, onRemove, onEdit }: { dest: GuidedDest; onRemove: () => void; onEdit?: () => void }) {
  const hotels = dest.items.filter(i => i.type === 'hotel')
  const nonHotels = dest.items.filter(i => i.type !== 'hotel')
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
            <Check size={12} className="text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">
            {dest.name}{dest.country ? `, ${dest.country}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {onEdit && (
            <button onClick={onEdit} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
          )}
          <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
        </div>
      </div>
      <div className="px-4 py-3 space-y-1.5 text-xs text-gray-600">
        {hotels.map(hotel => (
          <div key={hotel.id} className="flex items-center gap-1.5">
            <Hotel size={12} className="text-blue-500 shrink-0" />
            <span className="truncate">{hotel.name}</span>
            {hotel.rating > 0 && <span className="text-yellow-500 ml-1">{'★'.repeat(hotel.rating)}</span>}
          </div>
        ))}
        {nonHotels.map(item => (
          <div key={item.id} className="flex items-center gap-1.5">
            {item.type === 'food_drink'
              ? <Utensils size={12} className="text-orange-500 shrink-0" />
              : <Camera size={12} className="text-green-500 shrink-0" />}
            <span className="truncate">{item.name}</span>
            {item.mealType && <span className="text-gray-400 ml-1">{item.mealType.split(',').map(type => MEAL_EMOJI[type]).join(' ')}</span>}
            {item.rating > 0 && <span className="text-yellow-500 ml-1">{'★'.repeat(item.rating)}</span>}
          </div>
        ))}
        {dest.notes && <p className="text-gray-500 italic mt-1">📝 {dest.notes}</p>}
        {dest.items.length === 0 && !dest.notes && <span className="text-gray-400 italic">No items added</span>}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GuidedCreatePage() {
  const [formState, action, pending] = useActionState(createItinerary, undefined)

  // Restore in-progress trip from sessionStorage (survives page refresh / server errors)
  const [restored] = useState<Partial<SavedState>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })

  const [dests, setDests] = useState<GuidedDest[]>(restored.dests ?? [])
  const [curDest, setCurDest] = useState(restored.curDest ?? { name: '', country: '' })
  const [curItems, setCurItems] = useState<GuidedItem[]>(restored.curItems ?? [])
  const [curDayIndex, setCurDayIndex] = useState(restored.curDayIndex ?? 1)
  const [curNotes, setCurNotes] = useState(restored.curNotes ?? '')
  const [photos, setPhotos] = useState<UploadedPhoto[]>(restored.photos ?? [])
  const [uploading, setUploading] = useState(false)
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null)
  const [failedPhotoFiles, setFailedPhotoFiles] = useState<File[]>([])
  const [activeInput, setActiveInput] = useState<ActiveInput>(null)
  const [phase, setPhase] = useState<Phase>(restored.phase ?? 'dest')

  const [title, setTitle] = useState(restored.title ?? '')
  const [tags, setTags] = useState<string[]>(restored.tags ?? [])
  const [postType, setPostType] = useState<'itinerary' | 'guide'>(restored.postType ?? 'itinerary')
  const [tripMonth, setTripMonth] = useState(restored.tripMonth ?? '')
  const [tripDays, setTripDays] = useState(restored.tripDays ?? '')
  const [tripAudience, setTripAudience] = useState<'family' | 'friends' | 'romantic' | 'adult'>(restored.tripAudience ?? 'family')
  const [budget, setBudget] = useState(restored.budget ?? 0)
  const [tripRating, setTripRating] = useState<number | null>(restored.tripRating ?? null)

  // Save progress to sessionStorage on every relevant state change
  useEffect(() => {
    try {
      const toSave: SavedState = { dests, curDest, curItems, curDayIndex, curNotes, photos, phase, title, tags, postType, tripMonth, tripDays, tripAudience, budget, tripRating }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(toSave))
    } catch { /* quota exceeded or SSR */ }
  }, [dests, curDest, curItems, curDayIndex, curNotes, photos, phase, title, tags, postType, tripMonth, tripDays, tripAudience, budget, tripRating])

  function startOver() {
    try { sessionStorage.removeItem(SESSION_KEY) } catch {}
    setDests([])
    setCurDest({ name: '', country: '' })
    setCurItems([])
    setCurDayIndex(1)
    setCurNotes('')
    setPhotos([])
    setPhase('dest')
    setTitle('')
    setTags([])
    setPostType('itinerary')
    setTripMonth('')
    setTripDays('')
    setTripAudience('family')
    setBudget(0)
    setTripRating(null)
    setActiveInput(null)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setCurItems(items => {
      const oldIndex = items.findIndex(i => i.id === active.id)
      const newIndex = items.findIndex(i => i.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return items
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  function addItem(item: Omit<GuidedItem, 'id' | 'dayIndex'>) {
    setCurItems(i => [...i, { ...item, id: uid(), dayIndex: curDayIndex }])
    setActiveInput(null)
  }

  function finishDest() {
    setDests(d => [...d, { id: uid(), name: curDest.name, country: curDest.country, notes: curNotes, items: curItems }])
    setCurDest({ name: '', country: '' })
    setCurItems([])
    setCurDayIndex(1)
    setCurNotes('')
    setActiveInput(null)
    setPhase('more')
  }

  function editDest(destId: string) {
    const dest = dests.find(d => d.id === destId)
    if (!dest) return
    setCurDest({ name: dest.name, country: dest.country })
    setCurItems(dest.items)
    setCurNotes(dest.notes)
    setCurDayIndex(dest.items.reduce((max, i) => Math.max(max, i.dayIndex), 1))
    setDests(ds => ds.filter(d => d.id !== destId))
    setPhase('building')
    setActiveInput(null)
  }

  const computedHighlights = [...dests, ...(curDest.name.trim() ? [{ items: curItems }] : [])]
    .flatMap(d => d.items)
    .filter(i => i.isHighlight && i.type !== 'hotel' && i.name.trim())
    .map(i => i.name.trim())
    .join('\n')

  async function uploadPhotos(files: File[]) {
    if (!files.length) return
    setUploading(true)
    setPhotoUploadError(null)
    setFailedPhotoFiles([])
    const failed: File[] = []
    try {
      const uploaded: UploadedPhoto[] = []
      for (const file of files) {
        try {
          const fd = new FormData()
          fd.append('file', file)
          const res = await fetch('/api/upload', { method: 'POST', body: fd })
          if (!res.ok) throw new Error('Upload failed')
          const { url } = await res.json()
          uploaded.push({ url, caption: '' })
        } catch {
          failed.push(file)
        }
      }
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

  function buildDestinations() {
    // Include current in-progress destination so draft saves capture it
    const all: GuidedDest[] = [...dests]
    if (curDest.name.trim()) {
      all.push({ id: 'current', name: curDest.name, country: curDest.country, notes: curNotes, items: curItems })
    }
    return all.map(d => {
      const hotels = d.items.filter(i => i.type === 'hotel')
      // Group non-hotel items by dayIndex
      const byDay = new Map<number, GuidedItem[]>()
      for (const item of d.items.filter(i => i.type !== 'hotel')) {
        const di = item.dayIndex ?? 1
        if (!byDay.has(di)) byDay.set(di, [])
        byDay.get(di)!.push(item)
      }
      const days = byDay.size > 0
        ? [...byDay.entries()].sort(([a], [b]) => a - b).map(([, dayItems]) => ({
            food: dayItems
              .map((item, pos) => ({ item, pos }))
              .filter(({ item }) => item.type === 'food_drink')
              .map(({ item: i, pos }) => ({ name: i.name, mealType: i.mealType, notes: i.notes, link: '', rating: i.rating, order: pos, tags: i.isHighlight ? ['__highlight'] : [] })),
            activities: dayItems
              .map((item, pos) => ({ item, pos }))
              .filter(({ item }) => item.type === 'activity')
              .map(({ item: i, pos }) => ({ name: i.name, notes: i.notes, link: '', rating: i.rating, order: pos, tags: i.isHighlight ? ['__highlight'] : [] })),
          }))
        : [{ food: [], activities: [] }]
      const stays = hotels.length > 0 ? hotels : [null]
      return {
        name: d.name, country: d.country, notes: d.notes,
        groups: stays.map((hotel, index) => ({
          hotelName: hotel?.name ?? '',
          hotelNotes: hotel?.notes ?? '',
          hotelAddress: '',
          hotelLink: '',
          hotelRating: hotel?.rating ?? 0,
          days: index === 0 ? days : [{ food: [], activities: [] }],
        })),
      }
    })
  }

  const resolvedTitle = title.trim() || (dests[0]?.name ? `Trip to ${dests[0].name}` : 'Untitled Trip')
  const tripDateRange = dateRangeFromMonthAndDays(tripMonth, tripDays)

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-36">
      <div className="flex items-center justify-between mb-5">
        <Link href="/" className="text-sm text-blue-600 hover:underline">← Back</Link>
        {(dests.length > 0 || curItems.length > 0 || curDest.name.trim()) && (
          <button type="button" onClick={startOver} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
            ↺ Start over
          </button>
        )}
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Step by step</h1>
      <p className="text-sm text-gray-500 mb-6">Build your trip one card at a time.</p>

      <form id="gf" action={action} onSubmit={() => { try { sessionStorage.removeItem(SESSION_KEY) } catch {} }}>
        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="postType" value={postType} />
        <input type="hidden" name="startDate" value={tripDateRange.startDate} />
        <input type="hidden" name="endDate" value={tripDateRange.endDate} />
        <input type="hidden" name="audience" value={tripAudience} />
        <input type="hidden" name="visibility" value="public" />
        <input type="hidden" name="destinations" value={JSON.stringify(buildDestinations())} />
        <input type="hidden" name="highlights" value={computedHighlights} />
        <input type="hidden" name="photos" value={JSON.stringify(photos)} />
        <input type="hidden" name="tags" value={JSON.stringify(tags)} />
        {budget > 0 && <input type="hidden" name="budget" value={budget} />}
        {tripRating && <input type="hidden" name="tripRating" value={tripRating} />}
      </form>

      <div className="space-y-4">

        {/* Completed destinations */}
        {dests.map(d => (
          <DestSummary key={d.id} dest={d} onRemove={() => setDests(ds => ds.filter(x => x.id !== d.id))} onEdit={() => editDest(d.id)} />
        ))}

        {/* ── DEST card ───────────────────────────────────────────────────── */}
        {phase === 'dest' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center">
                <MapPin size={20} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">Where did you go?</h2>
                <p className="text-white/70 text-xs mt-0.5">Start by adding a destination</p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <PlacesAutocomplete
                value={curDest.name}
                onChange={v => setCurDest(d => ({ ...d, name: v }))}
                onSelect={(main, secondary) => setCurDest({ name: main, country: secondary || '' })}
                type="destination" placeholder="City or place" className={inputCls}
              />
              <input type="text" value={curDest.country}
                onChange={e => setCurDest(d => ({ ...d, country: e.target.value }))}
                placeholder="Country" className={inputCls}
              />
              <button type="button"
                disabled={!curDest.name.trim()}
                onClick={() => setPhase('building')}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
                Next <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── BUILDING card ────────────────────────────────────────────────── */}
        {phase === 'building' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Destination header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 flex items-center gap-2">
              <MapPin size={15} className="text-white/80" />
              <span className="font-bold text-white text-sm">
                {curDest.name}{curDest.country ? `, ${curDest.country}` : ''}
              </span>
            </div>

            <div className="p-5 space-y-4">
              {/* Added items grouped by day */}
              {curItems.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={curItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {(() => {
                        const byDay = new Map<number, GuidedItem[]>()
                        for (const item of curItems) {
                          if (!byDay.has(item.dayIndex)) byDay.set(item.dayIndex, [])
                          byDay.get(item.dayIndex)!.push(item)
                        }
                        return [...byDay.entries()].sort(([a], [b]) => a - b).map(([day, items]) => (
                          <div key={day}>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Day {day}</p>
                            <div className="space-y-2">
                              {items.map(item => (
                                <AddedRow key={item.id} item={item}
                                  onRemove={() => setCurItems(is => is.filter(x => x.id !== item.id))} />
                              ))}
                            </div>
                          </div>
                        ))
                      })()}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {/* Active input form */}
              {(activeInput === 'hotel' || activeInput === 'food_drink' || activeInput === 'activity') && (
                <ItemForm
                  type={activeInput}
                  onAdd={addItem}
                  onClose={() => setActiveInput(null)}
                />
              )}

              {/* Notes inline form */}
              {activeInput === 'notes' && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Overall Notes</p>
                    <button type="button" onClick={() => setActiveInput(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                  </div>
                  <textarea
                    value={curNotes}
                    onChange={e => setCurNotes(e.target.value)}
                    rows={3}
                    placeholder="General notes, tips, or summary for this destination…"
                    className={inputCls}
                  />
                  <button type="button" onClick={() => setActiveInput(null)}
                    className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
                    <Check size={14} /> Save Notes
                  </button>
                </div>
              )}

              {/* Photos inline form */}
              {activeInput === 'photos' && (
                <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Photos</p>
                    <button type="button" onClick={() => setActiveInput(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                  </div>
                  {photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {photos.map((photo, i) => (
                        <div key={i} className="relative group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.url} alt="" className="w-full h-20 object-cover rounded-lg" />
                          <button type="button" onClick={() => setPhotos(p => p.filter((_, idx) => idx !== i))}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className={`flex flex-col items-center justify-center border-2 border-dashed border-purple-300 rounded-xl p-5 cursor-pointer hover:border-purple-400 transition-colors ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    <ImageIcon size={22} className="text-purple-400 mb-1" />
                    <span className="text-sm font-medium text-purple-700">{uploading ? 'Uploading…' : 'Click to upload photos'}</span>
                    <span className="text-xs text-purple-400 mt-0.5">JPG, PNG, WEBP</span>
                    <input type="file" accept="image/*" multiple className="sr-only" onChange={handlePhotoUpload} disabled={uploading} />
                  </label>
                  {photoUploadError && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      <span>{photoUploadError}</span>
                      <button type="button" onClick={() => uploadPhotos(failedPhotoFiles)} disabled={uploading} className="font-semibold underline disabled:opacity-50">Retry</button>
                    </div>
                  )}
                  <button type="button" onClick={() => setActiveInput(null)}
                    className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
                    <Check size={14} /> Done
                  </button>
                </div>
              )}

              {/* Option buttons — always visible when no form open */}
              {!activeInput && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Day {curDayIndex}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button"
                      onClick={() => setActiveInput('hotel')}
                      className="flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 border-dashed border-blue-200 text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all">
                      <Hotel size={20} />
                      <span className="text-xs font-semibold">+ Stay / Hotel</span>
                    </button>
                    <button type="button"
                      onClick={() => setActiveInput('food_drink')}
                      className="flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 border-dashed border-orange-200 text-orange-600 hover:border-orange-400 hover:bg-orange-50 transition-all">
                      <Utensils size={20} />
                      <span className="text-xs font-semibold">+ Food / Drink</span>
                    </button>
                    <button type="button"
                      onClick={() => setActiveInput('activity')}
                      className="flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 border-dashed border-green-200 text-green-600 hover:border-green-400 hover:bg-green-50 transition-all">
                      <Camera size={20} />
                      <span className="text-xs font-semibold">+ Activity</span>
                    </button>
                    <button type="button"
                      onClick={() => setActiveInput('notes')}
                      className="flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 border-dashed border-amber-200 text-amber-600 hover:border-amber-400 hover:bg-amber-50 transition-all">
                      <FileText size={20} />
                      <span className="text-xs font-semibold">{curNotes ? 'Notes ✓' : '+ Notes'}</span>
                    </button>
                    <button type="button"
                      onClick={() => setActiveInput('photos')}
                      className="flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 border-dashed border-purple-200 text-purple-600 hover:border-purple-400 hover:bg-purple-50 transition-all">
                      <ImageIcon size={20} />
                      <span className="text-xs font-semibold">{photos.length > 0 ? `Photos (${photos.length})` : '+ Photos'}</span>
                    </button>
                    <button type="button"
                      onClick={() => setCurDayIndex(d => d + 1)}
                      className="flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 border-dashed border-indigo-200 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                      <ArrowRight size={20} />
                      <span className="text-xs font-semibold">Day {curDayIndex + 1}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Done + draft buttons */}
              {!activeInput && (
                <div className="space-y-2">
                  <button type="button" onClick={finishDest}
                    className="w-full py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-700 transition-colors text-sm flex items-center justify-center gap-2">
                    Done with {curDest.name} <ArrowRight size={15} />
                  </button>
                  <button form="gf" type="submit" name="isDraft" value="1" disabled={pending}
                    className="w-full py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 text-sm font-medium hover:border-gray-300 transition-colors disabled:opacity-60">
                    {pending ? 'Saving…' : 'Save as Draft'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MORE card ───────────────────────────────────────────────────── */}
        {phase === 'more' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 space-y-3">
            <div>
              <p className="font-semibold text-gray-900 mb-1">
                {dests.length === 1 ? `${dests[0].name} added! 🎉` : `${dests.length} destinations added!`}
              </p>
              <p className="text-sm text-gray-500">Anywhere else, or ready to finish?</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setPhase('dest')}
                className="flex-1 py-3 rounded-xl border-2 border-blue-200 text-blue-700 text-sm font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                <Plus size={15} /> Add destination
              </button>
              <button type="button" onClick={() => setPhase('details')}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                Finish <ArrowRight size={15} />
              </button>
            </div>
            <button form="gf" type="submit" name="isDraft" value="1" disabled={pending}
              className="w-full py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 text-sm font-medium hover:border-gray-300 transition-colors disabled:opacity-60">
              {pending ? 'Saving…' : 'Save as Draft'}
            </button>
          </div>
        )}

        {/* ── DETAILS card ─────────────────────────────────────────────────── */}
        {phase === 'details' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-5 py-4">
              <h2 className="font-bold text-white">One last thing</h2>
              <p className="text-white/70 text-xs mt-0.5">Give your trip a name, month, and length</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 text-sm font-medium">
                <button type="button" onClick={() => setPostType('itinerary')}
                  className={`flex-1 py-1.5 rounded-lg transition-colors ${postType === 'itinerary' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600'}`}>
                  ✈️ Itinerary
                </button>
                <button type="button" onClick={() => setPostType('guide')}
                  className={`flex-1 py-1.5 rounded-lg transition-colors ${postType === 'guide' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600'}`}>
                  📖 Guide
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder={resolvedTitle} className={inputCls} />
              </div>
              {postType === 'itinerary' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Month and year</label>
                    <input type="month" value={tripMonth} onChange={e => setTripMonth(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Number of days</label>
                    <input type="number" min="1" step="1" inputMode="numeric" value={tripDays} onChange={e => setTripDays(e.target.value)} placeholder="e.g. 8" className={inputCls} />
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Tags</p>
                <TagPicker selected={tags} onChange={setTags} />
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Trip type</p>
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

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Budget</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setBudget(budget === n ? 0 : n)}
                      className={`text-base px-1 transition-colors ${n <= budget ? 'text-green-600' : 'text-gray-300'}`}
                    >
                      $
                    </button>
                  ))}
                </div>
              </div>

              {postType === 'itinerary' && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Overall trip rating <span className="text-gray-400 font-normal">(optional)</span></p>
                  <TripRatingPicker value={tripRating} onChange={setTripRating} />
                </div>
              )}

              {formState?.error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formState.error}</p>
              )}

              <button type="button" onClick={() => setPhase('more')} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                ← Back
              </button>

              <div className="flex gap-3 pt-1">
                <button form="gf" type="submit" name="isDraft" value="1" disabled={pending}
                  className="flex-1 bg-white text-gray-700 font-semibold py-3 rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-colors disabled:opacity-60 text-sm">
                  {pending ? 'Saving…' : 'Save as Draft'}
                </button>
                {(() => {
                  const hasItems =
                    dests.some(d => d.items.length > 0) ||
                    curItems.length > 0
                  return (
                    <button form="gf" type="submit" disabled={pending || !hasItems}
                      title={!hasItems ? 'Add at least one hotel, restaurant, or activity first' : undefined}
                      className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 text-sm">
                      {pending ? 'Publishing…' : 'Publish'}
                    </button>
                  )
                })()}
              </div>
              {pending && (
                <p className="text-center text-xs text-gray-400">
                  Taking too long?{' '}
                  <button
                    type="button"
                    onClick={() => { window.location.reload() }}
                    className="underline hover:text-gray-600"
                  >
                    Cancel
                  </button>
                  {' '}— your trip is saved and will be here when you come back.
                </p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

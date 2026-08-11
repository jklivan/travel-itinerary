'use client'

import { useActionState, useState, useRef, useEffect } from 'react'
import { upload } from '@vercel/blob/client'
import { updateItinerary } from '@/actions/itinerary'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import TagPicker from '@/components/TagPicker'
import DeleteButton from '@/components/DeleteButton'
import { TripRatingPicker } from '@/components/TripRatingPicker'
import { dateRangeFromMonthAndDays, monthAndDaysFromDates } from '@/lib/tripDates'
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
import { GripVertical } from 'lucide-react'

function uid() { return Math.random().toString(36).slice(2) }

// ── Types ─────────────────────────────────────────────────────────────────────

type DayItem = {
  id: string
  type: 'food_drink' | 'activity'
  name: string
  mealType: string
  description: string
  notes: string
  link: string
  rating: number
  priceLevel: number | null
  familyFriendly: boolean | null
  familyFriendlySource: string | null
  lat: number | null
  lng: number | null
  tags: string[]
  dayIndex: number | null
}

type DayGroup    = { dayIndex: number; items: DayItem[] }
type StayGroup   = { hotelName: string; hotelDescription: string; hotelNotes: string; hotelAddress: string; hotelLink: string; hotelRating: number; hotelPriceLevel: number | null; hotelNightlyRate: string; hotelLat: number | null; hotelLng: number | null; hotelTags: string[]; days: DayGroup[] }
type Destination = { name: string; country: string; notes: string; groups: StayGroup[] }
type UploadedPhoto = { url: string; caption: string }

type RawItem = {
  type: string; mealType?: string | null; name: string; description?: string | null
  notes: string | null; address?: string | null; rating: number | null
  priceLevel?: number | null; link: string | null; groupIndex?: number
  dayIndex?: number | null; order?: number | null
  familyFriendly?: boolean | null; familyFriendlySource?: string | null
  lat?: number | null; lng?: number | null; tags?: string[]
}

type ItineraryData = {
  id: string; postType: string; title: string; description: string | null
  startDate: Date; endDate: Date; audience: string; visibility: string
  notes: string | null; highlights: string | null; tags: string[]
  budget: number | null; tripRating: number | null
  destinations: { name: string; country: string | null; notes: string | null; items: RawItem[] }[]
  photos: { url: string; caption: string | null }[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const inputClass    = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const subInputClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400'
const labelClass    = 'block text-sm font-medium text-gray-900 mb-1'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'drinks', 'coffee', 'dessert', 'bakery'] as const
const MEAL_TYPE_META: Record<string, { emoji: string; active: string }> = {
  breakfast: { emoji: '🍳', active: 'bg-yellow-500 text-white border-yellow-500' },
  lunch:     { emoji: '☀️', active: 'bg-orange-500 text-white border-orange-500' },
  dinner:    { emoji: '🌙', active: 'bg-purple-600 text-white border-purple-600' },
  drinks:    { emoji: '🍹', active: 'bg-blue-500 text-white border-blue-500'     },
  coffee:    { emoji: '☕', active: 'bg-amber-700 text-white border-amber-700'   },
  dessert:   { emoji: '🍰', active: 'bg-pink-500 text-white border-pink-500'     },
  bakery:    { emoji: '🥐', active: 'bg-orange-400 text-white border-orange-400' },
}
const FOOD_TAGS  = ['Worth the Hype', 'Great Food', 'Hidden Gem', 'Local Favorite', "Can't-Miss", 'Good for Groups', 'Family Friendly', 'Great Cocktails', 'Great Ambiance', 'Lively', 'Romantic', 'Chic', 'Casual', 'Outdoor Dining', 'Great Views']
const HOTEL_TAGS = ['Great Service', 'Worth the Splurge', 'Great Value', 'Hidden Gem', 'Boutique', 'Luxury', 'Romantic', 'Family-Friendly', 'Great Location', 'Great Views', 'Amazing Spa']

function fmt(d: Date) { return new Date(d).toISOString().slice(0, 10) }

function nightlyRateToTier(rate: number): number {
  if (rate < 150) return 1; if (rate < 350) return 2
  if (rate < 600) return 3; if (rate < 1000) return 4; return 5
}

const emptyFoodItem = (): DayItem => ({ id: uid(), type: 'food_drink', name: '', mealType: '', description: '', notes: '', link: '', rating: 0, priceLevel: null, familyFriendly: null, familyFriendlySource: null, lat: null, lng: null, tags: [], dayIndex: null })
const emptyActItem  = (): DayItem => ({ id: uid(), type: 'activity',   name: '', mealType: '', description: '', notes: '', link: '', rating: 0, priceLevel: null, familyFriendly: null, familyFriendlySource: null, lat: null, lng: null, tags: [], dayIndex: null })
const emptyDay      = (dayIndex = 0): DayGroup => ({ dayIndex, items: [] })
const emptyGroup    = (): StayGroup  => ({ hotelName: '', hotelDescription: '', hotelNotes: '', hotelAddress: '', hotelLink: '', hotelRating: 0, hotelPriceLevel: null, hotelNightlyRate: '', hotelLat: null, hotelLng: null, hotelTags: [], days: [emptyDay(0)] })
const emptyDest     = (): Destination => ({ name: '', country: '', notes: '', groups: [emptyGroup()] })

// ── Data conversion ───────────────────────────────────────────────────────────

function itemsToGroups(rawItems: RawItem[]): StayGroup[] {
  const byGi = new Map<number, RawItem[]>()
  for (const item of rawItems) {
    const gi = item.groupIndex ?? 0
    if (!byGi.has(gi)) byGi.set(gi, [])
    byGi.get(gi)!.push(item)
  }
  if (byGi.size === 0) return [emptyGroup()]
  return [...byGi.entries()].sort(([a], [b]) => a - b).map(([, grpItems]) => {
    const hotel = grpItems.find(i => i.type === 'hotel')
    const nonHotel = grpItems.filter(i => i.type !== 'hotel')
    const byDay = new Map<number, RawItem[]>()
    for (const item of nonHotel) {
      const di = item.dayIndex ?? 0
      if (!byDay.has(di)) byDay.set(di, [])
      byDay.get(di)!.push(item)
    }
    const days: DayGroup[] = byDay.size === 0 ? [emptyDay(0)] :
      [...byDay.entries()].sort(([a], [b]) => a - b).map(([dayIdx, dayItems]) => ({
        dayIndex: dayIdx,
        items: [...dayItems]
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map(i => ({
            id: uid(),
            type: i.type as 'food_drink' | 'activity',
            name: i.name,
            mealType: i.mealType ?? '',
            description: i.description ?? '',
            notes: i.notes ?? '',
            link: i.link ?? '',
            rating: i.rating ?? 0,
            priceLevel: i.priceLevel ?? null,
            familyFriendly: i.familyFriendly ?? null,
            familyFriendlySource: i.familyFriendlySource ?? null,
            lat: i.lat ?? null,
            lng: i.lng ?? null,
            tags: i.tags ?? [],
            dayIndex: i.dayIndex ?? null,
          }))
      }))
    return {
      hotelName: hotel?.name ?? '',
      hotelDescription: hotel?.description ?? '',
      hotelNotes: hotel?.notes ?? '',
      hotelAddress: hotel?.address ?? '',
      hotelLink: hotel?.link ?? '',
      hotelRating: hotel?.rating ?? 0,
      hotelPriceLevel: hotel?.priceLevel ?? null,
      hotelNightlyRate: '',
      hotelLat: hotel?.lat ?? null,
      hotelLng: hotel?.lng ?? null,
      hotelTags: hotel?.tags ?? [],
      days,
    }
  })
}

// Convert merged items back to the { food, activities } format the server action expects,
// using each item's position in the merged list as its `order` value.
function toServerFormat(destinations: Destination[]) {
  return destinations.map(dest => ({
    ...dest,
    groups: dest.groups.map(group => ({
      ...group,
      days: group.days.map(day => ({
        food: day.items
          .filter(i => i.type === 'food_drink')
          .map(i => ({
            name: i.name, mealType: i.mealType, description: i.description,
            notes: i.notes, link: i.link, rating: i.rating,
            priceLevel: i.priceLevel, familyFriendly: i.familyFriendly,
            familyFriendlySource: i.familyFriendlySource, lat: i.lat, lng: i.lng,
            tags: i.tags, dayIndex: i.dayIndex, order: day.items.indexOf(i),
          })),
        activities: day.items
          .filter(i => i.type === 'activity')
          .map(i => ({
            name: i.name, notes: i.notes, link: i.link, rating: i.rating,
            dayIndex: i.dayIndex, order: day.items.indexOf(i),
          })),
      }))
    }))
  }))
}

// ── Star rating ───────────────────────────────────────────────────────────────

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

// ── FoodRow ───────────────────────────────────────────────────────────────────

type DayMove = { currentDyi: number; totalDays: number; onMove: (toDyi: number) => void }

function DayMoveBar({ dayMove }: { dayMove: DayMove }) {
  if (dayMove.totalDays <= 1) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-gray-400">Move to:</span>
      {Array.from({ length: dayMove.totalDays }, (_, i) => i).filter(i => i !== dayMove.currentDyi).map(i => (
        <button key={i} type="button" onClick={() => dayMove.onMove(i)}
          className="text-xs px-2 py-0.5 rounded-full border border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
          Day {i + 1}
        </button>
      ))}
    </div>
  )
}

function FoodRow({ item, index, onUpdate, onPatch, onToggleTag, onRemove, showRating, onSelectPlace, dayMove }: {
  item: DayItem; index: number
  onUpdate: (field: string, val: string) => void
  onPatch: (patch: Partial<DayItem>) => void
  onToggleTag: (tag: string) => void
  onRemove: () => void; showRating: boolean
  onSelectPlace?: (placeId: string | null) => void
  dayMove?: DayMove
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const rowBg = index % 2 === 0 ? 'bg-gray-50' : 'bg-gray-100'
  return (
    <div ref={setNodeRef} style={style} className={`rounded-xl border border-l-4 border-l-orange-400 ${rowBg} p-4 space-y-3`}>
      <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">🍜 Food & Drink</p>
      <div className="flex gap-2 items-start">
        <button type="button" {...attributes} {...listeners} className="mt-2 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none">
          <GripVertical size={14} />
        </button>
        <PlacesAutocomplete
          value={item.name}
          onChange={val => { onUpdate('name', val); if (!val) onSelectPlace?.(null) }}
          onSelect={(_, __, placeId) => { if (placeId) onSelectPlace?.(placeId) }}
          type="restaurant"
          placeholder="e.g. Ramen Ichiran, Rooftop bar, Street market"
          className={inputClass}
        />
        <button type="button" onClick={onRemove} className="mt-1.5 text-gray-400 hover:text-red-500 text-xl leading-none shrink-0">×</button>
      </div>
      <div className="flex gap-1 flex-wrap">
        {MEAL_TYPES.map(mt => {
          const meta = MEAL_TYPE_META[mt]
          const selected = item.mealType.split(',').filter(Boolean)
          const isSelected = selected.includes(mt)
          return (
            <button key={mt} type="button"
              onClick={() => onUpdate('mealType', isSelected ? selected.filter(t => t !== mt).join(',') : [...selected, mt].join(','))}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors capitalize ${isSelected ? meta.active : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
              {meta.emoji} {mt}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {item.priceLevel != null && (
          <p className="text-xs text-green-700 font-medium">
            {'$'.repeat(item.priceLevel)}<span className="text-gray-300">{'$'.repeat(4 - item.priceLevel)}</span>
          </p>
        )}
        <button type="button" onClick={() => onPatch({ familyFriendly: item.familyFriendly === true ? null : true, familyFriendlySource: item.familyFriendly === true ? null : 'user' })}
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
      {showRating && <div className="flex items-center gap-2"><span className="text-xs text-gray-600 shrink-0">Rate it!</span><StarRating value={item.rating} onChange={v => onPatch({ rating: v })} /></div>}
      <div className="grid gap-2">
        <input type="text" value={item.description} onChange={e => onUpdate('description', e.target.value)} className={subInputClass} placeholder="✨ Description (auto-generated if blank)" />
        <input type="text" value={item.notes} onChange={e => onUpdate('notes', e.target.value)} className={subInputClass} placeholder="📝 Notes (optional)" />
        <input type="url" value={item.link} onChange={e => onUpdate('link', e.target.value)} className={subInputClass} placeholder="🔗 Website link (optional)" />
      </div>
      {dayMove && <DayMoveBar dayMove={dayMove} />}
    </div>
  )
}

// ── ActivityRow ───────────────────────────────────────────────────────────────

function ActivityRow({ item, index, onUpdate, onPatch, onRemove, showRating, dayMove }: {
  item: DayItem; index: number
  onUpdate: (field: string, val: string) => void
  onPatch: (patch: Partial<DayItem>) => void
  onRemove: () => void; showRating: boolean
  dayMove?: DayMove
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const rowBg = index % 2 === 0 ? 'bg-gray-50' : 'bg-gray-100'
  return (
    <div ref={setNodeRef} style={style} className={`rounded-xl border border-l-4 border-l-green-400 ${rowBg} p-4 space-y-3`}>
      <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">🎯 Activity</p>
      <div className="flex gap-2 items-start">
        <button type="button" {...attributes} {...listeners} className="mt-2 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none">
          <GripVertical size={14} />
        </button>
        <PlacesAutocomplete
          value={item.name}
          onChange={val => onUpdate('name', val)}
          type="activity"
          placeholder="e.g. Temple tour, Hiking, Museum visit"
          className={inputClass}
        />
        <button type="button" onClick={onRemove} className="mt-1.5 text-gray-400 hover:text-red-500 text-xl leading-none shrink-0">×</button>
      </div>
      {showRating && <div className="flex items-center gap-2"><span className="text-xs text-gray-600 shrink-0">Rate it!</span><StarRating value={item.rating} onChange={v => onPatch({ rating: v })} /></div>}
      <div className="grid gap-2">
        <input type="text" value={item.notes} onChange={e => onUpdate('notes', e.target.value)} className={subInputClass} placeholder="📝 Notes (optional)" />
        <input type="url" value={item.link} onChange={e => onUpdate('link', e.target.value)} className={subInputClass} placeholder="🔗 Website link (optional)" />
      </div>
      {dayMove && <DayMoveBar dayMove={dayMove} />}
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function EditForm({ itinerary }: { itinerary: ItineraryData }) {
  const boundAction = updateItinerary.bind(null, itinerary.id)
  const [state, action, pending] = useActionState(boundAction, undefined)

  const [postType, setPostType] = useState<'itinerary' | 'guide'>(itinerary.postType === 'guide' ? 'guide' : 'itinerary')
  const [title, setTitle] = useState(itinerary.title)
  const [description, setDescription] = useState(itinerary.description ?? '')
  const initialTripDates = monthAndDaysFromDates(fmt(itinerary.startDate), fmt(itinerary.endDate))
  const [tripMonth, setTripMonth] = useState(initialTripDates.month)
  const [tripDays, setTripDays] = useState(initialTripDates.days)
  const [tripAudience, setTripAudience] = useState<'family' | 'friends' | 'romantic' | 'adult'>(
    ['family', 'friends', 'romantic'].includes(itinerary.audience) ? itinerary.audience as 'family' | 'friends' | 'romantic' : 'adult'
  )
  const [notes, setNotes] = useState(itinerary.notes ?? '')
  const [highlights, setHighlights] = useState(itinerary.highlights ?? '')
  const [tags, setTags] = useState<string[]>(itinerary.tags ?? [])
  const [tripRating, setTripRating] = useState<number | null>(itinerary.tripRating ?? null)
  const [destinations, setDestinations] = useState<Destination[]>(
    itinerary.destinations.length > 0
      ? itinerary.destinations.map(d => ({ name: d.name, country: d.country ?? '', notes: d.notes ?? '', groups: itemsToGroups(d.items) }))
      : [emptyDest()]
  )
  const tripDateRange = dateRangeFromMonthAndDays(tripMonth, tripDays)
  const [photos, setPhotos] = useState<UploadedPhoto[]>(itinerary.photos.map(p => ({ url: p.url, caption: p.caption ?? '' })))
  const photosInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (photosInputRef.current) photosInputRef.current.value = JSON.stringify(photos)
  }, [photos])
  const [uploading, setUploading] = useState(false)

  const showRating = postType === 'itinerary'

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  // ── State helpers ────────────────────────────────────────────────────────────

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
  function addDay(di: number, gi: number) {
    updGroup(di, gi, g => {
      const nextDayIndex = Math.max(...g.days.map(d => d.dayIndex)) + 1
      return { ...g, days: [...g.days, emptyDay(nextDayIndex)] }
    })
  }
  function removeDay(di: number, gi: number, dyi: number) { updGroup(di, gi, g => ({ ...g, days: g.days.filter((_, i) => i !== dyi) })) }

  function addItem(di: number, gi: number, dyi: number, type: 'food_drink' | 'activity') {
    updGroup(di, gi, g => {
      const item = type === 'food_drink' ? emptyFoodItem() : emptyActItem()
      item.dayIndex = g.days[dyi].dayIndex
      return { ...g, days: g.days.map((d, i) => i !== dyi ? d : { ...d, items: [...d.items, item] }) }
    })
  }

  function moveItemToDay(di: number, gi: number, itemId: string, fromDyi: number, toDyi: number) {
    if (fromDyi === toDyi) return
    updGroup(di, gi, g => {
      const item = g.days[fromDyi]?.items.find(i => i.id === itemId)
      if (!item) return g
      const movedItem = { ...item, dayIndex: g.days[toDyi].dayIndex }
      return {
        ...g,
        days: g.days.map((d, i) => {
          if (i === fromDyi) return { ...d, items: d.items.filter(i => i.id !== itemId) }
          if (i === toDyi)   return { ...d, items: [...d.items, movedItem] }
          return d
        })
      }
    })
  }
  function removeItem(di: number, gi: number, dyi: number, itemId: string) {
    updDay(di, gi, dyi, d => ({ ...d, items: d.items.filter(i => i.id !== itemId) }))
  }
  function updateItem(di: number, gi: number, dyi: number, itemId: string, field: string, val: string) {
    updDay(di, gi, dyi, d => ({
      ...d, items: d.items.map(i => i.id !== itemId ? i : { ...i, [field]: val })
    }))
  }
  function patchItem(di: number, gi: number, dyi: number, itemId: string, patch: Partial<DayItem>) {
    updDay(di, gi, dyi, d => ({
      ...d, items: d.items.map(i => i.id !== itemId ? i : { ...i, ...patch })
    }))
  }
  function toggleItemTag(di: number, gi: number, dyi: number, itemId: string, tag: string) {
    updDay(di, gi, dyi, d => ({
      ...d, items: d.items.map(i => i.id !== itemId ? i : {
        ...i, tags: i.tags.includes(tag) ? i.tags.filter(t => t !== tag) : [...i.tags, tag]
      })
    }))
  }
  async function fetchItemPriceLevel(di: number, gi: number, dyi: number, itemId: string, placeId: string) {
    try {
      const res = await fetch(`/api/place-details?id=${encodeURIComponent(placeId)}`)
      const { priceLevel, lat, lng, website } = await res.json()
      patchItem(di, gi, dyi, itemId, {
        ...(priceLevel !== null ? { priceLevel } : {}),
        ...(lat !== null ? { lat, lng } : {}),
      })
      // set link only if blank
      updDay(di, gi, dyi, d => ({
        ...d, items: d.items.map(i => i.id !== itemId ? i : { ...i, link: !i.link && website ? website : i.link })
      }))
    } catch { /* ignore */ }
  }
  function reorderItems(di: number, gi: number, dyi: number, e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    updDay(di, gi, dyi, d => {
      const oldIndex = d.items.findIndex(i => i.id === active.id)
      const newIndex = d.items.findIndex(i => i.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return d
      return { ...d, items: arrayMove(d.items, oldIndex, newIndex) }
    })
  }

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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="startDate" value={tripDateRange.startDate} />
      <input type="hidden" name="endDate" value={tripDateRange.endDate} />
      <input type="hidden" name="destinations" value={JSON.stringify(toServerFormat(destinations))} />
      <input type="hidden" name="photos" ref={photosInputRef} defaultValue={JSON.stringify(photos)} />
      <input type="hidden" name="audience" value={tripAudience} />
      <input type="hidden" name="visibility" value="public" />
      <input type="hidden" name="postType" value={postType} />
      <input type="hidden" name="tripRating" value={tripRating ?? ''} />

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{state.error}</p>
      )}

      {/* Basic Info */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-900">Basic Info</h2>
            {itinerary.visibility === 'draft' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Draft</span>
            )}
          </div>
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
              <label htmlFor="tripMonth" className={labelClass}>Month and year *</label>
              <input id="tripMonth" type="month" required className={inputClass} value={tripMonth} onChange={e => setTripMonth(e.target.value)} />
            </div>
            <div>
              <label htmlFor="tripDays" className={labelClass}>Number of days *</label>
              <input id="tripDays" type="number" min="1" step="1" inputMode="numeric" required className={inputClass} value={tripDays} onChange={e => setTripDays(e.target.value)} />
            </div>
          </div>
        )}
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
      </section>

      {/* Highlights */}
      <section className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-1">✨ Highlights</h2>
        <p className="text-xs text-gray-500 mb-3">Your personal trip summary. Leave blank and we&apos;ll auto-generate one from your 5-star picks.</p>
        <textarea name="highlights" rows={3} className={inputClass} placeholder="The ramen at Ichiran was life-changing…" value={highlights} onChange={e => setHighlights(e.target.value)} />
      </section>

      {/* Destinations */}
      <section className="space-y-4">
        <h2 className="font-semibold text-gray-900 text-lg">Destinations</h2>

        {destinations.map((dest, di) => (
          <div key={di} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
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
            <textarea value={dest.notes} onChange={e => updateDest(di, 'notes', e.target.value)}
              rows={2} className={inputClass} placeholder="Overview / notes for this destination (optional)" />

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
                      onChange={val => { updateHotel(di, gi, 'hotelName', val); if (!val) updGroup(di, gi, g => ({ ...g, hotelPriceLevel: null, hotelNightlyRate: '' })) }}
                      onSelect={(_, __, placeId) => { if (placeId) fetchHotelPriceLevel(di, gi, placeId) }}
                      type="hotel" placeholder="Hotel name (optional)" className={inputClass}
                    />
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
                      <input type="text" value={group.hotelDescription} onChange={e => updateHotel(di, gi, 'hotelDescription', e.target.value)} className={subInputClass} placeholder="✨ Description (auto-generated if blank)" />
                      <input type="text" value={group.hotelNotes} onChange={e => updateHotel(di, gi, 'hotelNotes', e.target.value)} className={subInputClass} placeholder="📝 Notes (optional)" />
                      <input type="text" value={group.hotelAddress} onChange={e => updateHotel(di, gi, 'hotelAddress', e.target.value)} className={subInputClass} placeholder="📍 Address (optional — for Airbnbs, apartments…)" />
                      <input type="url" value={group.hotelLink} onChange={e => updateHotel(di, gi, 'hotelLink', e.target.value)} className={subInputClass} placeholder="🔗 Website link (optional)" />
                    </>)}
                  </div>

                  {/* Days — single merged item list */}
                  {group.days.map((day, dyi) => (
                    <div key={dyi} className="rounded-xl border border-gray-100 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Day {dyi + 1}</span>
                        {group.days.length > 1 && (
                          <button type="button" onClick={() => removeDay(di, gi, dyi)} className="text-xs text-red-400 hover:text-red-600 font-medium">Remove day</button>
                        )}
                      </div>
                      <div className="p-3 space-y-3">
                        {day.items.length === 0 && (
                          <p className="text-xs text-gray-400 italic">No items yet — add food or an activity below.</p>
                        )}
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => reorderItems(di, gi, dyi, e)}>
                          <SortableContext items={day.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-3">
                              {day.items.map((item, ii) => {
                                const dayMove: DayMove | undefined = group.days.length > 1
                                  ? { currentDyi: dyi, totalDays: group.days.length, onMove: toDyi => moveItemToDay(di, gi, item.id, dyi, toDyi) }
                                  : undefined
                                return item.type === 'food_drink'
                                  ? <FoodRow key={item.id} item={item} index={ii} showRating={showRating}
                                      onUpdate={(f, v) => updateItem(di, gi, dyi, item.id, f, v)}
                                      onPatch={patch => patchItem(di, gi, dyi, item.id, patch)}
                                      onToggleTag={tag => toggleItemTag(di, gi, dyi, item.id, tag)}
                                      onRemove={() => removeItem(di, gi, dyi, item.id)}
                                      onSelectPlace={id => id
                                        ? fetchItemPriceLevel(di, gi, dyi, item.id, id)
                                        : patchItem(di, gi, dyi, item.id, { priceLevel: null })}
                                      dayMove={dayMove}
                                    />
                                  : <ActivityRow key={item.id} item={item} index={ii} showRating={showRating}
                                      onUpdate={(f, v) => updateItem(di, gi, dyi, item.id, f, v)}
                                      onPatch={patch => patchItem(di, gi, dyi, item.id, patch)}
                                      onRemove={() => removeItem(di, gi, dyi, item.id)}
                                      dayMove={dayMove}
                                    />
                              })}
                            </div>
                          </SortableContext>
                        </DndContext>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => addItem(di, gi, dyi, 'food_drink')}
                            className="flex-1 text-xs text-orange-600 hover:text-orange-800 font-medium border border-dashed border-orange-300 hover:border-orange-500 rounded-lg py-2 transition-colors">
                            + Food / Drink
                          </button>
                          <button type="button" onClick={() => addItem(di, gi, dyi, 'activity')}
                            className="flex-1 text-xs text-green-600 hover:text-green-800 font-medium border border-dashed border-green-300 hover:border-green-500 rounded-lg py-2 transition-colors">
                            + Activity
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => addDay(di, gi)}
                    className="w-full text-xs text-gray-500 hover:text-blue-600 border border-dashed border-gray-200 hover:border-blue-300 rounded-lg py-2 transition-colors">
                    + Add day
                  </button>
                </div>
              </div>
            ))}

            <button type="button" onClick={() => addGroup(di)}
              className="w-full text-sm text-gray-500 hover:text-blue-600 border border-dashed border-gray-300 hover:border-blue-300 rounded-xl py-3 transition-colors">
              + Add another stay (different hotel)
            </button>
          </div>
        ))}

        <button type="button" onClick={addDest}
          className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium border border-dashed border-blue-300 hover:border-blue-500 rounded-xl py-3 transition-colors">
          + Add destination
        </button>
      </section>

      {/* Tags */}
      <input type="hidden" name="tags" value={JSON.stringify(tags)} />
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Tags</h2>
        <p className="text-xs text-gray-500 mb-3">Pick what best describes this trip</p>
        <TagPicker selected={tags} onChange={setTags} />
      </section>

      {/* Notes */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">General Notes</h2>
        <textarea name="notes" rows={3} className={inputClass} placeholder="Tips, packing list, visa info…" value={notes} onChange={e => setNotes(e.target.value)} />
      </section>

      {/* Trip Rating */}
      {postType === 'itinerary' && (
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-0.5">Overall trip rating <span className="font-normal text-gray-400 text-sm">(optional)</span></h2>
          <p className="text-xs text-gray-500 mb-3">Would you go back?</p>
          <TripRatingPicker value={tripRating} onChange={setTripRating} />
        </section>
      )}

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
        <button type="submit" name="isDraft" value="1" disabled={pending || uploading}
          className="flex-1 bg-white text-gray-700 font-semibold py-3 rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-colors disabled:opacity-60 text-base">
          {pending ? 'Saving…' : 'Save as Draft'}
        </button>
        {(() => {
          const hasItems = destinations.some(d =>
            d.groups.some(g => g.hotelName.trim() || g.days.some(day => day.items.some(i => i.name.trim())))
          )
          const label = itinerary.visibility === 'draft' ? 'Publish' : 'Save changes'
          return (
            <button type="submit" disabled={pending || uploading || !hasItems}
              title={!hasItems ? 'Add at least one hotel, restaurant, or activity first' : undefined}
              className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 text-base">
              {pending ? 'Saving…' : label}
            </button>
          )
        })()}
      </div>
      <div className="flex justify-center pt-1">
        <DeleteButton id={itinerary.id} />
      </div>
    </form>
  )
}

'use client'

import { preventImplicitSubmit } from '@/lib/preventImplicitSubmit'

import EventPhotoInput from '@/components/EventPhotoInput'
import { eventPhotos } from '@/lib/eventPhotos'

import { useActionState, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { upload } from '@vercel/blob/client'
import { updateItinerary } from '@/actions/itinerary'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import TagPicker from '@/components/TagPicker'
import DeleteButton from '@/components/DeleteButton'
import { TripRatingPicker } from '@/components/TripRatingPicker'
import { dateRangeFromMonthAndDays, monthAndDaysFromDates } from '@/lib/tripDates'
import { MapPin, Hotel, Utensils, Camera, Star, Check, X, ImageIcon, GripVertical, ArrowRight, Plus } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import RecommendationPicker from '@/components/RecommendationPicker'
import { getRecommendation, recommendationTags, type PlaceRecommendation } from '@/lib/placeRecommendation'
import { moveItemToDay, reorderItems } from '@/lib/reorderItems'

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemType = 'hotel' | 'food_drink' | 'activity'

type EditItem = {
  id: string
  type: ItemType
  name: string
  mealType: string
  rating: number
  notes: string
  tags: string[]
  dayIndex: number
  isHighlight: boolean
  alternative: string
  photo: string
  photos: string[]
  // extra fields preserved from DB
  description: string
  link: string
  address: string
  priceLevel: number | null
  familyFriendly: boolean | null
  familyFriendlySource: string | null
  lat: number | null
  lng: number | null
}

type EditDest = {
  id: string
  name: string
  country: string
  notes: string
  items: EditItem[]
  curDayIndex: number
}

type UploadedPhoto = { url: string; caption: string }

type RawItem = {
  type: string; mealType?: string | null; name: string; description?: string | null
  notes: string | null; address?: string | null; rating: number | null
  priceLevel?: number | null; link: string | null; groupIndex?: number
  dayIndex?: number | null; order?: number | null; photoUrl?: string | null; photoUrls?: string[]
  familyFriendly?: boolean | null; familyFriendlySource?: string | null
  lat?: number | null; lng?: number | null; tags?: string[]; alternative?: string | null
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

const inputCls = 'w-full rounded-xl border border-[#e3dfd2] px-3 py-2.5 text-sm text-[#2e4147] focus:outline-none focus:ring-2 focus:ring-[#507c76] focus:border-transparent bg-[#fffdf6]'
const subInputCls = 'w-full rounded-xl border border-[#e3dfd2] px-3 py-2.5 text-sm text-[#2e4147] focus:outline-none focus:ring-1 focus:ring-[#507c76] bg-[#fffdf6]'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'drinks', 'coffee', 'dessert', 'bakery'] as const
const MEAL_EMOJI: Record<string, string> = {
  breakfast: '🍳', lunch: '☀️', dinner: '🌙', drinks: '🍹', coffee: '☕', dessert: '🍰', bakery: '🥐',
}
const MEAL_ACTIVE: Record<string, string> = Object.fromEntries(
  MEAL_TYPES.map(type => [type, 'bg-[#ad6b57] text-white border-[#ad6b57]'])
)

const FOOD_TAGS     = ['Worth the Hype', 'Great Food', 'Hidden Gem', 'Local Favorite', "Can't-Miss", 'Good for Groups', 'Family Friendly', 'Great Cocktails', 'Great Ambiance', 'Lively', 'Romantic', 'Casual', 'Outdoor Dining', 'Great Views']
const HOTEL_TAGS    = ['Great Service', 'Worth the Splurge', 'Great Value', 'Hidden Gem', 'Boutique', 'Luxury', 'Romantic', 'Family-Friendly', 'Great Location', 'Great Views', 'Amazing Spa']
const ACTIVITY_TAGS = ['Hidden Gem', 'Family Friendly', 'Great Views', 'Free', 'Outdoor', 'Cultural', 'Adventurous']
const ITEM_TAGS: Record<ItemType, string[]> = { food_drink: FOOD_TAGS, hotel: HOTEL_TAGS, activity: ACTIVITY_TAGS }

function uid() { return Math.random().toString(36).slice(2) }
function fmt(d: Date) { return new Date(d).toISOString().slice(0, 10) }

// ── Data conversion: DB → flat EditItem[] ─────────────────────────────────────

function destFromRaw(d: ItineraryData['destinations'][number]): EditDest {
  // Saved day numbers are already one-based. Only shift legacy zero-based data.
  const dayOffset = d.items.some(item => item.type !== 'hotel' && item.dayIndex === 0) ? 1 : 0
  const editDay = (item: RawItem) => item.dayIndex == null ? 1 : Math.max(1, item.dayIndex + dayOffset)
  const byGi = new Map<number, RawItem[]>()
  for (const item of d.items) {
    const gi = item.groupIndex ?? 0
    if (!byGi.has(gi)) byGi.set(gi, [])
    byGi.get(gi)!.push(item)
  }

  const items: EditItem[] = []
  const groups = byGi.size > 0
    ? [...byGi.entries()].sort(([a], [b]) => a - b)
    : [[0, []] as [number, RawItem[]]]

  for (const [, grpItems] of groups) {
    const hotel    = grpItems.find(i => i.type === 'hotel')
    const nonHotel = grpItems.filter(i => i.type !== 'hotel')

    if (hotel) {
      const hotelDay = nonHotel.length > 0
        ? Math.min(...nonHotel.map(editDay))
        : 1
      items.push({
        id: uid(), type: 'hotel', name: hotel.name, photo: hotel.photoUrl ?? '', photos: eventPhotos(hotel.photoUrls, hotel.photoUrl),
        mealType: '', rating: hotel.rating ?? 0, notes: hotel.notes ?? '',
        tags: hotel.tags ?? [], dayIndex: hotelDay, isHighlight: getRecommendation(hotel.tags) === 'must',
        alternative: hotel.alternative ?? '', description: hotel.description ?? '',
        link: hotel.link ?? '', address: hotel.address ?? '',
        priceLevel: hotel.priceLevel ?? null, familyFriendly: null,
        familyFriendlySource: null, lat: hotel.lat ?? null, lng: hotel.lng ?? null,
      })
    }

    for (const item of nonHotel.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
      items.push({
        id: uid(), type: item.type as 'food_drink' | 'activity',
        name: item.name, mealType: item.mealType ?? '', photo: item.photoUrl ?? '', photos: eventPhotos(item.photoUrls, item.photoUrl),
        rating: item.rating ?? 0, notes: item.notes ?? '',
        tags: (item.tags ?? []).filter(t => t !== '__highlight'),
        dayIndex: editDay(item),
        isHighlight: getRecommendation(item.tags) === 'must',
        alternative: item.alternative ?? '', description: item.description ?? '',
        link: item.link ?? '', address: '',
        priceLevel: item.priceLevel ?? null,
        familyFriendly: item.familyFriendly ?? null,
        familyFriendlySource: item.familyFriendlySource ?? null,
        lat: item.lat ?? null, lng: item.lng ?? null,
      })
    }
  }

  const maxDay = items.reduce((m, i) => Math.max(m, i.dayIndex), 1)
  return { id: uid(), name: d.name, country: d.country ?? '', notes: d.notes ?? '', items, curDayIndex: maxDay }
}

// ── Server format conversion ───────────────────────────────────────────────────

function buildDestinations(dests: EditDest[]) {
  return dests.map(d => {
    const hotels    = d.items.filter(i => i.type === 'hotel').sort((a, b) => a.dayIndex - b.dayIndex)
    const nonHotels = d.items.filter(i => i.type !== 'hotel')

    function buildDayGroups(items: EditItem[]) {
      const byDay = new Map<number, EditItem[]>()
      for (const item of items) {
        const di = item.dayIndex ?? 1
        if (!byDay.has(di)) byDay.set(di, [])
        byDay.get(di)!.push(item)
      }
      return byDay.size > 0
        ? [...byDay.entries()].sort(([a], [b]) => a - b).map(([dayIdx, dayItems]) => ({
            dayIndex: dayIdx,
            food: dayItems.filter(i => i.type === 'food_drink').map(i => ({
              name: i.name, mealType: i.mealType, description: i.description,
              notes: i.notes, link: i.link, rating: i.rating,
              priceLevel: i.priceLevel, familyFriendly: i.familyFriendly,
              familyFriendlySource: i.familyFriendlySource, lat: i.lat, lng: i.lng,
              order: dayItems.indexOf(i), tags: recommendationTags(i.tags, getRecommendation(i.tags, i.isHighlight)),
              alternative: i.alternative, photo: i.photos[0] ?? '', photos: i.photos,
            })),
            activities: dayItems.filter(i => i.type === 'activity').map(i => ({
              name: i.name, notes: i.notes, link: i.link, rating: i.rating,
              order: dayItems.indexOf(i), tags: recommendationTags(i.tags, getRecommendation(i.tags, i.isHighlight)),
              alternative: i.alternative, photo: i.photos[0] ?? '', photos: i.photos,
            })),
          }))
        : [{ food: [], activities: [] }]
    }

    if (hotels.length === 0) {
      return {
        name: d.name, country: d.country, notes: d.notes,
        groups: [{
          hotelName: '', hotelNotes: '', hotelAddress: '', hotelLink: '',
          hotelRating: 0, hotelAlternative: '',
          days: buildDayGroups(nonHotels),
        }],
      }
    }

    const itemsByHotel: EditItem[][] = hotels.map(() => [])
    for (const item of nonHotels) {
      const di = item.dayIndex ?? 1
      let hi = 0
      for (let i = 0; i < hotels.length; i++) {
        if (hotels[i].dayIndex <= di) hi = i; else break
      }
      itemsByHotel[hi].push(item)
    }

    return {
      name: d.name, country: d.country, notes: d.notes,
      groups: hotels.map((hotel, idx) => ({
        hotelName: hotel.name, hotelNotes: hotel.notes, hotelAddress: hotel.address,
        hotelLink: hotel.link, hotelRating: hotel.rating, hotelAlternative: hotel.alternative, hotelPhoto: hotel.photos[0] ?? '', hotelPhotos: hotel.photos,
        hotelDescription: hotel.description, hotelPriceLevel: hotel.priceLevel,
        hotelLat: hotel.lat, hotelLng: hotel.lng, hotelTags: recommendationTags(hotel.tags, getRecommendation(hotel.tags, hotel.isHighlight)),
        days: buildDayGroups(itemsByHotel[idx]),
      })),
    }
  })
}

// ── Star rating ───────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button" onClick={() => onChange(value === s ? 0 : s)} className="focus:outline-none">
          <Star size={22} className={s <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
        </button>
      ))}
    </div>
  )
}

// ── Item edit form ─────────────────────────────────────────────────────────────

function ItemEditForm({ type, initial, onDraftChange, onSave, onClose, onRecommendationChange, city }: {
  type: ItemType
  initial: EditItem
  onDraftChange?: (updated: Partial<EditItem>) => void
  onSave: (updated: Partial<EditItem>) => void
  onClose: () => void
  onRecommendationChange: (value: PlaceRecommendation) => void
  city?: string
}) {
  const [original] = useState(initial)
  function useDraftField<K extends keyof EditItem>(key: K, value: EditItem[K]) {
    const [field, setField] = useState(value)
    function update(next: EditItem[K] | ((previous: EditItem[K]) => EditItem[K])) {
      const resolved = typeof next === 'function' ? (next as (previous: EditItem[K]) => EditItem[K])(field) : next
      setField(resolved)
      const patch = { [key]: resolved } as Partial<EditItem>
      if (key === 'tags') patch.tags = recommendationTags(resolved as string[], getRecommendation(initial.tags, initial.isHighlight))
      onDraftChange?.(patch)
    }
    return [field, update] as const
  }
  const [name, setName]           = useDraftField('name', initial.name)
  const [mealType, setMealType]   = useDraftField('mealType', initial.mealType)
  const [rating, setRating]       = useDraftField('rating', initial.rating)
  const [notes, setNotes]         = useDraftField('notes', initial.notes)
  const [alternative, setAlternative] = useDraftField('alternative', initial.alternative)
  const recommendation = getRecommendation(initial.tags, initial.isHighlight)
  const [originalRecommendation] = useState(recommendation)
  function cancel() { onDraftChange?.(original); onRecommendationChange(originalRecommendation); onClose() }
  const [tags, setTags]           = useDraftField('tags', initial.tags)
  const [description, setDescription] = useDraftField('description', initial.description)
  const [link, setLink]           = useDraftField('link', initial.link)
  const [address, setAddress]     = useDraftField('address', initial.address)
  const [showMore, setShowMore]   = useState(initial.tags.length > 0 || !!initial.description || !!initial.link || !!initial.address)

  const cfg = {
    hotel:     { color: 'bg-[#edf1e9] border-[#bbcfc5]',     label: 'Hotel / Airbnb', placeholder: 'Hotel, house, Airbnb…',           placeType: 'hotel' as const,      notesPh: 'e.g. Book early, ask for a room upgrade, free breakfast…' },
    food_drink:{ color: 'bg-[#f5ebe1] border-[#dec4b4]', label: 'Food & Drink',   placeholder: 'e.g. Ramen Ichiran, Rooftop bar…', placeType: 'restaurant' as const, notesPh: 'e.g. Order the truffle pasta, great for groups…'           },
    activity:  { color: 'bg-[#f3eddb] border-[#d9c99f]',   label: 'Activity',       placeholder: 'e.g. Eiffel Tower, Temple tour…',  placeType: 'activity' as const,   notesPh: 'e.g. Book tickets online, go early to beat the crowds…'   },
  }[type]

  function toggleTag(tag: string) {
    setTags(t => t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag])
  }

  function submit() {
    if (!name.trim()) return
    onSave({ name: name.trim(), mealType, rating, notes: notes.trim(), tags: recommendationTags(tags, recommendation), isHighlight: recommendation === 'must', alternative: alternative.trim(), description: description.trim(), link: link.trim(), address: address.trim() })
  }

  const moreCount = tags.length + (description ? 1 : 0) + (link ? 1 : 0) + (address ? 1 : 0)

  return (
    <div className={`rounded-xl border ${cfg.color} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#6b7067] uppercase tracking-wide">Edit {cfg.label}</p>
        <button type="button" onClick={cancel} className="text-[#918d81] hover:text-[#6b7067]"><X size={16} /></button>
      </div>
      <PlacesAutocomplete value={name} onChange={setName} type={cfg.placeType}
        placeholder={cfg.placeholder} className={inputCls} city={city} />
      {type === 'food_drink' && (
        <div className="flex flex-wrap gap-1.5">
          {MEAL_TYPES.map(mt => {
            const sel = mealType.split(',').filter(Boolean)
            const isSel = sel.includes(mt)
            return (
              <button key={mt} type="button"
                onClick={() => setMealType(isSel ? sel.filter(t => t !== mt).join(',') : [...sel, mt].join(','))}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors capitalize ${isSel ? MEAL_ACTIVE[mt] : 'border-[#e3dfd2] text-[#7a7b70] hover:border-[#b8a98e]'}`}>
                {MEAL_EMOJI[mt]} {mt}
              </button>
            )
          })}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-xs text-[#7a7b70]">Rate it</p>
        <StarRating value={rating} onChange={setRating} />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-[#7a7b70]">Notes</p>
        <textarea aria-label="Notes" rows={4} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder={cfg.notesPh} className={inputCls} />
      </div>
      <PlacesAutocomplete value={alternative} onChange={setAlternative} type={cfg.placeType}
        placeholder="↔ Alternative (optional)" className={`${inputCls} text-[#7a7b70]`} city={city} />
      <RecommendationPicker type={type} value={recommendation} onChange={onRecommendationChange} />
      <button type="button" onClick={() => setShowMore(s => !s)}
        className="text-xs text-[#507c76] hover:text-[#355650] font-medium flex items-center gap-1 transition-colors">
        {showMore ? '▲ Hide details' : '▼ More details'}
        {moreCount > 0 && !showMore && (
          <span className="ml-1 bg-[#e6ece5] text-[#426862] rounded-full px-1.5 py-0.5 text-[10px] font-semibold">{moreCount}</span>
        )}
      </button>
      {showMore && (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-[#918d81] font-medium uppercase tracking-wide">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {ITEM_TAGS[type].map(tag => (
              <button key={tag} type="button" onClick={() => toggleTag(tag)}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${tags.includes(tag) ? 'bg-[#2C1810] text-white border-[#2C1810]' : 'border-[#e3dfd2] text-[#7a7b70] hover:border-[#b8a98e]'}`}>
                {tag}
              </button>
            ))}
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-[#7a7b70]">About the {type === 'food_drink' ? 'restaurant' : type === 'hotel' ? 'hotel' : 'activity'}</span>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Description (optional)" className={subInputCls} />
          </label>
          {type === 'hotel' && (
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="📍 Address (for Airbnbs, apartments…)" className={subInputCls} />
          )}
          <input type="url" value={link} onChange={e => setLink(e.target.value)}
            placeholder="🔗 Website link (optional)" className={subInputCls} />
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={cancel}
          className="flex-1 py-2.5 rounded-xl border-2 border-[#e3dfd2] text-[#7a7b70] text-sm font-medium hover:border-[#d7cebc] transition-colors">
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={!name.trim()}
          className="flex-1 py-2.5 rounded-xl bg-[#2C1810] text-white text-sm font-semibold hover:bg-[#5C3D2E] transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
          <Check size={14} /> Save
        </button>
      </div>
    </div>
  )
}

// ── Item add form ──────────────────────────────────────────────────────────────

function ItemForm({ type, onAdd, onClose, city }: {
  type: ItemType
  onAdd: (item: Omit<EditItem, 'id' | 'dayIndex' | 'isHighlight' | 'photo' | 'photos' | 'alternative' | 'description' | 'link' | 'address' | 'priceLevel' | 'familyFriendly' | 'familyFriendlySource' | 'lat' | 'lng'>) => void
  onClose: () => void
  city?: string
}) {
  const [name, setName]         = useState('')
  const [mealType, setMealType] = useState('')
  const [rating, setRating]     = useState(0)
  const [notes, setNotes]       = useState('')
  const [recommendation, setRecommendation] = useState<PlaceRecommendation>('none')
  const [tags, setTags]         = useState<string[]>([])
  const [showMore, setShowMore] = useState(false)

  const cfg = {
    hotel:     { color: 'bg-[#edf1e9] border-[#bbcfc5]',     label: 'Hotel / Airbnb', placeholder: 'Hotel, house, Airbnb…',           placeType: 'hotel' as const,      notesPh: 'e.g. Book early, ask for a room upgrade, free breakfast…' },
    food_drink:{ color: 'bg-[#f5ebe1] border-[#dec4b4]', label: 'Food & Drink',   placeholder: 'e.g. Ramen Ichiran, Rooftop bar…', placeType: 'restaurant' as const, notesPh: 'e.g. Order the truffle pasta, great for groups…'           },
    activity:  { color: 'bg-[#f3eddb] border-[#d9c99f]',   label: 'Activity',       placeholder: 'e.g. Eiffel Tower, Temple tour…',  placeType: 'activity' as const,   notesPh: 'e.g. Book tickets online, go early to beat the crowds…'   },
  }[type]

  function toggleTag(tag: string) { setTags(t => t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag]) }

  function submit() {
    if (!name.trim()) return
    onAdd({ type, name: name.trim(), mealType, rating, notes: notes.trim(), tags: recommendationTags(tags, recommendation) })
    setName(''); setMealType(''); setRating(0); setNotes(''); setTags([]); setRecommendation('none'); setShowMore(false)
  }

  return (
    <div className={`rounded-xl border ${cfg.color} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#6b7067] uppercase tracking-wide">{cfg.label}</p>
        <button type="button" onClick={onClose} className="text-[#918d81] hover:text-[#6b7067]"><X size={16} /></button>
      </div>
      <PlacesAutocomplete value={name} onChange={setName} type={cfg.placeType}
        placeholder={cfg.placeholder} className={inputCls} city={city} />
      {type === 'food_drink' && (
        <div className="flex flex-wrap gap-1.5">
          {MEAL_TYPES.map(mt => {
            const sel = mealType.split(',').filter(Boolean)
            const isSel = sel.includes(mt)
            return (
              <button key={mt} type="button"
                onClick={() => setMealType(isSel ? sel.filter(t => t !== mt).join(',') : [...sel, mt].join(','))}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors capitalize ${isSel ? MEAL_ACTIVE[mt] : 'border-[#e3dfd2] text-[#7a7b70] hover:border-[#b8a98e]'}`}>
                {MEAL_EMOJI[mt]} {mt}
              </button>
            )
          })}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-xs text-[#7a7b70]">Rate it</p>
        <StarRating value={rating} onChange={setRating} />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-[#7a7b70]">Notes</p>
        <textarea aria-label="Notes" rows={4} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder={cfg.notesPh} className={inputCls} />
      </div>
      <RecommendationPicker type={type} value={recommendation} onChange={setRecommendation} />
      <button type="button" onClick={() => setShowMore(s => !s)}
        className="text-xs text-[#507c76] hover:text-[#355650] font-medium flex items-center gap-1 transition-colors">
        {showMore ? '▲ Hide details' : '▼ More details'}
        {tags.length > 0 && !showMore && (
          <span className="ml-1 bg-[#e6ece5] text-[#426862] rounded-full px-1.5 py-0.5 text-[10px] font-semibold">{tags.length}</span>
        )}
      </button>
      {showMore && (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-[#918d81] font-medium uppercase tracking-wide">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {ITEM_TAGS[type].map(tag => (
              <button key={tag} type="button" onClick={() => toggleTag(tag)}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${tags.includes(tag) ? 'bg-[#2C1810] text-white border-[#2C1810]' : 'border-[#e3dfd2] text-[#7a7b70] hover:border-[#b8a98e]'}`}>
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
      <button type="button" onClick={submit} disabled={!name.trim()}
        className="w-full py-2.5 rounded-xl bg-[#2C1810] text-white text-sm font-semibold hover:bg-[#5C3D2E] transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
        <Check size={14} /> Add
      </button>
    </div>
  )
}

function DayDropZone({ destId, day }: { destId: string; day: number }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-end-${destId}-${day}`,
    data: { day },
  })
  return (
    <div ref={setNodeRef} className={`mt-2 rounded-lg border border-dashed px-3 py-3 text-xs text-center ${isOver ? 'border-[#507c76] bg-[#edf1e9] text-[#426862]' : 'border-[#e3dfd2] text-[#918d81]'}`}>
      Drop here to move to the end of this day
    </div>
  )
}

// ── Sortable item row ──────────────────────────────────────────────────────────

function ItemSummary({ item }: { item: EditItem }) {
  const icon = item.type === 'hotel'
    ? <Hotel size={13} className="text-blue-500 shrink-0" />
    : item.type === 'food_drink'
    ? <Utensils size={13} className="text-[#ad6b57] shrink-0" />
    : <Camera size={13} className="text-[#a27e3b] shrink-0" />

  return (
    <>
        {icon}
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#2e4147] truncate">{item.name}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {item.mealType && <span className="text-xs text-[#7a7b70]">{item.mealType.split(',').map(t => `${MEAL_EMOJI[t]} ${t}`).join(' · ')}</span>}
            {item.rating > 0 && <span className="text-xs text-yellow-500">{'★'.repeat(item.rating)}</span>}
            {getRecommendation(item.tags, item.isHighlight) !== 'none' && <span className={`text-xs font-medium ${getRecommendation(item.tags, item.isHighlight) === 'avoid' ? 'text-red-700' : 'text-[#507c76]'}`}>{getRecommendation(item.tags, item.isHighlight) === 'option' ? 'Alternative' : getRecommendation(item.tags, item.isHighlight) === 'avoid' ? 'Avoid' : item.type === 'hotel' ? 'Must stay' : 'Must do'}</span>}
            {item.notes && <span className="text-xs text-[#918d81] truncate">{item.notes}</span>}
          </div>
        </div>
    </>
  )
}

function DraggedItem({ item }: { item: EditItem }) {
  return (
    <div aria-hidden="true" className="pointer-events-none flex items-center gap-2 rounded-xl border border-[#bbcfc5] bg-[#faf7ee] px-3 py-2.5 shadow-xl cursor-grabbing">
      <GripVertical size={14} className="shrink-0 text-[#918d81]" />
      <div className="flex min-w-0 flex-1 items-center gap-2 text-left"><ItemSummary item={item} /></div>
      <span className="shrink-0 text-lg leading-none text-[#c3bcad]">×</span>
    </div>
  )
}

function SortableItem({ item, isEditing, onEdit, onDraftChange, onUpdate, onRemove, onRecommendationChange, onPhotoChange, onPhotoBusyChange, city }: {
  item: EditItem
  isEditing: boolean
  onDraftChange: (updated: Partial<EditItem>) => void
  onEdit: () => void
  onUpdate: (updated: Partial<EditItem>) => void
  onRemove: () => void
  onRecommendationChange: (value: PlaceRecommendation) => void
  onPhotoChange: (photos: string[]) => void
  onPhotoBusyChange: (busy: boolean) => void
  city?: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.2 : 1 }


  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style}>
        <ItemEditForm type={item.type} initial={item} onDraftChange={onDraftChange} onSave={onUpdate} onClose={onEdit} onRecommendationChange={onRecommendationChange} city={city} />
        <EventPhotoInput photos={item.photos} name={item.name} onChange={onPhotoChange} onBusyChange={onPhotoBusyChange} />
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} className="bg-[#faf7ee] rounded-xl">
      <div className="flex items-center justify-between px-3 py-2.5 gap-2">
      <button type="button" {...attributes} {...listeners} className="text-[#c3bcad] hover:text-[#7a7b70] cursor-grab active:cursor-grabbing shrink-0 touch-none">
        <GripVertical size={14} />
      </button>
      <button type="button" onClick={onEdit} className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-75 transition-opacity">
        <ItemSummary item={item} />
      </button>
      <button type="button" onClick={onRemove} className="text-[#c3bcad] hover:text-red-400 text-lg leading-none shrink-0">×</button>
      </div>
      <EventPhotoInput photos={item.photos} name={item.name} onChange={onPhotoChange} onBusyChange={onPhotoBusyChange} />
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function EditForm({ itinerary }: { itinerary: ItineraryData }) {
  const boundAction = updateItinerary.bind(null, itinerary.id)
  const [state, action, pending] = useActionState(boundAction, undefined)

  function discardChanges() {
    if (pending) return
    // A full navigation also clears the editor's cached, unsaved React state.
    window.location.replace(`/itinerary/${itinerary.id}`)
  }

  const initialDates = monthAndDaysFromDates(fmt(itinerary.startDate), fmt(itinerary.endDate))

  const [postType, setPostType]   = useState<'itinerary' | 'guide'>(itinerary.postType === 'guide' ? 'guide' : 'itinerary')
  const [title, setTitle]         = useState(itinerary.title)
  const [tripMonth, setTripMonth] = useState(initialDates.month)
  const [tripDays, setTripDays]   = useState(initialDates.days)
  const [tripAudience, setTripAudience] = useState<'family' | 'friends' | 'romantic' | 'adult'>(
    ['family', 'friends', 'romantic'].includes(itinerary.audience) ? itinerary.audience as 'family' | 'friends' | 'romantic' : 'adult'
  )
  const [budget, setBudget]         = useState(itinerary.budget ?? 0)
  const [tags, setTags]             = useState<string[]>(itinerary.tags ?? [])
  const [tripRating, setTripRating] = useState<number | null>(itinerary.tripRating ?? null)
  const [notes, setNotes]           = useState(itinerary.notes ?? '')

  const [dests, setDests] = useState<EditDest[]>(
    itinerary.destinations.length > 0
      ? itinerary.destinations.map(destFromRaw)
      : [{ id: uid(), name: '', country: '', notes: '', items: [], curDayIndex: 1 }]
  )

  const [activeInput, setActiveInput] = useState<{ destId: string; type: ItemType } | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [draggedItem, setDraggedItem] = useState<{ destId: string; item: EditItem } | null>(null)

  const [photos, setPhotos]     = useState<UploadedPhoto[]>(itinerary.photos.map(p => ({ url: p.url, caption: p.caption ?? '' })))
  const [uploading, setUploading] = useState(false)
  const [itemUploads, setItemUploads] = useState(0)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const photosRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (photosRef.current) photosRef.current.value = JSON.stringify(photos) }, [photos])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  const tripDateRange = dateRangeFromMonthAndDays(tripMonth, tripDays)

  // ── Dest helpers ────────────────────────────────────────────────────────────

  function updDest(destId: string, fn: (d: EditDest) => EditDest) {
    setDests(ds => ds.map(d => d.id !== destId ? d : fn(d)))
  }

  function addItem(destId: string, item: Omit<EditItem, 'id' | 'dayIndex' | 'isHighlight' | 'photo' | 'photos' | 'alternative' | 'description' | 'link' | 'address' | 'priceLevel' | 'familyFriendly' | 'familyFriendlySource' | 'lat' | 'lng'>) {
    updDest(destId, d => ({
      ...d,
      items: [...d.items, {
        ...item, id: uid(), dayIndex: d.curDayIndex, isHighlight: getRecommendation(item.tags) === 'must', photo: '', photos: [],
        alternative: '', description: '', link: '', address: '',
        priceLevel: null, familyFriendly: null, familyFriendlySource: null, lat: null, lng: null,
      }]
    }))
    setActiveInput(null)
  }

  function updateItem(destId: string, itemId: string, updated: Partial<EditItem>) {
    updDest(destId, d => ({ ...d, items: d.items.map(i => i.id === itemId ? { ...i, ...updated } : i) }))
    setEditingItemId(null)
  }

  function removeItem(destId: string, itemId: string) {
    updDest(destId, d => ({ ...d, items: d.items.filter(i => i.id !== itemId) }))
  }

  function handleDragEnd(destId: string, event: DragEndEvent) {
    setDraggedItem(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    updDest(destId, d => {
      const activeId = String(active.id)
      const overId = String(over.id)
      if (postType === 'guide') return { ...d, items: reorderItems(d.items, activeId, overId) }
      const source = d.items.find(item => item.id === activeId)
      const target = d.items.find(item => item.id === overId)
      const day = target?.dayIndex ?? over.data.current?.day
      if (!source || typeof day !== 'number') return d
      if (target && source.dayIndex === day) {
        return { ...d, items: reorderItems(d.items, activeId, overId, day) }
      }
      const dragged = active.rect.current.translated
      const after = !!dragged && dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2
      return { ...d, items: moveItemToDay(d.items, activeId, day, target?.id, after) }
    })
  }

  async function uploadPhotos(files: File[]) {
    if (!files.length) return
    setUploading(true); setPhotoError(null)
    try {
      const uploaded: UploadedPhoto[] = []
      for (const file of files) {
        const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
        const blob = await upload(uniqueName, file, { access: 'private', handleUploadUrl: '/api/upload' })
        uploaded.push({ url: `/api/img?url=${encodeURIComponent(blob.url)}`, caption: '' })
      }
      setPhotos(p => [...p, ...uploaded])
    } catch { setPhotoError('Some photos could not be uploaded.') }
    finally { setUploading(false) }
  }

  const computedHighlights = dests
    .flatMap(d => d.items)
    .filter(i => i.isHighlight && i.type !== 'hotel' && i.name.trim())
    .map(i => i.name.trim())
    .join('\n')

  const hasUnnamedItems = dests.some(d => d.items.some(i => !i.name.trim()))
  const hasItems = dests.some(d => d.items.some(i => i.name.trim()))

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <form onKeyDown={preventImplicitSubmit} action={action} onSubmit={e => { if (itemUploads > 0 || hasUnnamedItems) e.preventDefault() }} className="space-y-4 pb-36">
      <input type="hidden" name="startDate"    value={tripDateRange.startDate} />
      <input type="hidden" name="endDate"      value={tripDateRange.endDate} />
      <input type="hidden" name="destinations" value={JSON.stringify(buildDestinations(dests))} />
      <input type="hidden" name="highlights"   value={computedHighlights} />
      <input type="hidden" name="photos"       ref={photosRef} defaultValue={JSON.stringify(photos)} />
      <input type="hidden" name="audience"     value={tripAudience} />
      <input type="hidden" name="visibility"   value="public" />
      <input type="hidden" name="postType"     value={postType} />
      <input type="hidden" name="tripRating"   value={tripRating ?? ''} />
      <input type="hidden" name="tags"         value={JSON.stringify(tags)} />
      {budget > 0 && <input type="hidden" name="budget" value={budget} />}
      <input type="hidden" name="notes"        value={notes} />

      <div className="flex justify-end">
        <button type="button" onClick={discardChanges} disabled={pending}
          className="min-h-11 px-3 text-sm font-medium text-[#6b7067] hover:text-[#2e4147] underline underline-offset-4 disabled:opacity-50">
          Discard changes
        </button>
      </div>

      {hasUnnamedItems && <p role="alert" className="text-sm text-red-700">Give each place a name or remove it before saving.</p>}
      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{state.error}</p>
      )}

      {/* ── DETAILS ──────────────────────────────────────────────────────────── */}
      <div className="bg-[#fffdf6] rounded-xl shadow-sm border border-[#e3dfd2] overflow-hidden">
        <div className="bg-[#eee7d9] border-b border-[#d7cebc] px-5 py-4">
          <h2 className="font-[family-name:var(--font-playfair)] text-xl text-[#2e4147]">Details</h2>
          {itinerary.visibility === 'draft' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#eee0c2] text-[#80632f] font-medium mt-1 inline-block">Draft</span>
          )}
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-1 bg-[#eee7d9] rounded-xl p-1 text-sm font-medium">
            <button type="button" onClick={() => setPostType('itinerary')}
              className={`flex-1 py-1.5 rounded-lg transition-colors ${postType === 'itinerary' ? 'bg-[#507c76] text-white shadow-sm' : 'text-[#6b7067]'}`}>
              ✈️ Itinerary
            </button>
            <button type="button" onClick={() => setPostType('guide')}
              className={`flex-1 py-1.5 rounded-lg transition-colors ${postType === 'guide' ? 'bg-[#507c76] text-white shadow-sm' : 'text-[#6b7067]'}`}>
              📖 Guide
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#7a7b70] mb-1">Title</label>
            <input name="title" type="text" required value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
          </div>
          {postType === 'itinerary' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#7a7b70] mb-1">Month and year</label>
                <input type="month" value={tripMonth} onChange={e => setTripMonth(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#7a7b70] mb-1">Number of days</label>
                <input type="number" min="1" step="1" inputMode="numeric" value={tripDays} onChange={e => setTripDays(e.target.value)} placeholder="e.g. 8" className={inputCls} />
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-[#7a7b70] mb-2">Trip type</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'family',   label: '👨‍👩‍👧 Family'  },
                { value: 'friends',  label: '🥳 Friends' },
                { value: 'romantic', label: '💋 Romantic'},
                { value: 'adult',    label: '🍷 Other'   },
              ].map(({ value, label }) => (
                <button key={value} type="button" onClick={() => setTripAudience(value as typeof tripAudience)}
                  className={`text-sm px-3 py-1.5 rounded-full border font-medium transition-colors ${tripAudience === value ? 'bg-[#507c76] text-white border-[#507c76]' : 'border-[#d7cebc] text-[#6b7067] hover:border-[#b8a98e]'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-[#7a7b70] mb-2">Tags</p>
            <TagPicker theme="paper" selected={tags} onChange={setTags} />
          </div>
          <div>
            <p className="text-xs font-medium text-[#7a7b70] mb-2">Budget</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setBudget(budget === n ? 0 : n)}
                  className={`text-base px-1 transition-colors ${n <= budget ? 'text-[#a27e3b]' : 'text-[#c3bcad]'}`}>$</button>
              ))}
            </div>
          </div>
          {postType === 'itinerary' && (
            <div>
              <p className="text-xs font-medium text-[#7a7b70] mb-2">Overall trip rating <span className="text-[#918d81] font-normal">(optional)</span></p>
              <TripRatingPicker theme="paper" value={tripRating} onChange={setTripRating} />
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-[#7a7b70] mb-1">General notes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Tips, packing list, visa info…" className={inputCls} />
          </div>
        </div>
      </div>

      {/* ── DESTINATIONS ─────────────────────────────────────────────────── */}
      {dests.map(dest => (
        <div key={dest.id} className="bg-[#fffdf6] rounded-xl shadow-sm border border-[#e3dfd2] overflow-hidden">
          {/* Header */}
          <div className="bg-[#e6ece5] border-t-2 border-t-[#507c76] border-b border-b-[#d7cebc] px-5 py-3 flex items-center gap-2">
            <MapPin size={15} className="text-[#507c76]" />
            <span className="font-[family-name:var(--font-playfair)] text-[#2e4147] text-lg flex-1">
              {dest.name || 'Destination'}{dest.country ? `, ${dest.country}` : ''}
            </span>
            {dests.length > 1 && (
              <button type="button" onClick={() => setDests(ds => ds.filter(d => d.id !== dest.id))}
                className="text-[#507c76] hover:text-red-700 text-lg leading-none">×</button>
            )}
          </div>

          <div className="p-5 space-y-4">
            {/* Dest name / country / notes */}
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <PlacesAutocomplete
                  value={dest.name}
                  onChange={val => updDest(dest.id, d => ({ ...d, name: val }))}
                  onSelect={(main, secondary) => updDest(dest.id, d => ({ ...d, name: main, country: secondary || d.country }))}
                  type="destination" placeholder="City or place" className={inputCls}
                />
                <input type="text" value={dest.country}
                  onChange={e => updDest(dest.id, d => ({ ...d, country: e.target.value }))}
                  placeholder="Country" className={inputCls} />
              </div>
              <textarea value={dest.notes} onChange={e => updDest(dest.id, d => ({ ...d, notes: e.target.value }))}
                rows={2} placeholder="📝 Notes for this destination (optional)" className={inputCls} />
            </div>

            {/* Days have separate sortable lists within one transfer context. */}
            {dest.items.length > 0 && (() => {
              const byDay = new Map<number, EditItem[]>()
              for (const item of dest.items) {
                if (!byDay.has(item.dayIndex)) byDay.set(item.dayIndex, [])
                byDay.get(item.dayIndex)!.push(item)
              }
              const lists = postType === 'guide'
                ? [{ day: undefined, items: dest.items }]
                : [...byDay.entries()].sort(([a], [b]) => a - b).map(([day, items]) => ({ day, items }))

              return (
                <DndContext sensors={sensors} collisionDetection={closestCenter}
                  onDragStart={({ active }) => {
                    const item = dest.items.find(item => item.id === active.id)
                    setDraggedItem(item ? { destId: dest.id, item } : null)
                  }}
                  onDragCancel={() => setDraggedItem(null)}
                  onDragEnd={e => handleDragEnd(dest.id, e)}>
                <div className="space-y-3">
                  {lists.map(({ day, items }) => (
                    <div key={day ?? 'guide'}>
                      {day !== undefined && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-[#426862] bg-[#e6ece5] px-2.5 py-1 rounded-full shrink-0">Day {day}</span>
                          <div className="flex-1 h-px bg-[#e6ece5]" />
                        </div>
                      )}
                        <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-2">
                            {items.map(item => (
                              <SortableItem key={item.id} item={item}
                                isEditing={editingItemId === item.id}
                                onEdit={() => setEditingItemId(editingItemId === item.id ? null : item.id)}
                                onUpdate={updated => updateItem(dest.id, item.id, updated)}
                                onDraftChange={updated => updDest(dest.id, d => ({ ...d, items: d.items.map(i => i.id === item.id ? { ...i, ...updated } : i) }))}
                                onRecommendationChange={value => updDest(dest.id, d => ({ ...d, items: d.items.map(i => i.id === item.id ? { ...i, tags: recommendationTags(i.tags, value), isHighlight: value === 'must' } : i) }))}
                                onRemove={() => removeItem(dest.id, item.id)}
                                onPhotoChange={photos => updDest(dest.id, d => ({ ...d, items: d.items.map(i => i.id === item.id ? { ...i, photos, photo: photos[0] ?? '' } : i) }))}
                                onPhotoBusyChange={busy => setItemUploads(count => count + (busy ? 1 : -1))}
                                city={dest.name || undefined}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      {day !== undefined && <DayDropZone destId={dest.id} day={day} />}
                    </div>
                  ))}
                </div>
                {typeof document !== 'undefined' && createPortal(
                  <DragOverlay zIndex={1000} dropAnimation={null}>
                    {draggedItem?.destId === dest.id ? <DraggedItem item={draggedItem.item} /> : null}
                  </DragOverlay>,
                  document.body,
                )}
                </DndContext>
              )
            })()}

            {/* Add item form */}
            {activeInput?.destId === dest.id && (
              <ItemForm
                type={activeInput.type}
                onAdd={item => addItem(dest.id, item)}
                onClose={() => setActiveInput(null)}
                city={dest.name || undefined}
              />
            )}

            {/* Buttons */}
            {(!activeInput || activeInput.destId !== dest.id) && !editingItemId && (
              <div className="space-y-2">
                {postType !== 'guide' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold bg-[#e6ece5] text-[#426862] px-2.5 py-1 rounded-full">Day {dest.curDayIndex}</span>
                    <span className="text-xs text-[#918d81]">Add places for this day</span>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setActiveInput({ destId: dest.id, type: 'hotel' })}
                    className="flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 border-dashed border-[#bbcfc5] text-[#507c76] hover:border-[#507c76] hover:bg-[#edf1e9] transition-all">
                    <Hotel size={20} />
                    <span className="text-xs font-semibold">+ Hotel</span>
                  </button>
                  <button type="button" onClick={() => setActiveInput({ destId: dest.id, type: 'food_drink' })}
                    className="flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 border-dashed border-[#dec4b4] text-[#ad6b57] hover:border-[#ad6b57] hover:bg-[#f5ebe1] transition-all">
                    <Utensils size={20} />
                    <span className="text-xs font-semibold">+ Food</span>
                  </button>
                  <button type="button" onClick={() => setActiveInput({ destId: dest.id, type: 'activity' })}
                    className="flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 border-dashed border-[#d9c99f] text-[#a27e3b] hover:border-[#a27e3b] hover:bg-[#f3eddb] transition-all">
                    <Camera size={20} />
                    <span className="text-xs font-semibold">+ Activity</span>
                  </button>
                </div>
                {postType !== 'guide' && (
                  <button type="button" onClick={() => updDest(dest.id, d => ({ ...d, curDayIndex: d.curDayIndex + 1 }))}
                    className="w-full py-2.5 rounded-xl border-2 border-[#bbcfc5] text-[#507c76] text-sm font-semibold hover:border-[#507c76] hover:bg-[#edf1e9] transition-all flex items-center justify-center gap-2">
                    <ArrowRight size={14} /> Add Day {dest.curDayIndex + 1}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      <button type="button" onClick={() => setDests(ds => [...ds, { id: uid(), name: '', country: '', notes: '', items: [], curDayIndex: 1 }])}
        className="w-full py-3 rounded-xl border-2 border-dashed border-[#bbcfc5] text-[#507c76] text-sm font-semibold hover:border-[#507c76] hover:bg-[#edf1e9] transition-all flex items-center justify-center gap-2">
        <Plus size={15} /> Add destination
      </button>

      {/* ── PHOTOS ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#fffdf6] rounded-xl shadow-sm border border-[#e3dfd2] p-5 space-y-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl text-[#2e4147]">Photos</h2>
        <label className={`flex flex-col items-center justify-center border-2 border-dashed border-[#d7cebc] rounded-xl p-5 cursor-pointer hover:border-[#507c76] transition-colors ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}>
          <ImageIcon size={22} className="text-[#7a7b70] mb-1" />
          <span className="text-sm font-medium text-[#507c76]">{uploading ? 'Uploading…' : 'Click to upload photos'}</span>
          <span className="text-xs text-[#7a7b70] mt-0.5">JPG, PNG, WEBP</span>
          <input type="file" accept="image/*" multiple className="sr-only" disabled={uploading}
            onChange={e => { uploadPhotos(Array.from(e.target.files ?? [])); e.target.value = '' }} />
        </label>
        {photoError && <p className="text-xs text-red-600">{photoError}</p>}
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
      </div>

      {/* ── SUBMIT ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={discardChanges} disabled={pending}
          className="flex-1 text-[#6b7067] font-semibold py-3 rounded-xl border-2 border-[#d7cebc] hover:bg-[#eee7d9] transition-colors disabled:opacity-60 text-sm">
          Discard changes
        </button>
        <button type="submit" name="isDraft" value="1" disabled={pending || uploading || itemUploads > 0 || hasUnnamedItems}
          className="flex-1 bg-[#fffdf6] text-[#5C3D2E] font-semibold py-3 rounded-xl border-2 border-[#d7cebc] hover:border-[#b8a98e] transition-colors disabled:opacity-60 text-sm">
          {pending ? 'Saving…' : 'Save as Draft'}
        </button>
        <button type="submit" disabled={pending || uploading || itemUploads > 0 || hasUnnamedItems || !hasItems}
          title={!hasItems ? 'Add at least one item first' : undefined}
          className="flex-1 bg-[#507c76] text-white font-semibold py-3 rounded-xl hover:bg-[#426862] transition-colors disabled:opacity-60 text-sm">
          {pending ? 'Saving…' : itinerary.visibility === 'draft' ? 'Publish' : 'Save changes'}
        </button>
      </div>
      <div className="flex justify-center">
        <DeleteButton id={itinerary.id} />
      </div>
    </form>
  )
}

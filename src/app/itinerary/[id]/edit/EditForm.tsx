'use client'

import { useActionState, useState, useRef, useEffect } from 'react'
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
  dayIndex?: number | null; order?: number | null
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

const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white'
const subInputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white'

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

const FOOD_TAGS     = ['Worth the Hype', 'Great Food', 'Hidden Gem', 'Local Favorite', "Can't-Miss", 'Good for Groups', 'Family Friendly', 'Great Cocktails', 'Great Ambiance', 'Lively', 'Romantic', 'Casual', 'Outdoor Dining', 'Great Views']
const HOTEL_TAGS    = ['Great Service', 'Worth the Splurge', 'Great Value', 'Hidden Gem', 'Boutique', 'Luxury', 'Romantic', 'Family-Friendly', 'Great Location', 'Great Views', 'Amazing Spa']
const ACTIVITY_TAGS = ['Must-Do', 'Hidden Gem', 'Family Friendly', 'Great Views', 'Free', 'Outdoor', 'Cultural', 'Adventurous']
const ITEM_TAGS: Record<ItemType, string[]> = { food_drink: FOOD_TAGS, hotel: HOTEL_TAGS, activity: ACTIVITY_TAGS }

function uid() { return Math.random().toString(36).slice(2) }
function fmt(d: Date) { return new Date(d).toISOString().slice(0, 10) }

// ── Data conversion: DB → flat EditItem[] ─────────────────────────────────────

function destFromRaw(d: ItineraryData['destinations'][number]): EditDest {
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
        ? Math.min(...nonHotel.map(i => (i.dayIndex ?? 0))) + 1
        : 1
      items.push({
        id: uid(), type: 'hotel', name: hotel.name,
        mealType: '', rating: hotel.rating ?? 0, notes: hotel.notes ?? '',
        tags: hotel.tags ?? [], dayIndex: hotelDay, isHighlight: false,
        alternative: hotel.alternative ?? '', description: hotel.description ?? '',
        link: hotel.link ?? '', address: hotel.address ?? '',
        priceLevel: hotel.priceLevel ?? null, familyFriendly: null,
        familyFriendlySource: null, lat: hotel.lat ?? null, lng: hotel.lng ?? null,
      })
    }

    for (const item of nonHotel.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
      items.push({
        id: uid(), type: item.type as 'food_drink' | 'activity',
        name: item.name, mealType: item.mealType ?? '',
        rating: item.rating ?? 0, notes: item.notes ?? '',
        tags: (item.tags ?? []).filter(t => t !== '__highlight'),
        dayIndex: (item.dayIndex ?? 0) + 1,
        isHighlight: (item.tags ?? []).includes('__highlight'),
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
            food: dayItems.filter(i => i.type === 'food_drink').map((i, pos) => ({
              name: i.name, mealType: i.mealType, description: i.description,
              notes: i.notes, link: i.link, rating: i.rating,
              priceLevel: i.priceLevel, familyFriendly: i.familyFriendly,
              familyFriendlySource: i.familyFriendlySource, lat: i.lat, lng: i.lng,
              order: pos, tags: [...i.tags, ...(i.isHighlight ? ['__highlight'] : [])],
              alternative: i.alternative,
            })),
            activities: dayItems.filter(i => i.type === 'activity').map((i, pos) => ({
              name: i.name, notes: i.notes, link: i.link, rating: i.rating,
              order: pos, tags: [...i.tags, ...(i.isHighlight ? ['__highlight'] : [])],
              alternative: i.alternative,
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
        hotelLink: hotel.link, hotelRating: hotel.rating, hotelAlternative: hotel.alternative,
        hotelDescription: hotel.description, hotelPriceLevel: hotel.priceLevel,
        hotelLat: hotel.lat, hotelLng: hotel.lng, hotelTags: hotel.tags,
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

function ItemEditForm({ type, initial, onSave, onClose, city }: {
  type: ItemType
  initial: EditItem
  onSave: (updated: Partial<EditItem>) => void
  onClose: () => void
  city?: string
}) {
  const [name, setName]           = useState(initial.name)
  const [mealType, setMealType]   = useState(initial.mealType)
  const [rating, setRating]       = useState(initial.rating)
  const [notes, setNotes]         = useState(initial.notes)
  const [alternative, setAlternative] = useState(initial.alternative)
  const [tags, setTags]           = useState<string[]>(initial.tags)
  const [description, setDescription] = useState(initial.description)
  const [link, setLink]           = useState(initial.link)
  const [address, setAddress]     = useState(initial.address)
  const [showMore, setShowMore]   = useState(initial.tags.length > 0 || !!initial.description || !!initial.link || !!initial.address)

  const cfg = {
    hotel:     { color: 'bg-blue-50 border-blue-200',     label: 'Hotel / Airbnb', placeholder: 'Hotel, house, Airbnb…',           placeType: 'hotel' as const,      notesPh: 'e.g. Book early, ask for a room upgrade, free breakfast…' },
    food_drink:{ color: 'bg-orange-50 border-orange-200', label: 'Food & Drink',   placeholder: 'e.g. Ramen Ichiran, Rooftop bar…', placeType: 'restaurant' as const, notesPh: 'e.g. Order the truffle pasta, great for groups…'           },
    activity:  { color: 'bg-green-50 border-green-200',   label: 'Activity',       placeholder: 'e.g. Eiffel Tower, Temple tour…',  placeType: 'activity' as const,   notesPh: 'e.g. Book tickets online, go early to beat the crowds…'   },
  }[type]

  function toggleTag(tag: string) {
    setTags(t => t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag])
  }

  function submit() {
    if (!name.trim()) return
    onSave({ name: name.trim(), mealType, rating, notes: notes.trim(), tags, alternative: alternative.trim(), description: description.trim(), link: link.trim(), address: address.trim() })
  }

  const moreCount = tags.length + (description ? 1 : 0) + (link ? 1 : 0) + (address ? 1 : 0)

  return (
    <div className={`rounded-2xl border ${cfg.color} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Edit {cfg.label}</p>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
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
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors capitalize ${isSel ? MEAL_ACTIVE[mt] : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                {MEAL_EMOJI[mt]} {mt}
              </button>
            )
          })}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-xs text-gray-500">Rate it</p>
        <StarRating value={rating} onChange={setRating} />
      </div>
      <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
        placeholder={cfg.notesPh} className={inputCls} />
      <PlacesAutocomplete value={alternative} onChange={setAlternative} type={cfg.placeType}
        placeholder="↔ Alternative (optional)" className={`${inputCls} text-gray-500`} city={city} />
      <button type="button" onClick={() => setShowMore(s => !s)}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors">
        {showMore ? '▲ Hide details' : '▼ More details'}
        {moreCount > 0 && !showMore && (
          <span className="ml-1 bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">{moreCount}</span>
        )}
      </button>
      {showMore && (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {ITEM_TAGS[type].map(tag => (
              <button key={tag} type="button" onClick={() => toggleTag(tag)}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${tags.includes(tag) ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                {tag}
              </button>
            ))}
          </div>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="✨ Description (optional)" className={subInputCls} />
          {type === 'hotel' && (
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="📍 Address (for Airbnbs, apartments…)" className={subInputCls} />
          )}
          <input type="url" value={link} onChange={e => setLink(e.target.value)}
            placeholder="🔗 Website link (optional)" className={subInputCls} />
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 text-sm font-medium hover:border-gray-300 transition-colors">
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={!name.trim()}
          className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
          <Check size={14} /> Save
        </button>
      </div>
    </div>
  )
}

// ── Item add form ──────────────────────────────────────────────────────────────

function ItemForm({ type, onAdd, onClose, city }: {
  type: ItemType
  onAdd: (item: Omit<EditItem, 'id' | 'dayIndex' | 'isHighlight' | 'alternative' | 'description' | 'link' | 'address' | 'priceLevel' | 'familyFriendly' | 'familyFriendlySource' | 'lat' | 'lng'>) => void
  onClose: () => void
  city?: string
}) {
  const [name, setName]         = useState('')
  const [mealType, setMealType] = useState('')
  const [rating, setRating]     = useState(0)
  const [notes, setNotes]       = useState('')
  const [tags, setTags]         = useState<string[]>([])
  const [showMore, setShowMore] = useState(false)

  const cfg = {
    hotel:     { color: 'bg-blue-50 border-blue-200',     label: 'Hotel / Airbnb', placeholder: 'Hotel, house, Airbnb…',           placeType: 'hotel' as const,      notesPh: 'e.g. Book early, ask for a room upgrade, free breakfast…' },
    food_drink:{ color: 'bg-orange-50 border-orange-200', label: 'Food & Drink',   placeholder: 'e.g. Ramen Ichiran, Rooftop bar…', placeType: 'restaurant' as const, notesPh: 'e.g. Order the truffle pasta, great for groups…'           },
    activity:  { color: 'bg-green-50 border-green-200',   label: 'Activity',       placeholder: 'e.g. Eiffel Tower, Temple tour…',  placeType: 'activity' as const,   notesPh: 'e.g. Book tickets online, go early to beat the crowds…'   },
  }[type]

  function toggleTag(tag: string) { setTags(t => t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag]) }

  function submit() {
    if (!name.trim()) return
    onAdd({ type, name: name.trim(), mealType, rating, notes: notes.trim(), tags })
    setName(''); setMealType(''); setRating(0); setNotes(''); setTags([]); setShowMore(false)
  }

  return (
    <div className={`rounded-2xl border ${cfg.color} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{cfg.label}</p>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
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
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors capitalize ${isSel ? MEAL_ACTIVE[mt] : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                {MEAL_EMOJI[mt]} {mt}
              </button>
            )
          })}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-xs text-gray-500">Rate it</p>
        <StarRating value={rating} onChange={setRating} />
      </div>
      <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
        placeholder={cfg.notesPh} className={inputCls} />
      <button type="button" onClick={() => setShowMore(s => !s)}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors">
        {showMore ? '▲ Hide details' : '▼ More details'}
        {tags.length > 0 && !showMore && (
          <span className="ml-1 bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">{tags.length}</span>
        )}
      </button>
      {showMore && (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {ITEM_TAGS[type].map(tag => (
              <button key={tag} type="button" onClick={() => toggleTag(tag)}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${tags.includes(tag) ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
      <button type="button" onClick={submit} disabled={!name.trim()}
        className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
        <Check size={14} /> Add
      </button>
    </div>
  )
}

// ── Sortable item row ──────────────────────────────────────────────────────────

function SortableItem({ item, isEditing, onEdit, onUpdate, onRemove, city }: {
  item: EditItem
  isEditing: boolean
  onEdit: () => void
  onUpdate: (updated: Partial<EditItem>) => void
  onRemove: () => void
  city?: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const icon = item.type === 'hotel'
    ? <Hotel size={13} className="text-blue-500 shrink-0" />
    : item.type === 'food_drink'
    ? <Utensils size={13} className="text-orange-500 shrink-0" />
    : <Camera size={13} className="text-green-500 shrink-0" />

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style}>
        <ItemEditForm type={item.type} initial={item} onSave={onUpdate} onClose={onEdit} city={city} />
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5 gap-2">
      <button type="button" {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none">
        <GripVertical size={14} />
      </button>
      <button type="button" onClick={onEdit} className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-75 transition-opacity">
        {icon}
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {item.mealType && <span className="text-xs text-gray-500">{item.mealType.split(',').map(t => `${MEAL_EMOJI[t]} ${t}`).join(' · ')}</span>}
            {item.rating > 0 && <span className="text-xs text-yellow-500">{'★'.repeat(item.rating)}</span>}
            {item.isHighlight && <span className="text-amber-400 text-xs">⭐</span>}
            {item.notes && <span className="text-xs text-gray-400 truncate">{item.notes}</span>}
          </div>
        </div>
      </button>
      <button type="button" onClick={onRemove} className="text-gray-300 hover:text-red-400 text-lg leading-none shrink-0">×</button>
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function EditForm({ itinerary }: { itinerary: ItineraryData }) {
  const boundAction = updateItinerary.bind(null, itinerary.id)
  const [state, action, pending] = useActionState(boundAction, undefined)

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

  const [photos, setPhotos]     = useState<UploadedPhoto[]>(itinerary.photos.map(p => ({ url: p.url, caption: p.caption ?? '' })))
  const [uploading, setUploading] = useState(false)
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

  function addItem(destId: string, item: Omit<EditItem, 'id' | 'dayIndex' | 'isHighlight' | 'alternative' | 'description' | 'link' | 'address' | 'priceLevel' | 'familyFriendly' | 'familyFriendlySource' | 'lat' | 'lng'>) {
    updDest(destId, d => ({
      ...d,
      items: [...d.items, {
        ...item, id: uid(), dayIndex: d.curDayIndex, isHighlight: false,
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
    const { active, over } = event
    if (!over || active.id === over.id) return
    updDest(destId, d => {
      const oldIndex = d.items.findIndex(i => i.id === active.id)
      const newIndex = d.items.findIndex(i => i.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return d
      return { ...d, items: arrayMove(d.items, oldIndex, newIndex) }
    })
  }

  function setTopPickFood(destId: string, itemId: string) {
    updDest(destId, d => {
      const item = d.items.find(i => i.id === itemId)
      if (!item) return d
      const count = d.items.filter(i => i.type === 'food_drink' && i.isHighlight).length
      if (!item.isHighlight && count >= 3) return d
      return { ...d, items: d.items.map(i => i.id === itemId ? { ...i, isHighlight: !i.isHighlight } : i) }
    })
  }

  function setTopPickActivity(destId: string, itemId: string) {
    updDest(destId, d => {
      const item = d.items.find(i => i.id === itemId)
      if (!item) return d
      const count = d.items.filter(i => i.type === 'activity' && i.isHighlight).length
      if (!item.isHighlight && count >= 3) return d
      return { ...d, items: d.items.map(i => i.id === itemId ? { ...i, isHighlight: !i.isHighlight } : i) }
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

  const hasItems = dests.some(d => d.items.some(i => i.name.trim()))

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <form action={action} className="space-y-4 pb-36">
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

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{state.error}</p>
      )}

      {/* ── DETAILS ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-5 py-4">
          <h2 className="font-bold text-white">Details</h2>
          {itinerary.visibility === 'draft' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-medium mt-1 inline-block">Draft</span>
          )}
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
            <input name="title" type="text" required value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
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
            <p className="text-xs font-medium text-gray-500 mb-2">Trip type</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'family',   label: '👨‍👩‍👧 Family'  },
                { value: 'friends',  label: '🥳 Friends' },
                { value: 'romantic', label: '💋 Romantic'},
                { value: 'adult',    label: '🍷 Other'   },
              ].map(({ value, label }) => (
                <button key={value} type="button" onClick={() => setTripAudience(value as typeof tripAudience)}
                  className={`text-sm px-3 py-1.5 rounded-full border font-medium transition-colors ${tripAudience === value ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Tags</p>
            <TagPicker selected={tags} onChange={setTags} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Budget</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setBudget(budget === n ? 0 : n)}
                  className={`text-base px-1 transition-colors ${n <= budget ? 'text-green-600' : 'text-gray-300'}`}>$</button>
              ))}
            </div>
          </div>
          {postType === 'itinerary' && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Overall trip rating <span className="text-gray-400 font-normal">(optional)</span></p>
              <TripRatingPicker value={tripRating} onChange={setTripRating} />
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">General notes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Tips, packing list, visa info…" className={inputCls} />
          </div>
        </div>
      </div>

      {/* ── DESTINATIONS ─────────────────────────────────────────────────── */}
      {dests.map(dest => (
        <div key={dest.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 flex items-center gap-2">
            <MapPin size={15} className="text-white/80" />
            <span className="font-bold text-white text-sm flex-1">
              {dest.name || 'Destination'}{dest.country ? `, ${dest.country}` : ''}
            </span>
            {dests.length > 1 && (
              <button type="button" onClick={() => setDests(ds => ds.filter(d => d.id !== dest.id))}
                className="text-white/60 hover:text-white text-lg leading-none">×</button>
            )}
          </div>

          <div className="p-5 space-y-4">
            {/* Dest name / country / notes */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <PlacesAutocomplete
                  value={dest.name}
                  onChange={val => updDest(dest.id, d => ({ ...d, name: val }))}
                  onSelect={(main, secondary) => updDest(dest.id, d => ({ ...d, name: main, country: secondary || d.country }))}
                  type="destination" placeholder="City or place" className={inputCls}
                />
                <input type="text" value={dest.country}
                  onChange={e => updDest(dest.id, d => ({ ...d, country: e.target.value }))}
                  placeholder="Country" className={`${inputCls} w-32 shrink-0`} />
              </div>
              <textarea value={dest.notes} onChange={e => updDest(dest.id, d => ({ ...d, notes: e.target.value }))}
                rows={2} placeholder="📝 Notes for this destination (optional)" className={inputCls} />
            </div>

            {/* Items grouped by day */}
            {dest.items.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter}
                onDragEnd={e => handleDragEnd(dest.id, e)}>
                <SortableContext items={dest.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {postType === 'guide' ? (
                      <div className="space-y-2">
                        {dest.items.map(item => (
                          <SortableItem key={item.id} item={item}
                            isEditing={editingItemId === item.id}
                            onEdit={() => setEditingItemId(editingItemId === item.id ? null : item.id)}
                            onUpdate={updated => updateItem(dest.id, item.id, updated)}
                            onRemove={() => removeItem(dest.id, item.id)}
                            city={dest.name || undefined}
                          />
                        ))}
                      </div>
                    ) : (
                      (() => {
                        const byDay = new Map<number, EditItem[]>()
                        for (const item of dest.items) {
                          if (!byDay.has(item.dayIndex)) byDay.set(item.dayIndex, [])
                          byDay.get(item.dayIndex)!.push(item)
                        }
                        return [...byDay.entries()].sort(([a], [b]) => a - b).map(([day, items]) => (
                          <div key={day}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full shrink-0">Day {day}</span>
                              <div className="flex-1 h-px bg-blue-100" />
                            </div>
                            <div className="space-y-2">
                              {items.map(item => (
                                <SortableItem key={item.id} item={item}
                                  isEditing={editingItemId === item.id}
                                  onEdit={() => setEditingItemId(editingItemId === item.id ? null : item.id)}
                                  onUpdate={updated => updateItem(dest.id, item.id, updated)}
                                  onRemove={() => removeItem(dest.id, item.id)}
                                  city={dest.name || undefined}
                                />
                              ))}
                            </div>
                          </div>
                        ))
                      })()
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            )}

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
                    <span className="text-sm font-bold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">Day {dest.curDayIndex}</span>
                    <span className="text-xs text-gray-400">Add places for this day</span>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setActiveInput({ destId: dest.id, type: 'hotel' })}
                    className="flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 border-dashed border-blue-200 text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all">
                    <Hotel size={20} />
                    <span className="text-xs font-semibold">+ Hotel</span>
                  </button>
                  <button type="button" onClick={() => setActiveInput({ destId: dest.id, type: 'food_drink' })}
                    className="flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 border-dashed border-orange-200 text-orange-600 hover:border-orange-400 hover:bg-orange-50 transition-all">
                    <Utensils size={20} />
                    <span className="text-xs font-semibold">+ Food</span>
                  </button>
                  <button type="button" onClick={() => setActiveInput({ destId: dest.id, type: 'activity' })}
                    className="flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 border-dashed border-green-200 text-green-600 hover:border-green-400 hover:bg-green-50 transition-all">
                    <Camera size={20} />
                    <span className="text-xs font-semibold">+ Activity</span>
                  </button>
                </div>
                {postType !== 'guide' && (
                  <button type="button" onClick={() => updDest(dest.id, d => ({ ...d, curDayIndex: d.curDayIndex + 1 }))}
                    className="w-full py-2.5 rounded-xl border-2 border-indigo-200 text-indigo-700 text-sm font-semibold hover:border-indigo-300 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                    <ArrowRight size={14} /> Add Day {dest.curDayIndex + 1}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      <button type="button" onClick={() => setDests(ds => [...ds, { id: uid(), name: '', country: '', notes: '', items: [], curDayIndex: 1 }])}
        className="w-full py-3 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 text-sm font-semibold hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
        <Plus size={15} /> Add destination
      </button>

      {/* ── MUST DO ──────────────────────────────────────────────────────────── */}
      {dests.some(d => d.items.filter(i => i.type !== 'hotel' && i.name.trim()).length > 0) && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 space-y-5">
          <div>
            <h2 className="font-bold text-gray-900">Must Do</h2>
            <p className="text-sm text-gray-500 mt-0.5">Pick up to 3 restaurants and 3 activities per destination.</p>
          </div>
          {dests.map(dest => {
            const food = dest.items.filter(i => i.type === 'food_drink' && i.name.trim())
            const acts = dest.items.filter(i => i.type === 'activity' && i.name.trim())
            if (food.length === 0 && acts.length === 0) return null
            const foodCount = food.filter(i => i.isHighlight).length
            const actCount  = acts.filter(i => i.isHighlight).length
            return (
              <div key={dest.id} className="space-y-3">
                {dests.length > 1 && (
                  <p className="text-sm font-semibold text-gray-800">{dest.name || 'Destination'}{dest.country ? `, ${dest.country}` : ''}</p>
                )}
                {food.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1.5">🍽️ Must-do restaurants {foodCount > 0 && <span className="text-amber-600">({foodCount}/3)</span>}</p>
                    <div className="space-y-1.5">
                      {food.map(item => (
                        <button key={item.id} type="button" onClick={() => setTopPickFood(dest.id, item.id)}
                          className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition-colors ${item.isHighlight ? 'bg-amber-50 border-amber-300 text-amber-900 font-medium' : foodCount >= 3 ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                          {item.isHighlight ? '⭐ ' : ''}{item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {acts.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1.5">📍 Must-do activities {actCount > 0 && <span className="text-amber-600">({actCount}/3)</span>}</p>
                    <div className="space-y-1.5">
                      {acts.map(item => (
                        <button key={item.id} type="button" onClick={() => setTopPickActivity(dest.id, item.id)}
                          className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition-colors ${item.isHighlight ? 'bg-amber-50 border-amber-300 text-amber-900 font-medium' : actCount >= 3 ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                          {item.isHighlight ? '⭐ ' : ''}{item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── PHOTOS ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Photos</h2>
        <label className={`flex flex-col items-center justify-center border-2 border-dashed border-purple-300 rounded-xl p-5 cursor-pointer hover:border-purple-400 transition-colors ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}>
          <ImageIcon size={22} className="text-purple-400 mb-1" />
          <span className="text-sm font-medium text-purple-700">{uploading ? 'Uploading…' : 'Click to upload photos'}</span>
          <span className="text-xs text-purple-400 mt-0.5">JPG, PNG, WEBP</span>
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
      <div className="flex gap-3">
        <button type="submit" name="isDraft" value="1" disabled={pending || uploading}
          className="flex-1 bg-white text-gray-700 font-semibold py-3 rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-colors disabled:opacity-60 text-sm">
          {pending ? 'Saving…' : 'Save as Draft'}
        </button>
        <button type="submit" disabled={pending || uploading || !hasItems}
          title={!hasItems ? 'Add at least one item first' : undefined}
          className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 text-sm">
          {pending ? 'Saving…' : itinerary.visibility === 'draft' ? 'Publish' : 'Save changes'}
        </button>
      </div>
      <div className="flex justify-center">
        <DeleteButton id={itinerary.id} />
      </div>
    </form>
  )
}

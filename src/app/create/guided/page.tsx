'use client'

import { useActionState, useState, useRef } from 'react'
import { createItinerary } from '@/actions/itinerary'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import { MapPin, Hotel, Utensils, Camera, Star, ChevronRight, Check, Plus } from 'lucide-react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────

type GuidedItem = {
  id: string
  type: 'hotel' | 'food_drink' | 'activity'
  name: string
  mealType: string
  rating: number
  notes: string
}

type GuidedDest = {
  id: string
  name: string
  country: string
  items: GuidedItem[]
}

type ActiveCard =
  | { kind: 'destination' }
  | { kind: 'item'; destId: string; itemType: 'hotel' | 'food_drink' | 'activity' }
  | null

// ── Constants ────────────────────────────────────────────────────────────────

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'drinks', 'coffee', 'dessert', 'bakery'] as const
const MEAL_EMOJI: Record<string, string> = {
  breakfast: '🍳', lunch: '☀️', dinner: '🌙', drinks: '🍹', coffee: '☕', dessert: '🍰', bakery: '🥐',
}
const MEAL_ACTIVE: Record<string, string> = {
  breakfast: 'bg-yellow-500 text-white border-yellow-500',
  lunch: 'bg-orange-500 text-white border-orange-500',
  dinner: 'bg-purple-600 text-white border-purple-600',
  drinks: 'bg-blue-500 text-white border-blue-500',
  coffee: 'bg-amber-700 text-white border-amber-700',
  dessert: 'bg-pink-500 text-white border-pink-500',
  bakery: 'bg-orange-400 text-white border-orange-400',
}

const inputClass = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white'

function uid() { return Math.random().toString(36).slice(2) }

// ── Star rating ──────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button" onClick={() => onChange(value === s ? 0 : s)}
          className="focus:outline-none">
          <Star size={20} className={s <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
        </button>
      ))}
    </div>
  )
}

// ── Destination form card ────────────────────────────────────────────────────

function DestCard({ onAdd }: { onAdd: (name: string, country: string) => void }) {
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <MapPin size={16} className="text-blue-600" />
        </div>
        <h2 className="font-semibold text-gray-900">Where are you going?</h2>
      </div>
      <div className="space-y-3">
        <PlacesAutocomplete
          value={name}
          onChange={setName}
          onSelect={(main, secondary) => { setName(main); if (secondary) setCountry(secondary) }}
          type="destination"
          placeholder="City or place"
          className={inputClass}
        />
        <input
          type="text" value={country} onChange={e => setCountry(e.target.value)}
          placeholder="Country"
          className={inputClass}
        />
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => { if (name.trim()) { onAdd(name.trim(), country.trim()); setName(''); setCountry('') } }}
          className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          Add destination <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// ── Item form card ───────────────────────────────────────────────────────────

function ItemCard({
  itemType, onAdd, onCancel,
}: {
  itemType: 'hotel' | 'food_drink' | 'activity'
  onAdd: (item: Omit<GuidedItem, 'id'>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [mealType, setMealType] = useState('')
  const [rating, setRating] = useState(0)
  const [notes, setNotes] = useState('')

  const colors = {
    hotel:     { bg: 'bg-blue-50',   border: 'border-blue-200',  icon: 'text-blue-600',   label: 'Hotel / Accommodation', Icon: Hotel },
    food_drink:{ bg: 'bg-orange-50', border: 'border-orange-200',icon: 'text-orange-600', label: 'Food & Drink',           Icon: Utensils },
    activity:  { bg: 'bg-green-50',  border: 'border-green-200', icon: 'text-green-600',  label: 'Activity',               Icon: Camera },
  }[itemType]

  const placeType = itemType === 'hotel' ? 'hotel' : itemType === 'food_drink' ? 'restaurant' : 'activity'

  function handleAdd() {
    if (!name.trim()) return
    onAdd({ type: itemType, name: name.trim(), mealType, rating, notes: notes.trim() })
    setName(''); setMealType(''); setRating(0); setNotes('')
  }

  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-5 space-y-3`}>
      <div className="flex items-center gap-2">
        <colors.Icon size={16} className={colors.icon} />
        <h3 className="font-semibold text-gray-900 text-sm">{colors.label}</h3>
      </div>
      <PlacesAutocomplete
        value={name}
        onChange={setName}
        type={placeType}
        placeholder={
          itemType === 'hotel' ? 'Hotel name (optional)' :
          itemType === 'food_drink' ? 'e.g. Ramen Ichiran, Rooftop bar…' :
          'e.g. Museum, Temple tour, Hiking…'
        }
        className={inputClass}
      />
      {itemType === 'food_drink' && (
        <div className="flex flex-wrap gap-1.5">
          {MEAL_TYPES.map(mt => (
            <button key={mt} type="button" onClick={() => setMealType(mealType === mt ? '' : mt)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors capitalize ${mealType === mt ? MEAL_ACTIVE[mt] : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
              {MEAL_EMOJI[mt]} {mt}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 shrink-0">Rate it</span>
        <StarRating value={rating} onChange={setRating} />
      </div>
      <input
        type="text" value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="📝 Notes (optional)"
        className={inputClass}
      />
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 rounded-xl border border-gray-300 text-sm text-gray-600 hover:border-gray-400 transition-colors">
          Cancel
        </button>
        <button type="button" onClick={handleAdd} disabled={!name.trim()}
          className="flex-1 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
          <Check size={14} /> Add
        </button>
      </div>
    </div>
  )
}

// ── Filled item row ──────────────────────────────────────────────────────────

function ItemRow({ item, onRemove }: { item: GuidedItem; onRemove: () => void }) {
  const colors = {
    hotel:     { bg: 'bg-blue-50',   text: 'text-blue-700',   Icon: Hotel },
    food_drink:{ bg: 'bg-orange-50', text: 'text-orange-700', Icon: Utensils },
    activity:  { bg: 'bg-green-50',  text: 'text-green-700',  Icon: Camera },
  }[item.type]

  return (
    <div className={`${colors.bg} rounded-xl px-3 py-2.5 flex items-start justify-between gap-2`}>
      <div className="flex items-start gap-2 min-w-0">
        <colors.Icon size={14} className={`${colors.text} mt-0.5 shrink-0`} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {item.mealType && (
              <span className="text-xs text-gray-500">{MEAL_EMOJI[item.mealType]} {item.mealType}</span>
            )}
            {item.rating > 0 && (
              <span className="flex items-center gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={10} className={s <= item.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
                ))}
              </span>
            )}
            {item.notes && <span className="text-xs text-gray-400 truncate">{item.notes}</span>}
          </div>
        </div>
      </div>
      <button type="button" onClick={onRemove} className="text-gray-300 hover:text-red-400 text-lg leading-none shrink-0">×</button>
    </div>
  )
}

// ── Destination section ──────────────────────────────────────────────────────

function DestSection({
  dest, activeCard, onOpenItem, onAddItem, onCancelItem, onRemoveItem, onRemoveDest,
}: {
  dest: GuidedDest
  activeCard: ActiveCard
  onOpenItem: (destId: string, type: 'hotel' | 'food_drink' | 'activity') => void
  onAddItem: (destId: string, item: Omit<GuidedItem, 'id'>) => void
  onCancelItem: () => void
  onRemoveItem: (destId: string, itemId: string) => void
  onRemoveDest: (destId: string) => void
}) {
  const isActiveHere = activeCard?.kind === 'item' && activeCard.destId === dest.id
  const activeType = isActiveHere && activeCard?.kind === 'item' ? activeCard.itemType : null

  const hasHotel = dest.items.some(i => i.type === 'hotel')

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
      {/* Destination header */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-blue-600" />
          <span className="font-semibold text-gray-900 text-sm">
            {dest.name}{dest.country ? `, ${dest.country}` : ''}
          </span>
        </div>
        <button type="button" onClick={() => onRemoveDest(dest.id)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
      </div>

      <div className="p-4 space-y-3">
        {/* Filled items */}
        {dest.items.length > 0 && (
          <div className="space-y-2">
            {dest.items.map(item => (
              <ItemRow key={item.id} item={item} onRemove={() => onRemoveItem(dest.id, item.id)} />
            ))}
          </div>
        )}

        {/* Active item form */}
        {activeType && (
          <ItemCard
            itemType={activeType}
            onAdd={item => onAddItem(dest.id, item)}
            onCancel={onCancelItem}
          />
        )}

        {/* Add buttons */}
        {!activeType && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button type="button" onClick={() => onOpenItem(dest.id, 'hotel')}
              disabled={hasHotel}
              className="flex flex-col items-center gap-1 py-3 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <Hotel size={18} />
              <span className="text-xs font-medium">Hotel</span>
            </button>
            <button type="button" onClick={() => onOpenItem(dest.id, 'food_drink')}
              className="flex flex-col items-center gap-1 py-3 rounded-xl border-2 border-dashed border-orange-200 text-orange-600 hover:border-orange-400 hover:bg-orange-50 transition-all">
              <Utensils size={18} />
              <span className="text-xs font-medium">Food / Drink</span>
            </button>
            <button type="button" onClick={() => onOpenItem(dest.id, 'activity')}
              className="flex flex-col items-center gap-1 py-3 rounded-xl border-2 border-dashed border-green-200 text-green-600 hover:border-green-400 hover:bg-green-50 transition-all">
              <Camera size={18} />
              <span className="text-xs font-medium">Activity</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function GuidedCreatePage() {
  const [state, action, pending] = useActionState(createItinerary, undefined)

  const [destinations, setDestinations] = useState<GuidedDest[]>([])
  const [activeCard, setActiveCard] = useState<ActiveCard>({ kind: 'destination' })
  const [title, setTitle] = useState('')
  const [postType, setPostType] = useState<'itinerary' | 'guide'>('itinerary')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isAdult, setIsAdult] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  function addDest(name: string, country: string) {
    const dest: GuidedDest = { id: uid(), name, country, items: [] }
    setDestinations(d => [...d, dest])
    setActiveCard(null)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
  }

  function removeDest(destId: string) {
    setDestinations(d => d.filter(x => x.id !== destId))
    if (activeCard?.kind === 'item' && activeCard.destId === destId) setActiveCard(null)
  }

  function openItem(destId: string, itemType: 'hotel' | 'food_drink' | 'activity') {
    setActiveCard({ kind: 'item', destId, itemType })
  }

  function addItem(destId: string, item: Omit<GuidedItem, 'id'>) {
    setDestinations(d => d.map(dest =>
      dest.id !== destId ? dest : { ...dest, items: [...dest.items, { ...item, id: uid() }] }
    ))
    setActiveCard(null)
  }

  function removeItem(destId: string, itemId: string) {
    setDestinations(d => d.map(dest =>
      dest.id !== destId ? dest : { ...dest, items: dest.items.filter(i => i.id !== itemId) }
    ))
  }

  // Convert guided format → action format
  function buildDestinations() {
    return destinations.map(d => ({
      name: d.name,
      country: d.country,
      notes: '',
      groups: [{
        hotelName: d.items.find(i => i.type === 'hotel')?.name ?? '',
        hotelNotes: '',
        hotelLink: '',
        hotelRating: d.items.find(i => i.type === 'hotel')?.rating ?? 0,
        food: d.items.filter(i => i.type === 'food_drink').map(i => ({
          name: i.name, mealType: i.mealType, notes: i.notes, link: '', rating: i.rating,
        })),
        activities: d.items.filter(i => i.type === 'activity').map(i => ({
          name: i.name, notes: i.notes, link: '', rating: i.rating,
        })),
      }],
    }))
  }

  const resolvedTitle = title.trim() || (destinations[0]?.name ? `Trip to ${destinations[0].name}` : 'Untitled Trip')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
      <Link href="/" className="text-sm text-blue-600 hover:underline mb-5 inline-block">← Back</Link>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Build your trip</h1>
        <p className="text-sm text-gray-500 mt-0.5">Add destinations, then fill in your stays, food, and activities.</p>
      </div>

      {/* Hidden form inputs — submitted at the end */}
      <form id="guided-form" action={action}>
        <input type="hidden" name="title" value={resolvedTitle} />
        <input type="hidden" name="postType" value={postType} />
        <input type="hidden" name="startDate" value={startDate} />
        <input type="hidden" name="endDate" value={endDate} />
        <input type="hidden" name="audience" value={isAdult ? 'adult' : 'family'} />
        <input type="hidden" name="visibility" value="public" />
        <input type="hidden" name="destinations" value={JSON.stringify(buildDestinations())} />
        <input type="hidden" name="photos" value="[]" />
      </form>

      <div className="space-y-4">
        {/* Filled destinations */}
        {destinations.map(dest => (
          <DestSection
            key={dest.id}
            dest={dest}
            activeCard={activeCard}
            onOpenItem={openItem}
            onAddItem={addItem}
            onCancelItem={() => setActiveCard(null)}
            onRemoveItem={removeItem}
            onRemoveDest={removeDest}
          />
        ))}

        {/* Destination input card */}
        {activeCard?.kind === 'destination' && (
          <DestCard onAdd={addDest} />
        )}

        {/* Add destination button (after first dest is added) */}
        {destinations.length > 0 && activeCard?.kind !== 'destination' && (
          <button
            type="button"
            onClick={() => setActiveCard({ kind: 'destination' })}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-blue-200 text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all text-sm font-medium"
          >
            <Plus size={16} /> Add another destination
          </button>
        )}

        {/* Bottom section: title + dates + post type + submit */}
        {destinations.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 space-y-4">
            <h3 className="font-semibold text-gray-900 text-sm">Trip details</h3>

            {/* Post type */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 text-sm font-medium w-fit">
              <button type="button" onClick={() => setPostType('itinerary')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${postType === 'itinerary' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                ✈️ Itinerary
              </button>
              <button type="button" onClick={() => setPostType('guide')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${postType === 'guide' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                📖 Guide
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
              <input
                type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder={resolvedTitle}
                className={inputClass}
              />
            </div>

            {/* Dates */}
            {postType === 'itinerary' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Start date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">End date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
                </div>
              </div>
            )}

            {/* Family friendly */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div onClick={() => setIsAdult(v => !v)} className={`w-10 h-6 rounded-full transition-colors relative ${!isAdult ? 'bg-green-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${!isAdult ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
              <span className="text-sm text-gray-900">Family friendly</span>
            </label>

            {state?.error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{state.error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button form="guided-form" type="submit" name="isDraft" value="1" disabled={pending}
                className="flex-1 bg-white text-gray-700 font-semibold py-3 rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-colors disabled:opacity-60">
                {pending ? 'Saving…' : 'Save as Draft'}
              </button>
              <button form="guided-form" type="submit" disabled={pending}
                className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60">
                {pending ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div ref={bottomRef} />
    </div>
  )
}

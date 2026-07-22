'use client'

import { useActionState, useState } from 'react'
import { createItinerary } from '@/actions/itinerary'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import { MapPin, Hotel, Utensils, Camera, Star, ArrowRight, Plus, Check, X } from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemType = 'hotel' | 'food_drink' | 'activity'

type GuidedItem = {
  id: string
  type: ItemType
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

type Phase = 'dest' | 'building' | 'more' | 'details'

// ── Constants ─────────────────────────────────────────────────────────────────

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

// ── Added item row ────────────────────────────────────────────────────────────

function AddedRow({ item, onRemove }: { item: GuidedItem; onRemove: () => void }) {
  const icon = item.type === 'hotel' ? <Hotel size={13} className="text-blue-500 shrink-0" />
    : item.type === 'food_drink' ? <Utensils size={13} className="text-orange-500 shrink-0" />
    : <Camera size={13} className="text-green-500 shrink-0" />

  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {item.mealType && <span className="text-xs text-gray-500">{MEAL_EMOJI[item.mealType]} {item.mealType}</span>}
            {item.rating > 0 && <span className="text-xs text-yellow-500">{'★'.repeat(item.rating)}</span>}
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
  onAdd: (item: Omit<GuidedItem, 'id'>) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [mealType, setMealType] = useState('')
  const [rating, setRating] = useState(0)
  const [notes, setNotes] = useState('')

  const cfg = {
    hotel:     { color: 'bg-blue-50 border-blue-200',   label: 'Hotel / Accommodation', placeholder: 'Hotel name', placeType: 'hotel' as const },
    food_drink:{ color: 'bg-orange-50 border-orange-200', label: 'Food & Drink',         placeholder: 'e.g. Ramen Ichiran, Rooftop bar…', placeType: 'restaurant' as const },
    activity:  { color: 'bg-green-50 border-green-200',  label: 'Activity',              placeholder: 'e.g. Eiffel Tower, Temple tour…',  placeType: 'activity' as const },
  }[type]

  function submit() {
    if (!name.trim()) return
    onAdd({ type, name: name.trim(), mealType, rating, notes: notes.trim() })
    setName(''); setMealType(''); setRating(0); setNotes('')
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
          {MEAL_TYPES.map(mt => (
            <button key={mt} type="button" onClick={() => setMealType(mealType === mt ? '' : mt)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors capitalize ${mealType === mt ? MEAL_ACTIVE[mt] : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
              {MEAL_EMOJI[mt]} {mt}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-xs text-gray-500">Rate it</p>
        <StarRating value={rating} onChange={setRating} />
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

function DestSummary({ dest, onRemove }: { dest: GuidedDest; onRemove: () => void }) {
  const hotel = dest.items.find(i => i.type === 'hotel')
  const food  = dest.items.filter(i => i.type === 'food_drink')
  const acts  = dest.items.filter(i => i.type === 'activity')
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
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
      </div>
      <div className="px-4 py-3 space-y-1.5 text-xs text-gray-600">
        {hotel && (
          <div className="flex items-center gap-1.5">
            <Hotel size={12} className="text-blue-500 shrink-0" />
            <span className="truncate">{hotel.name}</span>
            {hotel.rating > 0 && <span className="text-yellow-500 ml-1">{'★'.repeat(hotel.rating)}</span>}
          </div>
        )}
        {food.map(f => (
          <div key={f.id} className="flex items-center gap-1.5">
            <Utensils size={12} className="text-orange-500 shrink-0" />
            <span className="truncate">{f.name}</span>
            {f.mealType && <span className="text-gray-400 ml-1">{MEAL_EMOJI[f.mealType]}</span>}
          </div>
        ))}
        {acts.map(a => (
          <div key={a.id} className="flex items-center gap-1.5">
            <Camera size={12} className="text-green-500 shrink-0" />
            <span className="truncate">{a.name}</span>
          </div>
        ))}
        {dest.items.length === 0 && <span className="text-gray-400 italic">No items added</span>}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GuidedCreatePage() {
  const [formState, action, pending] = useActionState(createItinerary, undefined)

  const [dests, setDests] = useState<GuidedDest[]>([])
  const [curDest, setCurDest] = useState({ name: '', country: '' })
  const [curItems, setCurItems] = useState<GuidedItem[]>([])
  const [activeInput, setActiveInput] = useState<ItemType | null>(null)
  const [phase, setPhase] = useState<Phase>('dest')

  const [title, setTitle] = useState('')
  const [postType, setPostType] = useState<'itinerary' | 'guide'>('itinerary')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isAdult, setIsAdult] = useState(false)

  function addItem(item: Omit<GuidedItem, 'id'>) {
    setCurItems(i => [...i, { ...item, id: uid() }])
    setActiveInput(null)
  }

  function finishDest() {
    setDests(d => [...d, { id: uid(), name: curDest.name, country: curDest.country, items: curItems }])
    setCurDest({ name: '', country: '' })
    setCurItems([])
    setActiveInput(null)
    setPhase('more')
  }

  function buildDestinations() {
    // Include current in-progress destination so draft saves capture it
    const all: GuidedDest[] = [...dests]
    if (curDest.name.trim()) {
      all.push({ id: 'current', name: curDest.name, country: curDest.country, items: curItems })
    }
    return all.map(d => ({
      name: d.name, country: d.country, notes: '',
      groups: [{
        hotelName: d.items.find(i => i.type === 'hotel')?.name ?? '',
        hotelNotes: d.items.find(i => i.type === 'hotel')?.notes ?? '',
        hotelLink: '',
        hotelRating: d.items.find(i => i.type === 'hotel')?.rating ?? 0,
        food: d.items.filter(i => i.type === 'food_drink').map(i => ({ name: i.name, mealType: i.mealType, notes: i.notes, link: '', rating: i.rating })),
        activities: d.items.filter(i => i.type === 'activity').map(i => ({ name: i.name, notes: i.notes, link: '', rating: i.rating })),
      }],
    }))
  }

  const resolvedTitle = title.trim() || (dests[0]?.name ? `Trip to ${dests[0].name}` : 'Untitled Trip')
  const hasHotel = curItems.some(i => i.type === 'hotel')

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-36">
      <Link href="/" className="text-sm text-blue-600 hover:underline mb-5 inline-block">← Back</Link>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Step by step</h1>
      <p className="text-sm text-gray-500 mb-6">Build your trip one card at a time.</p>

      <form id="gf" action={action}>
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

        {/* Completed destinations */}
        {dests.map(d => (
          <DestSummary key={d.id} dest={d} onRemove={() => setDests(ds => ds.filter(x => x.id !== d.id))} />
        ))}

        {/* ── DEST card ───────────────────────────────────────────────────── */}
        {phase === 'dest' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center">
                <MapPin size={20} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">Where are you going?</h2>
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
              {/* Added items list */}
              {curItems.length > 0 && (
                <div className="space-y-2">
                  {curItems.map(item => (
                    <AddedRow key={item.id} item={item}
                      onRemove={() => setCurItems(is => is.filter(x => x.id !== item.id))} />
                  ))}
                </div>
              )}

              {/* Active input form */}
              {activeInput && (
                <ItemForm
                  type={activeInput}
                  onAdd={addItem}
                  onClose={() => setActiveInput(null)}
                />
              )}

              {/* Option buttons — always visible when no form open */}
              {!activeInput && (
                <div className="grid grid-cols-3 gap-2">
                  <button type="button"
                    onClick={() => setActiveInput('hotel')}
                    disabled={hasHotel}
                    className="flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 border-dashed border-blue-200 text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                    <Hotel size={20} />
                    <span className="text-xs font-semibold">
                      {hasHotel ? 'Hotel ✓' : '+ Hotel'}
                    </span>
                  </button>
                  <button type="button"
                    onClick={() => setActiveInput('food_drink')}
                    className="flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 border-dashed border-orange-200 text-orange-600 hover:border-orange-400 hover:bg-orange-50 transition-all">
                    <Utensils size={20} />
                    <span className="text-xs font-semibold">
                      {curItems.filter(i => i.type === 'food_drink').length > 0
                        ? `+ Restaurant`
                        : '+ Food / Drink'}
                    </span>
                  </button>
                  <button type="button"
                    onClick={() => setActiveInput('activity')}
                    className="flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 border-dashed border-green-200 text-green-600 hover:border-green-400 hover:bg-green-50 transition-all">
                    <Camera size={20} />
                    <span className="text-xs font-semibold">
                      {curItems.filter(i => i.type === 'activity').length > 0
                        ? '+ Activity'
                        : '+ Activity'}
                    </span>
                  </button>
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
              <p className="text-sm text-gray-500">Going anywhere else, or ready to finish?</p>
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
              <p className="text-white/70 text-xs mt-0.5">Give your trip a name and dates</p>
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
                    <label className="block text-xs font-medium text-gray-500 mb-1">Start date</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">End date</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
                  </div>
                </div>
              )}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div onClick={() => setIsAdult(v => !v)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${!isAdult ? 'bg-green-500' : 'bg-gray-200'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${!isAdult ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm text-gray-900">Family friendly</span>
              </label>

              {formState?.error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formState.error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button form="gf" type="submit" name="isDraft" value="1" disabled={pending}
                  className="flex-1 bg-white text-gray-700 font-semibold py-3 rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-colors disabled:opacity-60 text-sm">
                  {pending ? 'Saving…' : 'Save as Draft'}
                </button>
                <button form="gf" type="submit" disabled={pending}
                  className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 text-sm">
                  {pending ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

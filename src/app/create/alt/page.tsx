'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { createItinerary } from '@/actions/itinerary'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import Link from 'next/link'
import { MapPin, ArrowRight, Star, X, Check, Hotel, Utensils, Camera } from 'lucide-react'
import { dateRangeFromMonthAndDays } from '@/lib/tripDates'

// ── Types ──────────────────────────────────────────────────────────────────────

type ItemType = 'hotel' | 'food_drink' | 'activity'

type AltItem = {
  id: string
  type: ItemType
  name: string
  mealType: string
  rating: number
  notes: string
  tags: string[]
  isHighlight: boolean
  alternative: string
}

type AltDest = {
  id: string
  name: string
  country: string
  items: AltItem[]
}

type Phase = 'type' | 'dest' | 'building' | 'picks' | 'details'

type AllSuggestion = {
  label: string
  main: string
  secondary: string
  placeId: string | null
  guessedType: ItemType | null
}

// ── Constants ──────────────────────────────────────────────────────────────────

const inputCls    = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white'
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

const TYPE_META: Record<ItemType, { label: string; icon: React.ReactNode; color: string; pill: string }> = {
  hotel:     { label: 'Hotel / Stay',   icon: <Hotel    size={13} className="shrink-0" />, color: 'text-blue-600',   pill: 'bg-blue-100 text-blue-700 border-blue-200'   },
  food_drink:{ label: 'Food & Drink',   icon: <Utensils size={13} className="shrink-0" />, color: 'text-orange-500', pill: 'bg-orange-100 text-orange-700 border-orange-200' },
  activity:  { label: 'Activity / Sight', icon: <Camera size={13} className="shrink-0" />, color: 'text-green-600', pill: 'bg-green-100 text-green-700 border-green-200'   },
}

const SESSION_KEY = 'alt-trip-draft'

function uid() { return Math.random().toString(36).slice(2) }

// ── Star rating ────────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button" onClick={() => onChange(value === s ? 0 : s)} className="focus:outline-none">
          <Star size={20} className={s <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
        </button>
      ))}
    </div>
  )
}

// ── Unified search component ───────────────────────────────────────────────────

function UnifiedSearch({ city, onAdd }: {
  city: string
  onAdd: (item: Omit<AltItem, 'id' | 'isHighlight' | 'alternative'>) => void
}) {
  const [query, setQuery]               = useState('')
  const [suggestions, setSuggestions]   = useState<AllSuggestion[]>([])
  const [open, setOpen]                 = useState(false)
  const [pending, setPending]           = useState(false)

  // Confirm-step state
  const [selected, setSelected]         = useState<AllSuggestion | null>(null)
  const [confirmedType, setConfirmedType] = useState<ItemType | null>(null)
  const [rating, setRating]             = useState(0)
  const [mealType, setMealType]         = useState('')
  const [notes, setNotes]               = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  async function fetchSuggestions(q: string) {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }
    setPending(true)
    const params = new URLSearchParams({ q, type: 'all' })
    if (city) params.set('city', city)
    try {
      const res = await fetch(`/api/places?${params}`)
      if (res.ok) {
        const data: AllSuggestion[] = await res.json()
        setSuggestions(data)
        setOpen(data.length > 0)
      }
    } finally {
      setPending(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  function pick(s: AllSuggestion) {
    setSelected(s)
    setConfirmedType(s.guessedType)
    setQuery('')
    setSuggestions([])
    setOpen(false)
    setRating(0)
    setMealType('')
    setNotes('')
  }

  function confirm() {
    if (!selected || !confirmedType) return
    onAdd({ type: confirmedType, name: selected.main, mealType, rating, notes: notes.trim(), tags: [] })
    setSelected(null)
    setConfirmedType(null)
  }

  function cancel() {
    setSelected(null)
    setConfirmedType(null)
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Confirm step ──
  if (selected) {
    const activeType = confirmedType ?? 'activity'
    return (
      <div className="rounded-2xl border border-gray-200 p-4 space-y-3 bg-gray-50">
        {/* Type picker */}
        <div>
          <p className="text-xs text-gray-500 mb-2 font-medium">What kind of place is this?</p>
          <div className="flex gap-2 flex-wrap">
            {(['hotel', 'food_drink', 'activity'] as ItemType[]).map(t => {
              const meta = TYPE_META[t]
              const isActive = activeType === t
              return (
                <button key={t} type="button" onClick={() => { setConfirmedType(t); if (t !== 'food_drink') setMealType('') }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${isActive ? `${meta.pill} border` : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                  <span className={isActive ? '' : 'text-gray-400'}>{meta.icon}</span>
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Place name (read-only) */}
        <div className="flex items-center gap-2 py-2 px-3 bg-white rounded-xl border border-gray-200">
          <span className={TYPE_META[activeType].color}>{TYPE_META[activeType].icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{selected.main}</p>
            {selected.secondary && <p className="text-xs text-gray-400 truncate">{selected.secondary}</p>}
          </div>
          <button type="button" onClick={cancel} className="ml-auto text-gray-300 hover:text-gray-500 shrink-0"><X size={14} /></button>
        </div>

        {/* Meal type (food only) */}
        {activeType === 'food_drink' && (
          <div className="flex flex-wrap gap-1.5">
            {MEAL_TYPES.map(mt => {
              const selected2 = mealType.split(',').filter(Boolean)
              const isSelected = selected2.includes(mt)
              return (
                <button key={mt} type="button"
                  onClick={() => setMealType(isSelected ? selected2.filter(t => t !== mt).join(',') : [...selected2, mt].join(','))}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors capitalize ${isSelected ? MEAL_ACTIVE[mt] : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                  {MEAL_EMOJI[mt]} {mt}
                </button>
              )
            })}
          </div>
        )}

        {/* Rating */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Rate it</span>
          <StarRating value={rating} onChange={setRating} />
        </div>

        {/* Notes */}
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="📝 Notes (optional)" className={subInputCls} />

        {/* Actions */}
        <div className="flex gap-2">
          <button type="button" onClick={cancel}
            className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 text-sm font-medium hover:border-gray-300 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={confirm}
            className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
            <Check size={14} /> Add
          </button>
        </div>
      </div>
    )
  }

  // ── Search input + dropdown ──
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search for a hotel, restaurant, or activity…"
          className={inputCls}
          autoComplete="off"
        />
        {pending && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          {suggestions.map((s, i) => {
            const meta = s.guessedType ? TYPE_META[s.guessedType] : null
            return (
              <li key={i} onMouseDown={() => pick(s)}
                className="px-3 py-2.5 cursor-pointer hover:bg-gray-50 flex items-center gap-2.5">
                {meta ? (
                  <span className={`shrink-0 ${meta.color}`}>{meta.icon}</span>
                ) : (
                  <span className="shrink-0 text-gray-300"><Camera size={13} /></span>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-gray-900">{s.main}</span>
                  {s.secondary && <span className="text-xs text-gray-400 ml-1.5">{s.secondary}</span>}
                </div>
                {meta && (
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.pill}`}>
                    {s.guessedType === 'hotel' ? 'Hotel' : s.guessedType === 'food_drink' ? 'Food' : 'Activity'}
                  </span>
                )}
              </li>
            )
          })}
          {/* Manual entry fallback */}
          {query.trim() && (
            <li onMouseDown={() => pick({ label: query.trim(), main: query.trim(), secondary: '', placeId: null, guessedType: null })}
              className="px-3 py-2.5 cursor-pointer bg-gray-50 border-t border-gray-100 hover:bg-gray-100 flex items-center gap-1.5 text-sm text-gray-500">
              <span className="text-blue-500">↵</span> Use &ldquo;{query.trim()}&rdquo;
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

// ── Item chip ──────────────────────────────────────────────────────────────────

function ItemChip({ item, onRemove }: { item: AltItem; onRemove: () => void }) {
  const meta = TYPE_META[item.type]
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-gray-200">
      <span className={meta.color}>{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
        {item.mealType && <p className="text-xs text-gray-400 capitalize">{item.mealType.split(',').join(', ')}</p>}
      </div>
      {item.rating > 0 && (
        <div className="flex gap-0.5 shrink-0">
          {[1,2,3,4,5].map(s => (
            <span key={s} className={`text-xs ${s <= item.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
          ))}
        </div>
      )}
      <button type="button" onClick={onRemove} className="text-gray-300 hover:text-red-400 shrink-0"><X size={14} /></button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AltCreatePage() {
  const [state, action] = useActionState(createItinerary, undefined)

  const [phase, setPhase]       = useState<Phase>('type')
  const [postType, setPostType] = useState<'itinerary' | 'guide'>('itinerary')
  const [tripMonth, setTripMonth]   = useState('')
  const [tripDays, setTripDays]     = useState('')
  const [tripAudience, setTripAudience] = useState<'family' | 'friends' | 'romantic' | 'adult'>('family')
  const [title, setTitle]       = useState('')
  const [tags, setTags]         = useState<string[]>([])
  const [tripRating, setTripRating] = useState<number | null>(null)

  const [dests, setDests]       = useState<AltDest[]>([])
  const [curDest, setCurDest]   = useState({ name: '', country: '' })
  const [curItems, setCurItems] = useState<AltItem[]>([])

  // Persist across refreshes
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY)
      if (saved) {
        const s = JSON.parse(saved)
        if (s.phase) setPhase(s.phase)
        if (s.postType) setPostType(s.postType)
        if (s.dests) setDests(s.dests)
        if (s.curDest) setCurDest(s.curDest)
        if (s.curItems) setCurItems(s.curItems)
        if (s.tripMonth) setTripMonth(s.tripMonth)
        if (s.tripDays) setTripDays(s.tripDays)
        if (s.tripAudience) setTripAudience(s.tripAudience)
        if (s.title) setTitle(s.title)
        if (s.tags) setTags(s.tags)
        if (s.tripRating != null) setTripRating(s.tripRating)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ phase, postType, dests, curDest, curItems, tripMonth, tripDays, tripAudience, title, tags, tripRating }))
    } catch {}
  }, [phase, postType, dests, curDest, curItems, tripMonth, tripDays, tripAudience, title, tags, tripRating])

  function startOver() {
    setPhase('type'); setDests([]); setCurDest({ name: '', country: '' }); setCurItems([])
    setTitle(''); setTags([]); setTripMonth(''); setTripDays(''); setTripRating(null)
    try { sessionStorage.removeItem(SESSION_KEY) } catch {}
  }

  function addItem(item: Omit<AltItem, 'id' | 'isHighlight' | 'alternative'>) {
    setCurItems(i => [...i, { ...item, id: uid(), isHighlight: false, alternative: '' }])
  }

  function removeItem(id: string) {
    setCurItems(i => i.filter(x => x.id !== id))
  }

  function finishDest() {
    if (!curDest.name.trim()) return
    setDests(d => [...d, { id: uid(), name: curDest.name, country: curDest.country, items: curItems }])
    setCurDest({ name: '', country: '' })
    setCurItems([])
  }

  function buildDestinations() {
    const all: AltDest[] = [...dests]
    if (curDest.name.trim()) all.push({ id: 'cur', name: curDest.name, country: curDest.country, items: curItems })
    return all.map(d => {
      const hotels   = d.items.filter(i => i.type === 'hotel')
      const nonHotel = d.items.filter(i => i.type !== 'hotel')
      if (hotels.length === 0) {
        return {
          name: d.name, country: d.country, notes: '',
          groups: [{
            hotelName: '', hotelNotes: '', hotelAddress: '', hotelLink: '', hotelRating: 0, hotelAlternative: '',
            days: [{ food: nonHotel.filter(i => i.type === 'food_drink').map((i, pos) => ({ name: i.name, mealType: i.mealType, notes: i.notes, link: '', rating: i.rating, order: pos, tags: i.isHighlight ? ['__highlight'] : [], alternative: '' })), activities: nonHotel.filter(i => i.type === 'activity').map((i, pos) => ({ name: i.name, notes: i.notes, link: '', rating: i.rating, order: pos, tags: i.isHighlight ? ['__highlight'] : [], alternative: '' })) }],
          }],
        }
      }
      return {
        name: d.name, country: d.country, notes: '',
        groups: hotels.map((hotel, hi) => ({
          hotelName: hotel.name, hotelNotes: hotel.notes, hotelAddress: '', hotelLink: '', hotelRating: hotel.rating, hotelAlternative: '',
          days: [{ food: nonHotel.filter(i => i.type === 'food_drink' && d.items.indexOf(i) >= d.items.indexOf(hotel) && (hi === hotels.length - 1 || d.items.indexOf(i) < d.items.indexOf(hotels[hi + 1]))).map((i, pos) => ({ name: i.name, mealType: i.mealType, notes: i.notes, link: '', rating: i.rating, order: pos, tags: i.isHighlight ? ['__highlight'] : [], alternative: '' })), activities: nonHotel.filter(i => i.type === 'activity' && d.items.indexOf(i) >= d.items.indexOf(hotel) && (hi === hotels.length - 1 || d.items.indexOf(i) < d.items.indexOf(hotels[hi + 1]))).map((i, pos) => ({ name: i.name, notes: i.notes, link: '', rating: i.rating, order: pos, tags: i.isHighlight ? ['__highlight'] : [], alternative: '' })) }],
        })),
      }
    })
  }

  const tripDateRange = dateRangeFromMonthAndDays(tripMonth, tripDays)
  const allDests = dests.length + (curDest.name.trim() ? 1 : 0)
  const allItems = dests.reduce((n, d) => n + d.items.length, 0) + curItems.length

  // Highlight picks — items the user marked as must-do
  const highlights = [...dests, ...(curDest.name.trim() ? [{ id: 'cur', name: curDest.name, country: curDest.country, items: curItems }] : [])]
    .flatMap(d => d.items.filter(i => i.isHighlight).map(i => i.name))
    .join('\n')

  function toggleHighlight(destId: string, itemId: string) {
    if (destId === 'cur') {
      setCurItems(items => items.map(i => i.id === itemId ? { ...i, isHighlight: !i.isHighlight } : i))
    } else {
      setDests(ds => ds.map(d => d.id !== destId ? d : { ...d, items: d.items.map(i => i.id === itemId ? { ...i, isHighlight: !i.isHighlight } : i) }))
    }
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const AUDIENCES = [
    { value: 'family',   label: '👨‍👩‍👧 Family'   },
    { value: 'friends',  label: '👯 Friends'  },
    { value: 'romantic', label: '💑 Romantic' },
    { value: 'adult',    label: '🧑 Solo / adults' },
  ] as const

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
      <h1 className="text-xl font-bold text-gray-900 mb-1">Quick add</h1>
      <p className="text-sm text-gray-500 mb-6">Search any place — we&apos;ll figure out the type.</p>

      {/* Hidden form submits to server action */}
      <form id="altform" action={action} onSubmit={() => { try { sessionStorage.removeItem(SESSION_KEY) } catch {} }}>
        <input type="hidden" name="title"       value={title} />
        <input type="hidden" name="postType"    value={postType} />
        <input type="hidden" name="startDate"   value={tripDateRange.startDate} />
        <input type="hidden" name="endDate"     value={tripDateRange.endDate} />
        <input type="hidden" name="audience"    value={tripAudience} />
        <input type="hidden" name="visibility"  value="public" />
        <input type="hidden" name="destinations" value={JSON.stringify(buildDestinations())} />
        <input type="hidden" name="highlights"  value={highlights} />
        <input type="hidden" name="photos"      value="[]" />
        <input type="hidden" name="tags"        value={JSON.stringify(tags)} />
        {tripRating && <input type="hidden" name="tripRating" value={tripRating} />}
      </form>

      <div className="space-y-4">

        {/* Completed destinations */}
        {dests.map(d => (
          <div key={d.id} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={14} className="text-blue-500 shrink-0" />
              <p className="font-semibold text-gray-900 text-sm">{d.name}{d.country ? <span className="text-gray-400 font-normal">, {d.country}</span> : null}</p>
              <button type="button" onClick={() => setDests(ds => ds.filter(x => x.id !== d.id))} className="ml-auto text-gray-300 hover:text-red-400"><X size={14} /></button>
            </div>
            <div className="space-y-1.5">
              {d.items.map(item => (
                <ItemChip key={item.id} item={item} onRemove={() => setDests(ds => ds.map(x => x.id !== d.id ? x : { ...x, items: x.items.filter(i => i.id !== item.id) }))} />
              ))}
            </div>
          </div>
        ))}

        {/* ── TYPE ── */}
        {phase === 'type' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-5 py-4">
              <h2 className="font-bold text-white">What are you creating?</h2>
            </div>
            <div className="p-5 space-y-3">
              <button type="button" onClick={() => { setPostType('itinerary'); setPhase('dest') }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left">
                <span className="text-3xl">✈️</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Itinerary</p>
                  <p className="text-xs text-gray-500 mt-0.5">A trip with dates, hotels, and activities</p>
                </div>
              </button>
              <button type="button" onClick={() => { setPostType('guide'); setPhase('dest') }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-green-200 hover:border-green-400 hover:bg-green-50 transition-all text-left">
                <span className="text-3xl">📖</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Guide</p>
                  <p className="text-xs text-gray-500 mt-0.5">Your recommendations — no dates needed</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── DEST ── */}
        {phase === 'dest' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center">
                <MapPin size={20} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">Where did you go?</h2>
                <p className="text-white/70 text-xs mt-0.5">Add your first destination</p>
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
                placeholder="Country" className={inputCls} />
              {postType === 'itinerary' && (
                <div className="flex gap-2">
                  <select value={tripMonth} onChange={e => setTripMonth(e.target.value)}
                    className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                    <option value="">Month</option>
                    {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
                  </select>
                  <select value={tripDays} onChange={e => setTripDays(e.target.value)}
                    className="w-20 shrink-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                    <option value="">#</option>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={String(n)}>{n}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {AUDIENCES.map(a => (
                  <button key={a.value} type="button" onClick={() => setTripAudience(a.value)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${tripAudience === a.value ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                    {a.label}
                  </button>
                ))}
              </div>
              <button type="button" disabled={!curDest.name.trim()}
                onClick={() => setPhase('building')}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
                Start adding places <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── BUILDING ── */}
        {phase === 'building' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 flex items-center gap-2">
              <MapPin size={15} className="text-white/80" />
              <span className="font-bold text-white text-sm">
                {curDest.name}{curDest.country ? <span className="font-normal opacity-75">, {curDest.country}</span> : null}
              </span>
            </div>
            <div className="p-4 space-y-3">
              {/* Search */}
              <UnifiedSearch city={curDest.name} onAdd={addItem} />

              {/* Item list */}
              {curItems.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {curItems.map(item => (
                    <ItemChip key={item.id} item={item} onRemove={() => removeItem(item.id)} />
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                {allDests > 0 || curItems.length > 0 ? (
                  <button type="button"
                    onClick={() => { finishDest(); setPhase('building') }}
                    disabled={!curDest.name.trim()}
                    className="flex-1 py-2.5 rounded-xl border-2 border-blue-200 text-blue-600 text-sm font-semibold hover:border-blue-400 transition-colors disabled:opacity-40">
                    + Add another city
                  </button>
                ) : null}
                <button type="button"
                  disabled={allItems === 0 && curItems.length === 0}
                  onClick={() => { finishDest(); setPhase('picks') }}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  Next <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PICKS ── */}
        {phase === 'picks' && (() => {
          const allDestsForPicks = dests
          return (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-400 px-5 py-4">
                <h2 className="font-bold text-white">⭐ Must Do</h2>
                <p className="text-white/80 text-xs mt-0.5">Tap the places you&apos;d recommend most.</p>
              </div>
              <div className="p-4 space-y-4">
                {allDestsForPicks.map(d => (
                  <div key={d.id}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{d.name}</p>
                    <div className="space-y-1.5">
                      {d.items.filter(i => i.type !== 'hotel').map(item => (
                        <button key={item.id} type="button" onClick={() => toggleHighlight(d.id, item.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors text-left ${item.isHighlight ? 'bg-amber-50 border-amber-300 text-amber-900 font-medium' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                          <span className={TYPE_META[item.type].color}>{TYPE_META[item.type].icon}</span>
                          {item.isHighlight ? '⭐ ' : ''}{item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setPhase('details')}
                  className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                  Next <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )
        })()}

        {/* ── DETAILS ── */}
        {phase === 'details' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-5 py-4">
              <h2 className="font-bold text-white">Final details</h2>
              <p className="text-white/70 text-xs mt-0.5">{allDests} destination{allDests !== 1 ? 's' : ''} · {allItems} place{allItems !== 1 ? 's' : ''}</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Give your trip a name" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Overall rating</label>
                <StarRating value={tripRating ?? 0} onChange={v => setTripRating(v === tripRating ? null : v)} />
              </div>
              {state?.error && (
                <p className="text-sm text-red-600 font-medium">{state.error}</p>
              )}
              <div className="flex gap-2">
                <button form="altform" type="submit" name="isDraft" value="1"
                  className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-300 transition-colors">
                  Save draft
                </button>
                <button form="altform" type="submit"
                  className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
                  Publish <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

'use client'

import { useActionState, useState } from 'react'
import { createItinerary } from '@/actions/itinerary'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import { MapPin, Hotel, Utensils, Camera, Star, ArrowRight, Plus, Check } from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

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

type Phase = 'dest' | 'hotel' | 'food' | 'activity' | 'more' | 'details'

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

function uid() { return Math.random().toString(36).slice(2) }

const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white'

// ── Step progress strip ───────────────────────────────────────────────────────

const STEPS: { phase: Phase; label: string }[] = [
  { phase: 'dest',    label: 'Where' },
  { phase: 'hotel',   label: 'Stay' },
  { phase: 'food',    label: 'Eat' },
  { phase: 'activity',label: 'Do' },
  { phase: 'details', label: 'Finish' },
]

function ProgressBar({ phase }: { phase: Phase }) {
  const idx = STEPS.findIndex(s => s.phase === phase)
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {STEPS.map((s, i) => (
        <div key={s.phase} className="flex items-center gap-1">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-all ${
            i < idx ? 'bg-blue-600 text-white' :
            i === idx ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
            'bg-gray-100 text-gray-400'
          }`}>
            {i < idx ? <Check size={12} /> : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-6 h-0.5 ${i < idx ? 'bg-blue-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

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

// ── Completed destination summary card ────────────────────────────────────────

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
            {hotel.rating > 0 && <span className="text-yellow-500">{'★'.repeat(hotel.rating)}</span>}
          </div>
        )}
        {food.map(f => (
          <div key={f.id} className="flex items-center gap-1.5">
            <Utensils size={12} className="text-orange-500 shrink-0" />
            <span className="truncate">{f.name}</span>
            {f.mealType && <span className="text-gray-400">{MEAL_EMOJI[f.mealType]}</span>}
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

// ── Card shell ────────────────────────────────────────────────────────────────

function Card({ color, icon, title, subtitle, children }: {
  color: string; icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      <div className={`${color} px-5 py-4`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/30 flex items-center justify-center">
            {icon}
          </div>
          <div>
            <h2 className="font-bold text-white text-base">{title}</h2>
            {subtitle && <p className="text-white/70 text-xs mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function NavButtons({ onSkip, onNext, nextLabel = 'Next', nextDisabled = false, skipLabel = 'Skip' }: {
  onSkip?: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean; skipLabel?: string
}) {
  return (
    <div className="flex gap-3 mt-5">
      {onSkip && (
        <button type="button" onClick={onSkip}
          className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-500 hover:border-gray-300 transition-colors">
          {skipLabel}
        </button>
      )}
      <button type="button" onClick={onNext} disabled={nextDisabled}
        className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
        {nextLabel} <ArrowRight size={15} />
      </button>
    </div>
  )
}

// ── Added item row (within a step) ────────────────────────────────────────────

function AddedRow({ item, onRemove }: { item: GuidedItem; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Check size={14} className="text-green-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {item.mealType && <span className="text-xs text-gray-500">{MEAL_EMOJI[item.mealType]} {item.mealType}</span>}
            {item.rating > 0 && (
              <span className="text-xs text-yellow-500">{'★'.repeat(item.rating)}</span>
            )}
            {item.notes && <span className="text-xs text-gray-400 truncate">{item.notes}</span>}
          </div>
        </div>
      </div>
      <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-lg leading-none shrink-0">×</button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GuidedCreatePage() {
  const [formState, action, pending] = useActionState(createItinerary, undefined)

  // Completed destinations
  const [dests, setDests] = useState<GuidedDest[]>([])

  // Current destination being built
  const [curDest, setCurDest] = useState({ name: '', country: '' })
  const [curItems, setCurItems] = useState<GuidedItem[]>([])

  // Current step
  const [phase, setPhase] = useState<Phase>('dest')

  // Current input values (reset between steps)
  const [hotelName, setHotelName] = useState('')
  const [hotelRating, setHotelRating] = useState(0)
  const [hotelNotes, setHotelNotes] = useState('')

  const [foodName, setFoodName] = useState('')
  const [foodMeal, setFoodMeal] = useState('')
  const [foodRating, setFoodRating] = useState(0)
  const [foodNotes, setFoodNotes] = useState('')

  const [actName, setActName] = useState('')
  const [actRating, setActRating] = useState(0)
  const [actNotes, setActNotes] = useState('')

  // Details
  const [title, setTitle] = useState('')
  const [postType, setPostType] = useState<'itinerary' | 'guide'>('itinerary')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isAdult, setIsAdult] = useState(false)

  // ── Helpers ──────────────────────────────────────────────────────────────

  function addHotel() {
    if (!hotelName.trim()) return
    setCurItems(i => [...i, { id: uid(), type: 'hotel', name: hotelName.trim(), mealType: '', rating: hotelRating, notes: hotelNotes.trim() }])
    setHotelName(''); setHotelRating(0); setHotelNotes('')
  }

  function addFood() {
    if (!foodName.trim()) return
    setCurItems(i => [...i, { id: uid(), type: 'food_drink', name: foodName.trim(), mealType: foodMeal, rating: foodRating, notes: foodNotes.trim() }])
    setFoodName(''); setFoodMeal(''); setFoodRating(0); setFoodNotes('')
  }

  function addActivity() {
    if (!actName.trim()) return
    setCurItems(i => [...i, { id: uid(), type: 'activity', name: actName.trim(), mealType: '', rating: actRating, notes: actNotes.trim() }])
    setActName(''); setActRating(0); setActNotes('')
  }

  function finishDest() {
    const dest: GuidedDest = { id: uid(), name: curDest.name, country: curDest.country, items: curItems }
    setDests(d => [...d, dest])
    setCurDest({ name: '', country: '' })
    setCurItems([])
    setPhase('more')
  }

  function startNewDest() {
    setPhase('dest')
  }

  function goToDetails() {
    setPhase('details')
  }

  function buildDestinations() {
    return dests.map(d => ({
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
  const curFoodItems  = curItems.filter(i => i.type === 'food_drink')
  const curActItems   = curItems.filter(i => i.type === 'activity')
  const hasHotel      = curItems.some(i => i.type === 'hotel')

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-36">
      <Link href="/" className="text-sm text-blue-600 hover:underline mb-5 inline-block">← Back</Link>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Step by step</h1>
      <p className="text-sm text-gray-500 mb-6">Build your trip one card at a time.</p>

      {/* Hidden form */}
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

      {/* Progress */}
      {phase !== 'more' && <ProgressBar phase={phase} />}

      <div className="space-y-4">

        {/* ── Completed destinations ──────────────────────────────────────── */}
        {dests.map(d => (
          <DestSummary key={d.id} dest={d} onRemove={() => setDests(ds => ds.filter(x => x.id !== d.id))} />
        ))}

        {/* ── DEST card ───────────────────────────────────────────────────── */}
        {phase === 'dest' && (
          <Card color="bg-gradient-to-r from-blue-600 to-blue-500" icon={<MapPin size={20} className="text-white" />}
            title="Where are you going?" subtitle="Start by adding a destination">
            <div className="space-y-3">
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
              <NavButtons
                onNext={() => setPhase('hotel')}
                nextLabel="Next — Where to stay"
                nextDisabled={!curDest.name.trim()}
              />
            </div>
          </Card>
        )}

        {/* ── HOTEL card ──────────────────────────────────────────────────── */}
        {phase === 'hotel' && (
          <Card color="bg-gradient-to-r from-blue-500 to-indigo-500" icon={<Hotel size={20} className="text-white" />}
            title={`Stay in ${curDest.name}`} subtitle="Where did you sleep?">
            <div className="space-y-3">
              {hasHotel && (
                <div className="space-y-2 mb-2">
                  {curItems.filter(i => i.type === 'hotel').map(item => (
                    <AddedRow key={item.id} item={item} onRemove={() => setCurItems(is => is.filter(x => x.id !== item.id))} />
                  ))}
                </div>
              )}
              {!hasHotel && (
                <>
                  <PlacesAutocomplete
                    value={hotelName} onChange={setHotelName} type="hotel"
                    placeholder="Hotel name (optional)" className={inputCls}
                  />
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Rate it</p>
                    <StarRating value={hotelRating} onChange={setHotelRating} />
                  </div>
                  <input type="text" value={hotelNotes} onChange={e => setHotelNotes(e.target.value)}
                    placeholder="📝 Notes (optional)" className={inputCls} />
                  {hotelName.trim() && (
                    <button type="button" onClick={addHotel}
                      className="w-full py-2 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2">
                      <Plus size={14} /> Add hotel
                    </button>
                  )}
                </>
              )}
              <NavButtons
                onSkip={() => setPhase('food')}
                onNext={() => setPhase('food')}
                nextLabel="Next — Food & Drink"
                skipLabel="Skip"
              />
            </div>
          </Card>
        )}

        {/* ── FOOD card ───────────────────────────────────────────────────── */}
        {phase === 'food' && (
          <Card color="bg-gradient-to-r from-orange-500 to-orange-400" icon={<Utensils size={20} className="text-white" />}
            title={`Eat in ${curDest.name}`} subtitle="Restaurants, bars, cafés…">
            <div className="space-y-3">
              {curFoodItems.length > 0 && (
                <div className="space-y-2 mb-2">
                  {curFoodItems.map(item => (
                    <AddedRow key={item.id} item={item} onRemove={() => setCurItems(is => is.filter(x => x.id !== item.id))} />
                  ))}
                </div>
              )}
              <PlacesAutocomplete
                value={foodName} onChange={setFoodName} type="restaurant"
                placeholder="e.g. Ramen Ichiran, Rooftop bar…" className={inputCls}
              />
              <div className="flex flex-wrap gap-1.5">
                {MEAL_TYPES.map(mt => (
                  <button key={mt} type="button" onClick={() => setFoodMeal(foodMeal === mt ? '' : mt)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors capitalize ${foodMeal === mt ? MEAL_ACTIVE[mt] : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                    {MEAL_EMOJI[mt]} {mt}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Rate it</p>
                <StarRating value={foodRating} onChange={setFoodRating} />
              </div>
              <input type="text" value={foodNotes} onChange={e => setFoodNotes(e.target.value)}
                placeholder="📝 Notes (optional)" className={inputCls} />
              {foodName.trim() && (
                <button type="button" onClick={addFood}
                  className="w-full py-2 rounded-xl bg-orange-50 text-orange-700 text-sm font-medium hover:bg-orange-100 transition-colors flex items-center justify-center gap-2">
                  <Plus size={14} /> Add {curFoodItems.length > 0 ? 'another' : 'place'}
                </button>
              )}
              <NavButtons
                onSkip={() => setPhase('activity')}
                onNext={() => setPhase('activity')}
                nextLabel="Next — Activities"
                skipLabel={curFoodItems.length > 0 ? 'Done with food' : 'Skip'}
              />
            </div>
          </Card>
        )}

        {/* ── ACTIVITY card ────────────────────────────────────────────────── */}
        {phase === 'activity' && (
          <Card color="bg-gradient-to-r from-green-600 to-green-500" icon={<Camera size={20} className="text-white" />}
            title={`Things to do in ${curDest.name}`} subtitle="Sights, tours, experiences…">
            <div className="space-y-3">
              {curActItems.length > 0 && (
                <div className="space-y-2 mb-2">
                  {curActItems.map(item => (
                    <AddedRow key={item.id} item={item} onRemove={() => setCurItems(is => is.filter(x => x.id !== item.id))} />
                  ))}
                </div>
              )}
              <PlacesAutocomplete
                value={actName} onChange={setActName} type="activity"
                placeholder="e.g. Eiffel Tower, Temple tour…" className={inputCls}
              />
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Rate it</p>
                <StarRating value={actRating} onChange={setActRating} />
              </div>
              <input type="text" value={actNotes} onChange={e => setActNotes(e.target.value)}
                placeholder="📝 Notes (optional)" className={inputCls} />
              {actName.trim() && (
                <button type="button" onClick={addActivity}
                  className="w-full py-2 rounded-xl bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors flex items-center justify-center gap-2">
                  <Plus size={14} /> Add {curActItems.length > 0 ? 'another' : 'activity'}
                </button>
              )}
              <NavButtons
                onSkip={finishDest}
                onNext={finishDest}
                nextLabel="Done with this destination"
                skipLabel={curActItems.length > 0 ? 'Done with activities' : 'Skip'}
              />
            </div>
          </Card>
        )}

        {/* ── MORE card ───────────────────────────────────────────────────── */}
        {phase === 'more' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
            <p className="font-semibold text-gray-900 mb-1">
              {dests.length === 1 ? `${dests[0].name} added! 🎉` : `${dests.length} destinations added!`}
            </p>
            <p className="text-sm text-gray-500 mb-5">Going anywhere else, or ready to finish?</p>
            <div className="flex gap-3">
              <button type="button" onClick={startNewDest}
                className="flex-1 py-3 rounded-xl border-2 border-blue-200 text-blue-700 text-sm font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                <Plus size={15} /> Add destination
              </button>
              <button type="button" onClick={goToDetails}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                Finish <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── DETAILS card ─────────────────────────────────────────────────── */}
        {phase === 'details' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-5 py-4">
              <h2 className="font-bold text-white text-base">One last thing</h2>
              <p className="text-white/70 text-xs mt-0.5">Give your trip a name and dates</p>
            </div>
            <div className="p-5 space-y-4">
              {/* Post type */}
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

'use client'

import { useState } from 'react'
import { Check, Star, X } from 'lucide-react'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import RecommendationPicker from '@/components/RecommendationPicker'
import { getRecommendation, recommendationTags, type PlaceRecommendation } from '@/lib/placeRecommendation'

// The per-place edit form shared by the trip editor and the planner, so both offer the same fields.

export type PlaceType = 'hotel' | 'food_drink' | 'activity' | 'transport'
export type PlaceEditValues = {
  name: string
  mealType: string
  rating: number
  notes: string
  tags: string[]
  isHighlight: boolean
  alternative: string
  description: string
  link: string
  address: string
}

export const inputCls = 'w-full rounded-xl border border-line-soft px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-link focus:border-transparent bg-card'
export const subInputCls = 'w-full rounded-xl border border-line-soft px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-link bg-card'

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'drinks', 'coffee', 'dessert', 'bakery'] as const
export const MEAL_EMOJI: Record<string, string> = {
  breakfast: '🍳', lunch: '☀️', dinner: '🌙', drinks: '🍹', coffee: '☕', dessert: '🍰', bakery: '🥐',
}
export const MEAL_ACTIVE: Record<string, string> = Object.fromEntries(
  MEAL_TYPES.map(type => [type, 'bg-terracotta text-white border-terracotta'])
)

const FOOD_TAGS     = ['Worth the Hype', 'Great Food', 'Hidden Gem', 'Local Favorite', "Can't-Miss", 'Good for Groups', 'Family Friendly', 'Great Cocktails', 'Great Ambiance', 'Lively', 'Romantic', 'Casual', 'Outdoor Dining', 'Great Views']
const HOTEL_TAGS    = ['Great Service', 'Worth the Splurge', 'Great Value', 'Hidden Gem', 'Boutique', 'Luxury', 'Romantic', 'Family-Friendly', 'Great Location', 'Great Views', 'Amazing Spa']
const ACTIVITY_TAGS = ['Hidden Gem', 'Family Friendly', 'Great Views', 'Free', 'Outdoor', 'Cultural', 'Adventurous']
export const ITEM_TAGS: Record<PlaceType, string[]> = { food_drink: FOOD_TAGS, hotel: HOTEL_TAGS, activity: ACTIVITY_TAGS, transport: ['Flight', 'Ferry', 'Train', 'Bus', 'Car rental', 'Taxi / Uber', 'Transfer', 'Book Ahead', 'Great Value'] }

export function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button" onClick={() => onChange(value === s ? 0 : s)} className="focus:outline-none">
          <Star size={24} strokeWidth={1.6} className={s <= value ? 'fill-gold text-gold' : 'fill-none text-gold-faint'} />
        </button>
      ))}
    </div>
  )
}

// ── Item edit form ─────────────────────────────────────────────────────────────

export default function PlaceEditForm({ type, initial, onDraftChange, onSave, onClose, onRecommendationChange, onPlaceIdChange, city, busy = false, saveLabel = 'Save', showRating = true, children }: {
  type: PlaceType
  initial: PlaceEditValues
  onDraftChange?: (updated: Partial<PlaceEditValues>) => void
  onSave: (updated: PlaceEditValues) => void
  onClose: () => void
  onRecommendationChange?: (value: PlaceRecommendation) => void
  // Called with Google's place ID when a suggestion is picked, and with '' when the name is retyped.
  onPlaceIdChange?: (placeId: string) => void
  city?: string
  busy?: boolean
  saveLabel?: string
  // false where rating and Must do / Avoid have their own button (the planner's Change rating).
  showRating?: boolean
  // Extra fields (photos, day…) shown above the Save and Cancel buttons.
  children?: React.ReactNode
}) {
  const [original] = useState(initial)
  function useDraftField<K extends keyof PlaceEditValues>(key: K, value: PlaceEditValues[K]) {
    const [field, setField] = useState(value)
    function update(next: PlaceEditValues[K] | ((previous: PlaceEditValues[K]) => PlaceEditValues[K])) {
      const resolved = typeof next === 'function' ? (next as (previous: PlaceEditValues[K]) => PlaceEditValues[K])(field) : next
      setField(resolved)
      const patch = { [key]: resolved } as Partial<PlaceEditValues>
      if (key === 'tags') patch.tags = recommendationTags(resolved as string[], recommendation)
      onDraftChange?.(patch)
    }
    return [field, update] as const
  }
  const [name, setName]           = useDraftField('name', initial.name)
  const [mealType, setMealType]   = useDraftField('mealType', initial.mealType)
  const [rating, setRating]       = useDraftField('rating', initial.rating)
  const [notes, setNotes]         = useDraftField('notes', initial.notes)
  const [alternative, setAlternative] = useDraftField('alternative', initial.alternative)
  const [originalRecommendation] = useState(() => getRecommendation(initial.tags, initial.isHighlight))
  const [recommendation, setRecommendation] = useState(originalRecommendation)
  function changeRecommendation(value: PlaceRecommendation) { setRecommendation(value); onRecommendationChange?.(value) }
  function cancel() { onDraftChange?.(original); onRecommendationChange?.(originalRecommendation); onClose() }
  const [tags, setTags]           = useDraftField('tags', initial.tags)
  // No description box: Notes is the one place for the poster's own words. The description (written
  // automatically for places found on Google) is kept as is.
  const description = initial.description
  const [link, setLink]           = useDraftField('link', initial.link)
  const [address, setAddress]     = useDraftField('address', initial.address)
  const [showMore, setShowMore]   = useState(initial.tags.length > 0 || !!initial.link || !!initial.address)

  const cfg = {
    hotel:     { color: 'bg-mist border-mist-line',     label: 'Hotel / Airbnb', placeholder: 'Hotel, house, Airbnb…',           placeType: 'hotel' as const,      notesPh: 'e.g. Book early, ask for a room upgrade, free breakfast…' },
    food_drink:{ color: 'bg-[#f5ebe1] border-[#dec4b4]', label: 'Food & Drink',   placeholder: 'e.g. Ramen Ichiran, Rooftop bar…', placeType: 'restaurant' as const, notesPh: 'e.g. Order the truffle pasta, great for groups…'           },
    activity:  { color: 'bg-[#f3eddb] border-[#d9c99f]',   label: 'Activity',       placeholder: 'e.g. Eiffel Tower, Temple tour…',  placeType: 'activity' as const,   notesPh: 'e.g. Book tickets online, go early to beat the crowds…'   },
    transport: { color: 'bg-mist border-mist-line', label: 'Transportation', placeholder: 'e.g. Ferry to Nantucket, car rental, Uber tips…', placeType: 'activity' as const, notesPh: 'Flight or ferry details, routes, times, booking tips, car rentals, or taxi / Uber availability…' },
  }[type]

  function toggleTag(tag: string) {
    setTags(t => t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag])
  }

  function submit() {
    if (!name.trim()) return
    onSave({ name: name.trim(), mealType, rating, notes: notes.trim(), tags: recommendationTags(tags, recommendation), isHighlight: recommendation === 'must', alternative: alternative.trim(), description: description.trim(), link: link.trim(), address: address.trim() })
  }

  const moreCount = tags.length + (link ? 1 : 0) + (address ? 1 : 0)

  return (
    <div className={`rounded-xl border ${cfg.color} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">Edit {cfg.label}</p>
        <button type="button" onClick={cancel} className="text-muted hover:text-muted"><X size={16} /></button>
      </div>
      {type === 'transport' ? <input aria-label="Transport name" value={name} onChange={event => setName(event.target.value)} placeholder={cfg.placeholder} className={inputCls} /> : <PlacesAutocomplete value={name} onChange={value => { setName(value); onPlaceIdChange?.('') }} onSelect={(_main, _secondary, id) => onPlaceIdChange?.(id ?? '')} type={cfg.placeType}
        aria-label="Place name" placeholder={cfg.placeholder} className={inputCls} city={city} />}
      {type === 'food_drink' && (
        <div className="flex flex-wrap gap-1.5">
          {MEAL_TYPES.map(mt => {
            const sel = mealType.split(',').filter(Boolean)
            const isSel = sel.includes(mt)
            return (
              <button key={mt} type="button"
                onClick={() => setMealType(isSel ? sel.filter(t => t !== mt).join(',') : [...sel, mt].join(','))}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors capitalize ${isSel ? MEAL_ACTIVE[mt] : 'border-line-soft text-muted hover:border-gold-faint'}`}>
                {MEAL_EMOJI[mt]} {mt}
              </button>
            )
          })}
        </div>
      )}
      {showRating && <div className="space-y-1">
        <p className="text-xs text-muted">Rate it</p>
        <StarRating value={rating} onChange={setRating} />
      </div>}
      <div className="space-y-1">
        <p className="text-xs text-muted">Notes</p>
        <textarea aria-label="Notes" rows={4} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder={cfg.notesPh} className={inputCls} />
      </div>
      {/* Alternatives are places of their own ("Save as alternative"). An older typed suggestion stays
          visible here only so it can be cleared. */}
      {!!initial.alternative && <label className="block space-y-1">
        <span className="text-xs text-muted">Earlier suggestion (clear it to remove)</span>
        <input value={alternative} onChange={event => setAlternative(event.target.value)} className={`${inputCls} text-muted`} />
      </label>}
      {showRating ? <RecommendationPicker type={type} value={recommendation} onChange={changeRecommendation} />
        : <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={recommendation === 'option'} onChange={event => changeRecommendation(event.target.checked ? 'option' : 'none')} className="h-4 w-4 accent-link" />
          Save as alternative <span className="text-xs text-muted">(a backup you’re considering)</span>
        </label>}
      <button type="button" onClick={() => setShowMore(s => !s)}
        className="text-xs text-link hover:text-ink font-medium flex items-center gap-1 transition-colors">
        {showMore ? '▲ Hide details' : '▼ More details'}
        {moreCount > 0 && !showMore && (
          <span className="ml-1 bg-mist text-link rounded-full px-1.5 py-0.5 text-[10px] font-semibold">{moreCount}</span>
        )}
      </button>
      {showMore && (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-muted font-medium uppercase tracking-wide">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {ITEM_TAGS[type].map(tag => (
              <button key={tag} type="button" onClick={() => toggleTag(tag)}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${tags.includes(tag) ? 'bg-ink text-white border-ink' : 'border-line-soft text-muted hover:border-gold-faint'}`}>
                {tag}
              </button>
            ))}
          </div>
          {type === 'hotel' && (
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="📍 Address (for Airbnbs, apartments…)" className={subInputCls} />
          )}
          <input type="url" value={link} onChange={e => setLink(e.target.value)}
            placeholder="🔗 Website link (optional)" className={subInputCls} />
        </div>
      )}
      {children}
      <div className="flex gap-2">
        <button type="button" onClick={cancel} disabled={busy}
          className="flex-1 py-2.5 rounded-xl border-2 border-line-soft text-muted text-sm font-medium hover:border-line transition-colors">
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={!name.trim() || busy}
          className="flex-1 py-2.5 rounded-xl bg-ink text-white text-sm font-semibold hover:bg-ink-soft transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
          <Check size={14} /> {busy ? 'Saving…' : saveLabel}
        </button>
      </div>
    </div>
  )
}

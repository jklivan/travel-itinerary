'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import PlacesAutocomplete from '@/components/PlacesAutocomplete'
import RecommendationPicker from '@/components/RecommendationPicker'
import { getRecommendation, recommendationTags, type PlaceRecommendation } from '@/lib/placeRecommendation'
import { StarPicker as StarRating } from '@/components/ui/Stars'

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

export const inputCls = 'field'
export const subInputCls = 'field'

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

export { StarRating }

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
  const [tags]                    = useDraftField('tags', initial.tags)
  // No description box: Notes is the one place for the poster's own words. The description (written
  // automatically for places found on Google) is kept as is.
  const description = initial.description
  // No link box either: the website comes from Google; a link the place already has is kept.
  const link = initial.link
  const [address, setAddress]     = useDraftField('address', initial.address)

  const cfg = {
    hotel:     { color: 'bg-mist border-mist-line',     label: 'Accommodation', placeholder: 'Hotel, house, Airbnb…',           placeType: 'hotel' as const,      notesPh: 'e.g. Book early, ask for a room upgrade, free breakfast…' },
    food_drink:{ color: 'bg-chip border-line', label: 'Food & Drink',   placeholder: 'e.g. Ramen Ichiran, Rooftop bar…', placeType: 'restaurant' as const, notesPh: 'e.g. Order the truffle pasta, great for groups…'           },
    activity:  { color: 'bg-chip border-line',   label: 'Activity',       placeholder: 'e.g. Eiffel Tower, Temple tour…',  placeType: 'activity' as const,   notesPh: 'e.g. Book tickets online, go early to beat the crowds…'   },
    transport: { color: 'bg-mist border-mist-line', label: 'Transportation', placeholder: 'e.g. Ferry to Nantucket, car rental, Uber tips…', placeType: 'activity' as const, notesPh: 'Flight or ferry details, routes, times, booking tips, car rentals, or taxi / Uber availability…' },
  }[type]

  function submit() {
    if (!name.trim()) return
    onSave({ name: name.trim(), mealType, rating, notes: notes.trim(), tags: recommendationTags(tags, recommendation), isHighlight: recommendation === 'must', alternative: alternative.trim(), description: description.trim(), link: link.trim(), address: address.trim() })
  }

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
                aria-pressed={isSel} className="chip capitalize">
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
      {/* Places aren't tagged any more, and the website comes from Google; a hotel can still have its own address
          (Airbnbs, apartments). Tags and links a place already has are kept. */}
      {type === 'hotel' && (
        <input type="text" value={address} onChange={e => setAddress(e.target.value)}
          placeholder="📍 Address (for Airbnbs, apartments…)" className={subInputCls} />
      )}
      {children}
      <div className="flex gap-2">
        <button type="button" onClick={cancel} disabled={busy}
          className="flex-1 py-2.5 rounded-xl border-2 border-line-soft text-muted text-sm font-medium hover:border-line transition-colors">
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={!name.trim() || busy}
          className="btn btn-primary flex-1">
          <Check size={14} /> {busy ? 'Saving…' : saveLabel}
        </button>
      </div>
    </div>
  )
}

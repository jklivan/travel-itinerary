'use client'

import { useRef, useState, type ReactNode } from 'react'
import { X, Check } from 'lucide-react'
import PlacePeople from './PlacePeople'
import PlacesAutocomplete from './PlacesAutocomplete'
import EventPhotoInput from './EventPhotoInput'
import RecommendationPicker from './RecommendationPicker'
import { recommendationTags, type PlaceRecommendation } from '@/lib/placeRecommendation'
import { StarPicker as StarRating } from '@/components/ui/Stars'

type ItemType = 'hotel' | 'food_drink' | 'activity' | 'transport'
export type PlaceEntry = { type: ItemType; name: string; mealType: string; rating: number; notes: string; tags: string[]; photo: string; photos?: string[]; placeId: string }

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'drinks', 'coffee', 'dessert', 'bakery'] as const
export const MEAL_EMOJI: Record<string, string> = {
  breakfast: '🍳', lunch: '☀️', dinner: '🌙', drinks: '🍹', coffee: '☕', dessert: '🍰', bakery: '🥐',
}
export const inputCls = 'w-full rounded-xl border border-line px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-link focus:border-transparent bg-white'

const FOOD_TAGS  = ['Worth the Hype', 'Great Food', 'Hidden Gem', 'Local Favorite', "Can't-Miss", 'Good for Groups', 'Family Friendly', 'Great Cocktails', 'Great Ambiance', 'Lively', 'Romantic', 'Casual', 'Outdoor Dining', 'Great Views']
const HOTEL_TAGS = ['Great Service', 'Worth the Splurge', 'Great Value', 'Hidden Gem', 'Boutique', 'Luxury', 'Romantic', 'Family-Friendly', 'Great Location', 'Great Views', 'Amazing Spa']
const ACTIVITY_TAGS = ['Hidden Gem', 'Family Friendly', 'Great Views', 'Free', 'Outdoor', 'Cultural', 'Adventurous']

export const ITEM_TAGS: Record<ItemType, string[]> = { food_drink: FOOD_TAGS, hotel: HOTEL_TAGS, activity: ACTIVITY_TAGS, transport: ['Flight', 'Ferry', 'Train', 'Bus', 'Car rental', 'Taxi / Uber', 'Transfer', 'Book Ahead', 'Great Value'] }

export { StarRating }

export default function PlaceEntryForm({ type, onAdd, onClose, onPhotoBusyChange, city, children, planning = false }: {
  planning?: boolean
  type: ItemType
  onAdd: (item: PlaceEntry) => void | boolean | Promise<void | boolean>
  onClose: () => void
  onPhotoBusyChange: (busy: boolean) => void
  city?: string
  children?: ReactNode
}) {
  const saving = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [mealType, setMealType] = useState('')
  const [rating, setRating] = useState(0)
  const [notes, setNotes] = useState('')
  const [recommendation, setRecommendation] = useState<PlaceRecommendation>('none')
  const [tags, setTags] = useState<string[]>([])
  const [photos, setPhotos] = useState<string[]>([])
  const photo = photos[0] ?? ''
  const [placeId, setPlaceId] = useState('')
  const [placeContext, setPlaceContext] = useState('')
  const [placeLocation, setPlaceLocation] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [showMore, setShowMore] = useState(false)

  const cfg = {
    hotel:     { color: 'bg-mist border-mist-line',     label: 'Hotel / Airbnb', placeholder: 'Hotel, house, Airbnb…',           placeType: 'hotel' as const,      notesPh: 'e.g. Book early, ask for a room upgrade, free breakfast…' },
    food_drink:{ color: 'bg-cream border-line', label: 'Food & Drink',   placeholder: 'e.g. Ramen Ichiran, Rooftop bar…', placeType: 'restaurant' as const, notesPh: 'e.g. Order the truffle pasta, great for groups…'           },
    activity:  { color: 'bg-mist border-mist-line',   label: 'Activity',       placeholder: 'e.g. Eiffel Tower, Temple tour…',  placeType: 'activity' as const,   notesPh: 'e.g. Book tickets online, go early to beat the crowds…'   },
    transport: { color: 'bg-mist border-mist-line', label: 'Transportation', placeholder: 'e.g. Ferry to Nantucket, car rental, Uber tips…', placeType: 'activity' as const, notesPh: 'Flight or ferry details, routes, times, booking tips, car rentals, or taxi / Uber availability…' },
  }[type]

  function toggleTag(tag: string) {
    setTags(t => t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag])
  }

  async function submit() {
    if (!name.trim() || saving.current || photoUploading) return
    saving.current = true; setBusy(true); setError('')
    try {
      const result = await onAdd({ type, name: name.trim(), mealType, rating, notes: notes.trim(), tags: recommendationTags(tags, recommendation), photo, photos, placeId: placeContext === JSON.stringify([city, type]) ? placeId : '' })
      if (result === false) return
      setName(''); setMealType(''); setRating(0); setNotes(''); setTags([]); setRecommendation('none'); setPhotos([]); setPlaceId(''); setShowMore(false)
    } catch { setError('Could not save. Your details are still here; please try again.') }
    finally { saving.current = false; setBusy(false) }
  }

  return (
    <fieldset disabled={busy} className={`min-w-0 rounded-2xl border ${planning ? 'border-line bg-cream' : cfg.color} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">{cfg.label}</p>
        <button type="button" aria-label="Close place form" disabled={photoUploading || busy} onClick={onClose} className="text-muted hover:text-muted">
          <X size={16} />
        </button>
      </div>
      {type === 'transport' ? <input aria-label="Transport name" maxLength={240} value={name} onChange={event => setName(event.target.value)} placeholder={cfg.placeholder} className={planning ? `${inputCls} !border-line focus:!ring-link` : inputCls} /> : <PlacesAutocomplete value={name} onChange={v => { setName(v); setPlaceId('') }}
        onSelect={(_m, _s, pid) => { setPlaceId(pid ?? ''); setPlaceLocation(_s); setPlaceContext(JSON.stringify([city, type])) }}
        aria-label="Place name" maxLength={240} type={cfg.placeType} placeholder={cfg.placeholder} className={planning ? `${inputCls} !border-line focus:!ring-link` : inputCls} city={city} />}
      {type !== 'transport' && placeId && placeContext === JSON.stringify([city, type]) && <PlacePeople key={placeId} placeId={placeId} name={name} location={[city, placeLocation].filter(Boolean).join(', ')} />}
      {type === 'food_drink' && (
        <div className="flex flex-wrap gap-1.5">
          {MEAL_TYPES.map(mt => {
            const selected = mealType.split(',').filter(Boolean)
            const isSelected = selected.includes(mt)
            return (
              <button key={mt} type="button" onClick={() => setMealType(isSelected ? selected.filter(t => t !== mt).join(',') : [...selected, mt].join(','))}
                aria-pressed={isSelected} className="chip capitalize">
                {MEAL_EMOJI[mt]} {mt}
              </button>
            )
          })}
        </div>
      )}
      {!planning && <div className="flex items-center gap-3 flex-wrap">
        <div className="space-y-1">
          <p className="text-xs text-muted">Rate it</p>
          <StarRating value={rating} onChange={setRating} />
        </div>
      </div>}
      <div className="space-y-1">
        <p className="text-xs text-muted">Notes</p>
        <textarea aria-label="Notes" maxLength={8000} rows={4} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder={cfg.notesPh} className={planning ? `${inputCls} !border-line focus:!ring-link` : inputCls} />
      </div>
      {/* Planning: rating and Must do / Avoid are optional here too, for places you've already been. */}
      {planning && <>
        <div className="space-y-1">
          <p className="text-xs text-muted">Rating (optional)</p>
          <StarRating value={rating} onChange={setRating} />
        </div>
        <RecommendationPicker type={type} value={recommendation} onChange={setRecommendation} />
      </>}

      {/* More details toggle */}
      {!planning && <>
      <RecommendationPicker type={type} value={recommendation} onChange={setRecommendation} />
      <button type="button" onClick={() => setShowMore(s => !s)}
        className="text-xs text-link hover:text-ink font-medium flex items-center gap-1 transition-colors">
        {showMore ? '▲ Hide details' : '▼ More details'}
        {tags.length > 0 && !showMore && (
          <span className="ml-1 bg-mist-strong text-ink-soft rounded-full px-1.5 py-0.5 text-label font-semibold">{tags.length}</span>
        )}
      </button>

      {showMore && (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-muted font-medium uppercase tracking-wide">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {ITEM_TAGS[type].map(tag => (
              <button key={tag} type="button" aria-pressed={tags.includes(tag)} onClick={() => toggleTag(tag)}
                className="chip">
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      </>}
      {/* Photos, in both the planner and the trip forms. */}
      <div className="space-y-1">
        {planning && <p className="text-xs text-muted">Photos (optional)</p>}
        <EventPhotoInput photos={photos} name={name || 'new event'} onChange={setPhotos} onBusyChange={busy => { setPhotoUploading(busy); onPhotoBusyChange(busy) }} />
      </div>
      {children}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="button" onClick={() => void submit()} disabled={!name.trim() || photoUploading}
        className="btn btn-primary w-full">
        <Check size={14} /> {busy ? 'Saving…' : planning ? 'Save Place' : 'Add'}
      </button>
    </fieldset>
  )
}


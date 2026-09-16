'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Star, X, Check } from 'lucide-react'
import PlacePeople from './PlacePeople'
import PlacesAutocomplete from './PlacesAutocomplete'
import EventPhotoInput from './EventPhotoInput'
import RecommendationPicker from './RecommendationPicker'
import { recommendationTags, type PlaceRecommendation } from '@/lib/placeRecommendation'

type ItemType = 'hotel' | 'food_drink' | 'activity'
export type PlaceEntry = { type: ItemType; name: string; mealType: string; rating: number; notes: string; tags: string[]; photo: string; photos?: string[]; placeId: string }

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'drinks', 'coffee', 'dessert', 'bakery'] as const
export const MEAL_EMOJI: Record<string, string> = {
  breakfast: '🍳', lunch: '☀️', dinner: '🌙', drinks: '🍹', coffee: '☕', dessert: '🍰', bakery: '🥐',
}
export const MEAL_ACTIVE: Record<string, string> = {
  breakfast: 'bg-yellow-500 text-white border-yellow-500',
  lunch:     'bg-orange-500 text-white border-orange-500',
  dinner:    'bg-purple-600 text-white border-purple-600',
  drinks:    'bg-blue-500 text-white border-blue-500',
  coffee:    'bg-amber-700 text-white border-amber-700',
  dessert:   'bg-pink-500 text-white border-pink-500',
  bakery:    'bg-orange-400 text-white border-orange-400',
}

export const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white'

const FOOD_TAGS  = ['Worth the Hype', 'Great Food', 'Hidden Gem', 'Local Favorite', "Can't-Miss", 'Good for Groups', 'Family Friendly', 'Great Cocktails', 'Great Ambiance', 'Lively', 'Romantic', 'Casual', 'Outdoor Dining', 'Great Views']
const HOTEL_TAGS = ['Great Service', 'Worth the Splurge', 'Great Value', 'Hidden Gem', 'Boutique', 'Luxury', 'Romantic', 'Family-Friendly', 'Great Location', 'Great Views', 'Amazing Spa']
const ACTIVITY_TAGS = ['Hidden Gem', 'Family Friendly', 'Great Views', 'Free', 'Outdoor', 'Cultural', 'Adventurous']

export const ITEM_TAGS: Record<ItemType, string[]> = { food_drink: FOOD_TAGS, hotel: HOTEL_TAGS, activity: ACTIVITY_TAGS }

export function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button" aria-label={`Rate ${s} out of 5`} aria-pressed={value === s} onClick={() => onChange(value === s ? 0 : s)} className="focus:outline-none">
          <Star size={22} className={s <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
        </button>
      ))}
    </div>
  )
}

export default function PlaceEntryForm({ type, onAdd, onClose, onPhotoBusyChange, city, children }: {
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
    hotel:     { color: 'bg-blue-50 border-blue-200',     label: 'Hotel / Airbnb', placeholder: 'Hotel, house, Airbnb…',           placeType: 'hotel' as const,      notesPh: 'e.g. Book early, ask for a room upgrade, free breakfast…' },
    food_drink:{ color: 'bg-orange-50 border-orange-200', label: 'Food & Drink',   placeholder: 'e.g. Ramen Ichiran, Rooftop bar…', placeType: 'restaurant' as const, notesPh: 'e.g. Order the truffle pasta, great for groups…'           },
    activity:  { color: 'bg-green-50 border-green-200',   label: 'Activity',       placeholder: 'e.g. Eiffel Tower, Temple tour…',  placeType: 'activity' as const,   notesPh: 'e.g. Book tickets online, go early to beat the crowds…'   },
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
    <fieldset disabled={busy} className={`min-w-0 rounded-2xl border ${cfg.color} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{cfg.label}</p>
        <button type="button" aria-label="Close place form" disabled={photoUploading || busy} onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>
      <PlacesAutocomplete value={name} onChange={v => { setName(v); setPlaceId('') }}
        onSelect={(_m, _s, pid) => { setPlaceId(pid ?? ''); setPlaceLocation(_s); setPlaceContext(JSON.stringify([city, type])) }}
        aria-label="Place name" maxLength={240} type={cfg.placeType} placeholder={cfg.placeholder} className={inputCls} city={city} />
      {placeId && placeContext === JSON.stringify([city, type]) && <PlacePeople key={placeId} placeId={placeId} name={name} location={[city, placeLocation].filter(Boolean).join(', ')} />}
      {type === 'food_drink' && (
        <div className="flex flex-wrap gap-1.5">
          {MEAL_TYPES.map(mt => {
            const selected = mealType.split(',').filter(Boolean)
            const isSelected = selected.includes(mt)
            return (
              <button key={mt} type="button" onClick={() => setMealType(isSelected ? selected.filter(t => t !== mt).join(',') : [...selected, mt].join(','))}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors capitalize ${isSelected ? MEAL_ACTIVE[mt] : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                {MEAL_EMOJI[mt]} {mt}
              </button>
            )
          })}
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Rate it</p>
          <StarRating value={rating} onChange={setRating} />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-gray-500">Notes</p>
        <textarea aria-label="Notes" maxLength={8000} rows={4} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder={cfg.notesPh} className={inputCls} />
      </div>

      {/* More details toggle */}
      <RecommendationPicker type={type} value={recommendation} onChange={setRecommendation} />
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

      <EventPhotoInput photos={photos} name={name || 'new event'} onChange={setPhotos} onBusyChange={busy => { setPhotoUploading(busy); onPhotoBusyChange(busy) }} />
      {children}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="button" onClick={() => void submit()} disabled={!name.trim() || photoUploading}
        className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
        <Check size={14} /> {busy ? 'Saving…' : 'Add'}
      </button>
    </fieldset>
  )
}


'use client'

import { Ban, BedDouble, Star, Bookmark } from 'lucide-react'
import type { PlaceRecommendation } from '@/lib/placeRecommendation'

export default function RecommendationPicker({ type, value, onChange, allowAlternative = true }: {
  type: 'hotel' | 'food_drink' | 'activity' | 'transport'
  value: PlaceRecommendation
  onChange: (value: PlaceRecommendation) => void
  allowAlternative?: boolean
}) {
  const label = type === 'hotel' ? 'Must stay' : type === 'transport' ? 'Recommended' : 'Must do'
  const Icon = type === 'hotel' ? BedDouble : Star
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium text-gray-600">Place status</legend>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={value === 'must'} onClick={() => onChange(value === 'must' ? 'none' : 'must')}
          className="chip"><Icon size={15} />{label}</button>
        <button type="button" aria-pressed={value === 'avoid'} onClick={() => onChange(value === 'avoid' ? 'none' : 'avoid')}
          className="chip aria-pressed:border-danger aria-pressed:bg-danger"><Ban size={15} />Avoid</button>
        {allowAlternative && <button type="button" aria-pressed={value === 'option'} onClick={() => onChange(value === 'option' ? 'none' : 'option')}
          className="chip"><Bookmark size={15} />Save as alternative</button>}
      </div>
      {allowAlternative && <p className="text-[11px] text-gray-500">Save as alternative keeps a place you’re considering as an alternative. Select again to remove the label.</p>}
    </fieldset>
  )
}

'use client'

import { Ban, BedDouble, Star, Bookmark } from 'lucide-react'
import type { PlaceRecommendation } from '@/lib/placeRecommendation'

export default function RecommendationPicker({ type, value, onChange }: {
  type: 'hotel' | 'food_drink' | 'activity'
  value: PlaceRecommendation
  onChange: (value: PlaceRecommendation) => void
}) {
  const label = type === 'hotel' ? 'Must stay' : 'Must do'
  const Icon = type === 'hotel' ? BedDouble : Star
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium text-gray-600">Place status</legend>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={value === 'must'} onClick={() => onChange(value === 'must' ? 'none' : 'must')}
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${value === 'must' ? 'border-[#507c76] bg-[#507c76] text-white' : 'border-gray-300 text-gray-600 hover:border-[#507c76]'}`}><Icon size={15} />{label}</button>
        <button type="button" aria-pressed={value === 'avoid'} onClick={() => onChange(value === 'avoid' ? 'none' : 'avoid')}
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${value === 'avoid' ? 'border-red-700 bg-red-700 text-white' : 'border-gray-300 text-gray-600 hover:border-red-700'}`}><Ban size={15} />Avoid</button>
        <button type="button" aria-pressed={value === 'option'} onClick={() => onChange(value === 'option' ? 'none' : 'option')}
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${value === 'option' ? 'border-[#507c76] bg-[#507c76] text-white' : 'border-gray-300 text-gray-600 hover:border-[#507c76]'}`}><Bookmark size={15} />Save as alternative</button>
      </div>
      <p className="text-[11px] text-gray-500">Save as alternative keeps a place you’re considering as an alternative. Select again to remove the label.</p>
    </fieldset>
  )
}

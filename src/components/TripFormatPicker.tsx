'use client'

import PolaroidTile from '@/components/ui/PolaroidTile'

export type TripFormat = 'guide' | 'day-trip' | 'itinerary'

// The same polaroid option tiles as the plan page's choices (ui/PolaroidTile).
const PHOTOS: Record<TripFormat, string> = {
  guide: 'photo-1499793983690-e29da59ef1c2',
  'day-trip': 'photo-1449965408869-eaa3f722e40d',
  itinerary: 'photo-1436491865332-7a61a109cc05',
}

export default function TripFormatPicker({ value, onChange, variant = 'compact' }: { value: TripFormat; onChange: (value: TripFormat) => void; variant?: 'compact' | 'polaroid' }) {
  const options = [['guide', 'Guide', 'Places & ideas'], ['day-trip', 'Day trip', 'A short getaway'], ['itinerary', 'Multi-day trip', 'A longer journey']] as const
  if (variant === 'polaroid') return <fieldset>
    <legend className="field-label mb-3">What are you sharing?</legend>
    <div className="grid grid-cols-3 gap-3 py-1">
      {options.map(([format, label], index) => <button key={format} type="button" aria-pressed={value === format} onClick={() => onChange(format)} className="min-w-0">
        <PolaroidTile photo={`https://images.unsplash.com/${PHOTOS[format]}?auto=format&fit=crop&w=360&q=80`} label={label} selected={value === format} index={index} />
      </button>)}
    </div>
    <p className="mt-2 text-xs text-muted">{value === 'guide' ? 'Recommendations without a set duration or daily schedule.' : value === 'day-trip' ? 'A one-day outing.' : 'A trip with a duration or a day-by-day itinerary.'}</p>
  </fieldset>
  return <fieldset className="space-y-2">
    <legend className="text-[10px] font-semibold uppercase tracking-[0.18em] text-link">What are you sharing?</legend>
    <div className="grid grid-cols-3 gap-2">
      {([['guide', 'Guide', 'Places & ideas', '0% 0%'], ['day-trip', 'Day trip', 'A short getaway', '100% 0%'], ['itinerary', 'Multi-day trip', 'A longer journey', '0% 100%']] as const).map(([format, label, hint, position]) =>
        <button key={format} type="button" aria-pressed={value === format} onClick={() => onChange(format)} className={`overflow-hidden rounded-xl border bg-card text-left shadow-sm ${value === format ? 'border-link ring-2 ring-link/20' : 'border-line-soft'}`}>
          <span className="block aspect-[1.25] bg-cover" style={{ backgroundImage: "url('/explore-photos.webp')", backgroundPosition: position }} />
          <span className="block px-2 pb-2 pt-1.5"><span className="block truncate text-[11px] font-[family-name:var(--font-playfair)] text-ink">{label}</span><span className="mt-0.5 block truncate text-[8px] uppercase tracking-wide text-muted">{hint}</span></span>
        </button>
      )}
    </div>
    <p className="text-xs text-gray-500">{value === 'guide' ? 'Recommendations without a set duration or daily schedule.' : value === 'day-trip' ? 'A one-day outing.' : 'A trip with a duration or a day-by-day itinerary.'}</p>
  </fieldset>
}

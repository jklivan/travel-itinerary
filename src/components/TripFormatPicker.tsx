'use client'

export type TripFormat = 'guide' | 'day-trip' | 'itinerary'

// Polaroid cards match the plan page's "What are you planning?" picker.
const POLAROIDS: Record<TripFormat, { photo: string; tilt: string }> = {
  guide: { photo: 'photo-1499793983690-e29da59ef1c2', tilt: 'rotate-[-4deg]' },
  'day-trip': { photo: 'photo-1449965408869-eaa3f722e40d', tilt: 'rotate-[-2deg]' },
  itinerary: { photo: 'photo-1436491865332-7a61a109cc05', tilt: 'rotate-[4deg]' },
}

export default function TripFormatPicker({ value, onChange, variant = 'compact' }: { value: TripFormat; onChange: (value: TripFormat) => void; variant?: 'compact' | 'polaroid' }) {
  const options = [['guide', 'Guide', 'Places & ideas'], ['day-trip', 'Day trip', 'A short getaway'], ['itinerary', 'Multi-day trip', 'A longer journey']] as const
  if (variant === 'polaroid') return <fieldset>
    <legend className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2e4147]">What are you sharing?</legend>
    <div className="grid grid-cols-3 gap-3 py-2">
      {options.map(([format, label, hint]) => <button key={format} type="button" aria-pressed={value === format} onClick={() => onChange(format)} className={`${POLAROIDS[format].tilt} min-w-0 rounded-lg border bg-[#fffdf7] p-1.5 pb-3 shadow-md sm:p-2 ${value === format ? 'border-[#59694f] ring-2 ring-[#59694f]/20' : 'border-[#e1d8c9]'}`}>
        <span className="block aspect-[3/4] rounded bg-cover bg-center" style={{ backgroundImage: `url(https://images.unsplash.com/${POLAROIDS[format].photo}?auto=format&fit=crop&w=480&q=85)` }} />
        <span className="mt-2 block text-[10px] font-semibold uppercase leading-tight tracking-wide text-[#2e4147] sm:text-sm">{label}</span>
        <span className="mt-1 block text-[7px] uppercase tracking-wide text-[#59694f] sm:text-[9px]">{hint}</span>
      </button>)}
    </div>
    <p className="mt-2 text-xs text-[#73786d]">{value === 'guide' ? 'Recommendations without a set duration or daily schedule.' : value === 'day-trip' ? 'A one-day outing.' : 'A trip with a duration or a day-by-day itinerary.'}</p>
  </fieldset>
  return <fieldset className="space-y-2">
    <legend className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#59694f]">What are you sharing?</legend>
    <div className="grid grid-cols-3 gap-2">
      {([['guide', 'Guide', 'Places & ideas', '0% 0%'], ['day-trip', 'Day trip', 'A short getaway', '100% 0%'], ['itinerary', 'Multi-day trip', 'A longer journey', '0% 100%']] as const).map(([format, label, hint, position]) =>
        <button key={format} type="button" aria-pressed={value === format} onClick={() => onChange(format)} className={`overflow-hidden rounded-xl border bg-[#fffdf7] text-left shadow-sm ${value === format ? 'border-[#59694f] ring-2 ring-[#59694f]/20' : 'border-[#e0d7c8]'}`}>
          <span className="block aspect-[1.25] bg-cover" style={{ backgroundImage: "url('/explore-photos.webp')", backgroundPosition: position }} />
          <span className="block px-2 pb-2 pt-1.5"><span className="block truncate text-[11px] font-[family-name:var(--font-playfair)] text-[#2e4147]">{label}</span><span className="mt-0.5 block truncate text-[8px] uppercase tracking-wide text-[#73786d]">{hint}</span></span>
        </button>
      )}
    </div>
    <p className="text-xs text-gray-500">{value === 'guide' ? 'Recommendations without a set duration or daily schedule.' : value === 'day-trip' ? 'A one-day outing.' : 'A trip with a duration or a day-by-day itinerary.'}</p>
  </fieldset>
}

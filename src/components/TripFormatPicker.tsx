'use client'

export type TripFormat = 'guide' | 'day-trip' | 'itinerary'

export default function TripFormatPicker({ value, onChange }: { value: TripFormat; onChange: (value: TripFormat) => void }) {
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

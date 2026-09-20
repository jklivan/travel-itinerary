'use client'

export type TripFormat = 'guide' | 'day-trip' | 'itinerary'

export default function TripFormatPicker({ value, onChange, heading = 'What are you sharing?' }: { value: TripFormat; onChange: (value: TripFormat) => void; heading?: string }) {
  return <fieldset className="space-y-2">
    <legend className="text-sm font-medium">{heading}</legend>
    <div className="flex flex-wrap gap-2">
      {([['guide', 'Guide'], ['day-trip', 'Day trip'], ['itinerary', 'Multi-day trip']] as const).map(([format, label]) =>
        <button key={format} type="button" aria-pressed={value === format} onClick={() => onChange(format)} className={`rounded-xl border px-4 py-3 text-sm font-medium ${value === format ? 'border-[#242e25] bg-[#242e25] text-white' : 'border-[#d7cebc] bg-white text-[#242e25]'}`}>{label}</button>
      )}
    </div>
    <p className="text-xs text-gray-500">{value === 'guide' ? 'Recommendations without a set duration or daily schedule.' : value === 'day-trip' ? 'A one-day outing.' : 'A trip with a duration or a day-by-day itinerary.'}</p>
  </fieldset>
}

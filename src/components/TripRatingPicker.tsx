'use client'

import { TRIP_STAMPS } from '@/lib/tripStamps'
export { TRIP_STAMPS } from '@/lib/tripStamps'

export function TripRatingPicker({
  value,
  onChange,
}: {
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <div className="flex gap-2">
      {TRIP_STAMPS.map((stamp) => {
        const filled = value !== null && stamp.value <= value
        return (
          <div key={stamp.value} className="flex-1">
            <button
              type="button"
              onClick={() => onChange(value === stamp.value ? null : stamp.value)}
              title={stamp.label}
              className={`w-full py-3 px-1 rounded-md border-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-150 select-none ${
                filled
                  ? `${stamp.bg} border-transparent text-white -rotate-2 shadow-md`
                  : `bg-white ${stamp.border} ${stamp.text} border-dashed hover:scale-105`
              }`}
            >
              <span className="text-sm font-black leading-none">{stamp.value}</span>
              <span className="text-[8px] font-bold uppercase tracking-wide leading-tight text-center whitespace-nowrap overflow-hidden w-full px-0.5" style={{ textOverflow: 'clip' }}>
                {stamp.label}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

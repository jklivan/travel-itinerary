'use client'

export const TRIP_STAMPS = [
  { value: 1, label: 'Hard pass',  bg: 'bg-slate-500',   border: 'border-slate-300'   },
  { value: 2, label: 'Meh',        bg: 'bg-amber-400',   border: 'border-amber-300'   },
  { value: 3, label: 'It was fun', bg: 'bg-emerald-500', border: 'border-emerald-300' },
  { value: 4, label: 'Loved it',   bg: 'bg-blue-500',    border: 'border-blue-300'    },
  { value: 5, label: 'Must go!',   bg: 'bg-rose-500',    border: 'border-rose-300'    },
]

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
              className={`w-full aspect-square rounded-full border-2 flex items-center justify-center transition-all duration-150 select-none text-xs font-bold ${
                filled
                  ? `${stamp.bg} border-transparent text-white shadow-sm`
                  : `bg-white ${stamp.border} border-dashed text-gray-300 hover:border-gray-400`
              }`}
            >
              {stamp.value}
            </button>
          </div>
        )
      })}
    </div>
  )
}

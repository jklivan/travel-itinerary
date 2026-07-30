'use client'

export const TRIP_STAMPS = [
  { value: 1, label: 'Hard pass', line1: 'Hard',   line2: 'Pass',  bg: 'bg-slate-500',   border: 'border-slate-400',   text: 'text-slate-500'   },
  { value: 2, label: 'Meh',       line1: 'Meh',    line2: '',      bg: 'bg-amber-400',   border: 'border-amber-400',   text: 'text-amber-500'   },
  { value: 3, label: 'It was fun',line1: 'It Was', line2: 'Fun!',  bg: 'bg-emerald-500', border: 'border-emerald-400', text: 'text-emerald-600' },
  { value: 4, label: 'Highly rec',line1: 'Highly', line2: 'Rec\'d',bg: 'bg-blue-500',    border: 'border-blue-400',    text: 'text-blue-600'    },
  { value: 5, label: 'Must go!',  line1: 'Must',   line2: 'Go!',   bg: 'bg-rose-500',    border: 'border-rose-400',    text: 'text-rose-600'    },
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
        const selected = value === stamp.value
        return (
          <div key={stamp.value} className="flex-1">
            <button
              type="button"
              onClick={() => onChange(selected ? null : stamp.value)}
              title={stamp.label}
              className={`w-full aspect-square rounded-full border-2 border-dashed flex flex-col items-center justify-center transition-all duration-150 select-none ${
                selected
                  ? `${stamp.bg} border-transparent text-white -rotate-6 shadow-md`
                  : `bg-white ${stamp.border} ${stamp.text} hover:scale-105`
              }`}
            >
              <span className="text-[11px] font-bold leading-tight">{stamp.line1}</span>
              {stamp.line2 && (
                <span className="text-[11px] font-bold leading-tight">{stamp.line2}</span>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}

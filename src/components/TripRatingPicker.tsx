'use client'

export const TRIP_STAMPS = [
  { value: 1, label: 'Hard pass', bg: 'bg-slate-500',   border: 'border-slate-300',   text: 'text-slate-400'   },
  { value: 2, label: 'Meh',       bg: 'bg-amber-400',   border: 'border-amber-300',   text: 'text-amber-400'   },
  { value: 3, label: 'It was fun',bg: 'bg-emerald-500', border: 'border-emerald-300', text: 'text-emerald-400' },
  { value: 4, label: 'Loved it',  bg: 'bg-blue-500',    border: 'border-blue-300',    text: 'text-blue-400'    },
  { value: 5, label: 'Must go!',  bg: 'bg-rose-500',    border: 'border-rose-300',    text: 'text-rose-400'    },
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

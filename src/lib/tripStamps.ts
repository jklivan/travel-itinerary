export const TRIP_STAMPS = [
  { value: 1, label: 'Hard pass', bg: 'bg-slate-500',   border: 'border-slate-300',   text: 'text-slate-400'   },
  { value: 2, label: 'Meh',       bg: 'bg-amber-400',   border: 'border-amber-300',   text: 'text-amber-400'   },
  { value: 3, label: 'It was fun',bg: 'bg-emerald-500', border: 'border-emerald-300', text: 'text-emerald-400' },
  { value: 4, label: 'Loved it',  bg: 'bg-blue-500',    border: 'border-blue-300',    text: 'text-blue-400'    },
  { value: 5, label: 'Must go!',  bg: 'bg-rose-500',    border: 'border-rose-300',    text: 'text-rose-400'    },
]

// Muted postage-stamp colours for the author's verdict (1 Hard pass … 5 Must go!).
export const STAMP_COLORS: Record<number, string> = { 1: '#8c7b72', 2: '#b3955f', 3: '#8e9b6c', 4: '#4d6a8c', 5: '#6f8b6e' }

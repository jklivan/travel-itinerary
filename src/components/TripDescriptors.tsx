import type { ReactNode } from 'react'
import { Star, Users } from 'lucide-react'
import TagChip, { TAG_PILL } from '@/components/ui/TagChip'
import { TRIP_STAMPS, STAMP_COLORS } from '@/lib/tripStamps'
import { tripLocationLabel } from '@/lib/tripLocation'

const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const AUDIENCE: Record<string, string> = { family: 'Family', friends: 'Friends', romantic: 'Couples', adult: 'Adults' }

type Trip = { destinations: { name: string; country?: string | null; items?: readonly { type: string }[] }[]; tripRating?: number | null; budget?: number | null; audience?: string | null; tags?: string[]; bestMonths?: string[] }

// Under a trip's title: where it is, then its verdict, budget, who it's for and travel-style tags, then the months to
// go. The same on the trip page and in the planner, so editing a posted trip still shows what it's posted with.
// `leading`: pills that go first (Like and Save on someone else's trip).
export default function TripDescriptors({ trip, leading }: { trip: Trip; leading?: ReactNode }) {
  const location = tripLocationLabel(trip.destinations)
  const stamp = trip.tripRating ? TRIP_STAMPS.find(s => s.value === trip.tripRating) : null
  const audience = trip.audience ? AUDIENCE[trip.audience] : undefined
  const budget = trip.budget ?? 0
  const months = [...(trip.bestMonths ?? [])].sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b))
  return <>
    {location && <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brown">{location}</p>}
    <div aria-label="Trip tags" className="flex flex-wrap gap-2 items-center mb-4">
      {leading}
      {/* One chip style for everything here; the verdict uses its stamp colour, as on the trip cards. */}
      {stamp && <span className={`${TAG_PILL} text-white`} style={{ backgroundColor: STAMP_COLORS[stamp.value] }}><Star size={14} strokeWidth={1.5} fill="currentColor" aria-hidden="true" />{stamp.label}</span>}
      {budget > 0 && <span aria-label={`Budget ${budget} out of 5`} className={`${TAG_PILL} gap-1 bg-chip`}>{[1, 2, 3, 4, 5].map(n => <span key={n} className={n <= budget ? 'text-ink' : 'text-gold-faint'}>$</span>)}</span>}
      {audience && <span className={`${TAG_PILL} bg-chip text-ink`}><Users size={16} strokeWidth={1.5} aria-hidden="true" />{audience}</span>}
      {(trip.tags ?? []).map(tag => <TagChip key={tag} id={tag} />)}
    </div>
    {/* When to go: on its own line, in calendar order, in the same beige as Family. */}
    {months.length > 0 && <div aria-label="When to go" className="-mt-2 mb-4 flex flex-wrap items-center gap-2">
      {months.map(m => <span key={m} className={`${TAG_PILL} bg-chip text-ink`}>{m}</span>)}
    </div>}
  </>
}

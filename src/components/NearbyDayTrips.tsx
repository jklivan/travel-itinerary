'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { LocateFixed, MapPin } from 'lucide-react'
import { distanceMiles, type Coordinates } from '@/lib/distance'

type Entry = { id: string; locations: Coordinates[]; card: ReactNode }
type Position = Coordinates
const RADIUS_MILES = 50

export default function NearbyDayTrips({ entries }: { entries: Entry[] }) {
  const [position, setPosition] = useState<Position | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const nearby = useMemo(() => entries.map(entry => ({
    ...entry,
    miles: position && entry.locations.length
      ? Math.min(...entry.locations.map(location => distanceMiles(position, location)))
      : null,
  })).filter(entry => position ? entry.miles !== null && entry.miles <= RADIUS_MILES : true)
    .sort((a, b) => position ? (a.miles ?? Infinity) - (b.miles ?? Infinity) : 0), [entries, position])

  function useLocation() {
    setError('')
    if (!navigator.geolocation) {
      setError('Location is unavailable in this browser. You can still browse all day trips.')
      return
    }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      result => {
        setPosition({ lat: result.coords.latitude, lng: result.coords.longitude })
        setLoading(false)
      },
      result => {
        setError(result.code === result.PERMISSION_DENIED
          ? 'Location permission was declined. You can still browse all day trips.'
          : 'Could not get your location. Please try again or browse all day trips.')
        setLoading(false)
      },
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 10000 },
    )
  }

  return <section aria-label="Nearby day trips">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dfd3c2] bg-[#faf7f1] p-4">
      <div className="flex items-start gap-3">
        <MapPin size={19} className="mt-0.5 shrink-0 text-[#59694f]" />
        <div>
          <p className="text-sm font-semibold text-[#242e25]">Find day trips near you</p>
          <p className="mt-1 text-xs text-[#8B6F4E]">Use your location once to find trips within 50 miles by straight-line distance. It isn’t shared or saved.</p>
        </div>
      </div>
      {position
        ? <button type="button" onClick={() => setPosition(null)} className="min-h-10 rounded-full border border-[#cbbda8] px-4 text-sm font-medium text-[#485340]">Show all trips</button>
        : <button type="button" onClick={useLocation} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#355650] px-4 text-sm font-semibold text-white disabled:opacity-60"><LocateFixed size={16} />{loading ? 'Finding you…' : 'Near me'}</button>}
    </div>
    {error && <p role="status" className="mb-4 text-sm text-[#8B6F4E]">{error}</p>}
    {position && nearby.length === 0 && <p role="status" className="rounded-xl border border-dashed border-[#dfd3c2] p-6 text-center text-sm text-[#73786d]">No day trips within 50 miles yet. Try all trips to explore farther away.</p>}
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 sm:gap-5">
      {nearby.map(entry => <div key={entry.id}>
        {entry.miles !== null && <p className="mb-1 px-1 text-xs font-medium text-[#59694f]">{Math.round(entry.miles)} miles from you</p>}
        {entry.card}
      </div>)}
    </div>
  </section>
}

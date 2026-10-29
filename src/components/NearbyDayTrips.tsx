'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LocateFixed } from 'lucide-react'
import { distanceMiles, type Coordinates } from '@/lib/distance'
import SearchField from './ui/SearchField'

type Entry = { id: string; locations: Coordinates[]; card: ReactNode }
type Position = Coordinates
const RADIUS_MILES = 50
// US states by their two-letter code, so "New Milford, CT" finds Connecticut's New Milford.
const STATES: Record<string, string> = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' }

// Trips near you, or near a town you type, within 50 miles. Explore's Local trips (every trip, any length: nothing
// shows until a place is chosen) and the Day trip tag (its trips, all listed until then).
export default function NearbyDayTrips({ entries, local = false }: { entries: Entry[]; local?: boolean }) {
  const [position, setPosition] = useState<Position | null>(null)
  // A town typed instead of the phone's location (works with location off, or when the app can't get it).
  const [town, setTown] = useState('')
  const [around, setAround] = useState<string | null>(null)
  const [finding, setFinding] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // After a failed location request the full list would look like "near me" results (e.g. Italy),
  // so it stays hidden until the viewer chooses to browse everything.
  const [browseAll, setBrowseAll] = useState(false)
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const nearby = useMemo(() => entries.map(entry => ({
    ...entry,
    miles: position && entry.locations.length
      ? Math.min(...entry.locations.map(location => distanceMiles(position, location)))
      : null,
  })).filter(entry => position ? entry.miles !== null && entry.miles <= RADIUS_MILES : true)
    .sort((a, b) => position ? (a.miles ?? Infinity) - (b.miles ?? Infinity) : 0), [entries, position])

  async function findTown(event: React.FormEvent) {
    event.preventDefault()
    const name = town.trim()
    if (!name || finding) return
    setFinding(true); setError(''); setBrowseAll(false)
    try {
      // "New Milford, CT": the town, then the state or country after the comma picks between towns of that name.
      const [townName, ...rest] = name.split(',').map(part => part.trim())
      const hint = rest.join(' ').toLowerCase(), state = STATES[hint.toUpperCase()]?.toLowerCase()
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=10&language=en&name=${encodeURIComponent(townName)}`)
      const results = ((await response.json()) as { results?: { name: string; admin1?: string; country?: string; country_code?: string; latitude: number; longitude: number }[] }).results ?? []
      const matches = (result: typeof results[number]) => [result.admin1, result.country, result.country_code].some(part => part && (part.toLowerCase() === state || part.toLowerCase() === hint || (hint.length > 2 && part.toLowerCase().startsWith(hint))))
      const place = (hint && results.find(matches)) || results[0]
      if (!place) { setError(`We couldn’t find “${name}”. Try a nearby town or city.`); return }
      setPosition({ lat: place.latitude, lng: place.longitude }); setAround([place.name, place.admin1].filter(Boolean).join(', '))
    } catch { setError('We couldn’t look that place up. Please try again.') }
    finally { setFinding(false) }
  }

  function useLocation() {
    setError(''); setBrowseAll(false); setAround(null)
    if (!navigator.geolocation) {
      setError(`Location is unavailable in this browser. Type a town instead, or browse all ${local ? 'trips' : 'day trips'}.`)
      return
    }
    setLoading(true)
    clearTimeout(safetyTimer.current)
    // The timeout option only starts after permission is granted, so a permission
    // prompt that never appears (e.g. in WKWebView) would hang forever. This
    // safety timer covers the entire request including the permission phase.
    safetyTimer.current = setTimeout(() => {
      setLoading(false)
      setError('We couldn’t get your location in time. Check that location access is allowed for Postcard, then tap Near me again, or type a town above.')
    }, 8000)
    try {
      navigator.geolocation.getCurrentPosition(
        result => {
          clearTimeout(safetyTimer.current)
          setPosition({ lat: result.coords.latitude, lng: result.coords.longitude })
          setLoading(false)
        },
        result => {
          clearTimeout(safetyTimer.current)
          setError(result.code === result.PERMISSION_DENIED
            ? 'Location is turned off for Postcard, so we can’t tell which trips are near you. On iPhone: Settings → Postcard (or Safari) → Location → While Using, then tap Near me again, or type a town above.'
            : 'We couldn’t get your location. Check that Location Services is on, then tap Near me again, or type a town above.')
          setLoading(false)
        },
        { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 6000 },
      )
    } catch {
      clearTimeout(safetyTimer.current)
      setLoading(false)
      setError('We couldn’t access your location. Check that location access is allowed for Postcard, then tap Near me again, or type a town above.')
    }
  }

  useEffect(() => () => clearTimeout(safetyTimer.current), [])

  return <section aria-label={local ? 'Nearby trips' : 'Nearby day trips'}>
    <div className="panel mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex items-start gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{local ? 'Find trips near you' : 'Find day trips near you'}</p>
        </div>
      </div>
      {position
        ? <button type="button" onClick={() => { setPosition(null); setAround(null) }} className="chip">Show all trips</button>
        : <button type="button" onClick={useLocation} disabled={loading} className="chip"><LocateFixed size={14} />{loading ? 'Finding you…' : 'Near me'}</button>}
      <form onSubmit={event => void findTown(event)} className="w-full">
        <SearchField value={town} onChange={event => setTown(event.target.value)} placeholder="Or type a town, e.g. Ann Arbor" aria-label={local ? 'Find trips near a town' : 'Find day trips near a town'} buttonLabel={finding ? 'Finding…' : 'Find'} buttonDisabled={finding || !town.trim()} />
      </form>
    </div>
    {position && nearby.length > 0 && <p role="status" className="mb-3 text-sm font-medium text-link">Showing {local ? 'trips' : 'day trips'} within 50 miles of {around ?? 'you'}</p>}
    {error && !browseAll && <div role="alert" className="panel mb-4 p-4 text-sm text-brown"><p>{error}</p><button type="button" onClick={() => setBrowseAll(true)} className="btn btn-outline mt-3">{local ? 'Show all trips instead' : 'Show all day trips instead'}</button></div>}
    {position && nearby.length === 0 && <p role="status" className="panel-dashed p-6 text-center text-sm text-muted">No {local ? 'trips' : 'day trips'} within 50 miles of {around ?? 'you'} yet. {around ? 'Wrong place? Add the state or country, e.g. “Newtown, CT”.' : 'Try all trips to explore farther away.'}</p>}
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 sm:gap-5">
      {/* Local trips: nothing until a place is chosen (every trip would just be the feed). */}
      {local && !position && !browseAll && <p className="panel-dashed p-6 text-center text-sm text-muted">Tap Near me or type a town to see trips within 50 miles.</p>}
      {(!error || browseAll) && (!local || position || browseAll) && nearby.map(entry => <div key={entry.id}>
        {entry.miles !== null && <p className="mb-1 px-1 text-xs font-medium text-link">{Math.round(entry.miles)} miles from {around ?? 'you'}</p>}
        {entry.card}
      </div>)}
    </div>
  </section>
}

'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import ItineraryMap from './ItineraryMap'
import type { ItemPin } from './ItineraryMapInner'
import { tripMapLookupKey, validMapLocation, type TripMapPlace } from '@/lib/tripMapPlaces'

type Location = { lat: number; lng: number } | null

export default function TripEntryLayout({ places, children }: { places: TripMapPlace[]; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const cache = useRef(new Map<string, Location>())
  const [locations, setLocations] = useState<Record<string, Location>>({})
  const namedPlaces = places.filter(place => place.name.trim())
  // Changes to notes, ordering, and day assignments don't repeat place lookups.
  const lookupKeys = JSON.stringify([...new Set(namedPlaces.map(tripMapLookupKey))].sort())

  useEffect(() => {
    const controller = new AbortController()
    const keys: string[] = JSON.parse(lookupKeys)
    const timer = setTimeout(async () => {
      for (const key of keys) {
        if (controller.signal.aborted) break
        if (cache.current.has(key)) continue
        try {
          const url = key.startsWith('id:')
            ? `/api/place-details?id=${encodeURIComponent(key.slice(3))}`
            : `/api/trip-map-location?q=${encodeURIComponent(key.slice(2))}`
          const res = await fetch(url, { signal: controller.signal })
          const data = res.ok ? await res.json() : null
          if (controller.signal.aborted) break
          const location = validMapLocation(data) ? { lat: data.lat, lng: data.lng } : null
          cache.current.set(key, location)
          setLocations(current => ({ ...current, [key]: location }))
        } catch {
          if (controller.signal.aborted) break
          cache.current.set(key, null)
          setLocations(current => ({ ...current, [key]: null }))
        }
      }
    }, 650)
    return () => { clearTimeout(timer); controller.abort() }
  }, [lookupKeys])

  const pins: ItemPin[] = namedPlaces.flatMap(place => {
    const location = locations[tripMapLookupKey(place)]
    return location ? [{ id: place.id, name: place.name, type: place.type, day: place.day, recommendation: 'none' as const, ...location }] : []
  })
  const pending = namedPlaces.filter(place => locations[tripMapLookupKey(place)] === undefined).length
  const missing = namedPlaces.filter(place => locations[tripMapLookupKey(place)] === null)

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
      <div className="min-w-0">{children}</div>
      <aside aria-label="Trip map preview" className="order-first min-w-0 rounded-2xl border border-[#d7cebc] bg-[#faf7ee] lg:sticky lg:top-24 lg:order-last">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <h2 className="font-semibold text-[#2e4147]">Your trip on the map</h2>
            <p className="text-xs text-[#5C3D2E]" aria-live="polite">{pending ? `Finding ${pending} ${pending === 1 ? 'place' : 'places'}…` : `${pins.length} of ${namedPlaces.length} places mapped`}</p>
          </div>
          <button type="button" onClick={() => setMobileOpen(open => !open)} aria-expanded={mobileOpen} aria-controls="trip-entry-map" className="min-h-11 px-3 text-sm font-semibold text-[#507c76] lg:hidden">
            {mobileOpen ? 'Hide map' : 'Show map'}
          </button>
        </div>
        <div id="trip-entry-map" className={`${mobileOpen ? 'block' : 'hidden'} lg:block`}>
          <div className="relative isolate h-80 overflow-hidden lg:h-[calc(100dvh-16rem)] lg:min-h-80">
            {pins.length > 0 ? <ItineraryMap pins={pins} /> : <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[#5C3D2E]">{pending ? 'Finding your places…' : namedPlaces.length ? 'No locations found yet. Try a more specific place name.' : 'Add a hotel, restaurant, or activity to see where it is.'}</div>}
          </div>
          <div className="px-4 py-3 text-xs text-[#5C3D2E]">
            <p>Pins update as you add places. Colors show each day.</p>
            {missing.length > 0 && <p className="mt-1">Couldn’t locate: {missing.map(place => place.name).join(', ')}. Try a more specific name or select a search suggestion.</p>}
          </div>
        </div>
      </aside>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import ItineraryMap from './ItineraryMap'
import type { ItemPin } from './ItineraryMapInner'
import { tripMapLookupKey, validMapLocation, type TripMapPlace } from '@/lib/tripMapPlaces'

type Location = { lat: number; lng: number }
export type PlanningMapPlace = TripMapPlace & { lat: number | null; lng: number | null }

export default function PlanningMap({ places }: { places: PlanningMapPlace[] }) {
  const cache = useRef(new Map<string, Location | null>())
  const [locations, setLocations] = useState<Record<string, Location | null>>({})
  const [attempt, setAttempt] = useState(0)
  const lookupKeys = JSON.stringify([...new Set(places.filter(place => !validMapLocation(place)).map(tripMapLookupKey))].sort())

  useEffect(() => {
    const controller = new AbortController()
    const keys: string[] = JSON.parse(lookupKeys)
    async function worker() {
      while (keys.length && !controller.signal.aborted) {
        const key = keys.shift()!
        if (cache.current.has(key)) continue
        try {
          const url = key.startsWith('id:') ? `/api/place-details?id=${encodeURIComponent(key.slice(3))}` : `/api/trip-map-location?q=${encodeURIComponent(key.slice(2))}`
          const response = await fetch(url, { signal: controller.signal })
          const data = response.ok ? await response.json() : null
          if (controller.signal.aborted) return
          const location = validMapLocation(data) ? { lat: data.lat, lng: data.lng } : null
          cache.current.set(key, location)
          setLocations(previous => ({ ...previous, [key]: location }))
        } catch {
          if (controller.signal.aborted) return
          cache.current.set(key, null)
          setLocations(previous => ({ ...previous, [key]: null }))
        }
      }
    }
    void Promise.all([worker(), worker(), worker()])
    return () => controller.abort()
  }, [lookupKeys, attempt])

  const resolved = places.map(place => ({ place, location: validMapLocation(place) ? { lat: place.lat, lng: place.lng } : locations[tripMapLookupKey(place)] }))
  const pins: ItemPin[] = resolved.flatMap(({ place, location }) => location ? [{ id: place.id, name: place.name, type: place.type, day: place.day, recommendation: 'none', ...location }] : [])
  const pending = resolved.filter(row => row.location === undefined).length
  const missing = resolved.filter(row => row.location === null)

  function retry() {
    for (const { place } of missing) cache.current.delete(tripMapLookupKey(place))
    setLocations(previous => Object.fromEntries(Object.entries(previous).filter(([, value]) => value !== null)))
    setAttempt(value => value + 1)
  }

  return <section aria-label="Planning map" className="overflow-hidden rounded-2xl border border-[#d7cebc] bg-[#fffdf7]">
    <div className="px-4 py-3"><h2 className="font-semibold">Your trip on the map</h2><p role="status" className="mt-1 text-sm text-[#73786d]">{pins.length} of {places.length} places mapped{pending ? ` · Finding ${pending}…` : ''}</p></div>
    <div className="relative isolate h-[55dvh] min-h-80 max-h-[650px]">
      {pins.length ? <ItineraryMap pins={pins} /> : <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[#73786d]">{pending ? 'Finding your places…' : places.length ? 'Select a Google suggestion or enter a more specific place name to locate your places.' : 'Add places to your plan to see them on the map.'}</div>}
    </div>
    <div className="space-y-2 px-4 py-3 text-sm text-[#73786d]"><p>Hotels, restaurants, and things to do—including places without a day. Tap a pin for details.</p>
      {missing.length > 0 && <><p>Couldn’t locate: {missing.map(({ place }) => `${place.name} (${place.city})`).join(', ')}.</p><button type="button" onClick={retry} className="min-h-11 font-semibold text-[#507c76]">Retry missing locations</button></>}
    </div>
  </section>
}

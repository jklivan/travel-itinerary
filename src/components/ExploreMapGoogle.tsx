'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { APIProvider, AdvancedMarker, InfoWindow, Map } from '@vis.gl/react-google-maps'
import { GOOGLE_MAP_ID, GOOGLE_MAPS_KEY, gestureHandling, zoomControlProps } from './ItineraryMapGoogle'
import type { MapPin } from './ExploreMapInner'

// Google Maps version of ExploreMapInner: trips grouped by approximate location; a group opens that
// city's trips, a single trip shows a card with a link.
export default function ExploreMapGoogle({ pins }: { pins: MapPin[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const clusters = new globalThis.Map<string, MapPin[]>()
  for (const pin of pins) {
    const key = `${pin.lat.toFixed(2)},${pin.lng.toFixed(2)}`
    clusters.set(key, [...(clusters.get(key) ?? []), pin])
  }
  const center = pins.length ? { lat: pins.reduce((s, p) => s + p.lat, 0) / pins.length, lng: pins.reduce((s, p) => s + p.lng, 0) / pins.length } : { lat: 20, lng: 0 }
  const open = selected ? clusters.get(selected)?.[0] : undefined

  return <APIProvider apiKey={GOOGLE_MAPS_KEY}>
    <Map mapId={GOOGLE_MAP_ID} defaultCenter={center} defaultZoom={pins.length ? 3 : 2} gestureHandling={gestureHandling()}
      mapTypeControl={false} streetViewControl={false} fullscreenControl={false} {...zoomControlProps()} style={{ width: '100%', height: '100%' }} onClick={() => setSelected(null)}>
      {[...clusters.entries()].map(([key, group]) => {
        const [lat, lng] = key.split(',').map(Number)
        const { destName, country } = group[0]
        const size = group.length > 1 ? 28 : 20
        return <AdvancedMarker key={key} position={{ lat, lng }} title={`${destName}${country ? `, ${country}` : ''}${group.length > 1 ? ` · ${group.length} trips` : ''}`}
          onClick={() => group.length > 1 ? router.push(`/explore?country=${encodeURIComponent(country ?? '')}&city=${encodeURIComponent(destName)}`) : setSelected(key)}>
          <div style={{ width: size, height: size, background: '#2563eb', borderRadius: '50%', border: '2.5px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 700 }}>{group.length > 1 ? group.length : ''}</div>
        </AdvancedMarker>
      })}
      {open && selected && <InfoWindow position={{ lat: Number(selected.split(',')[0]), lng: Number(selected.split(',')[1]) }} pixelOffset={[0, -12]} onCloseClick={() => setSelected(null)} headerDisabled>
        <div className="text-sm" style={{ maxWidth: 220 }}>
          <p className="font-semibold text-gray-900">{open.destName}{open.country ? `, ${open.country}` : ''}</p>
          <p className="mt-0.5 text-xs leading-snug text-gray-500">{open.itineraryTitle}</p>
          <a href={`/itinerary/${open.itineraryId}`} className="mt-1 inline-block text-xs text-blue-600 hover:underline">View trip →</a>
        </div>
      </InfoWindow>}
    </Map>
  </APIProvider>
}

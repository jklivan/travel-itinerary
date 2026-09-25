'use client'

import { useEffect, useState } from 'react'
import { APIProvider, AdvancedMarker, ControlPosition, InfoWindow, Map, useMap } from '@vis.gl/react-google-maps'
import { mapDayColor } from '@/lib/mapDays'
import { MapDayLegend, PIN_EMOJI, pinLabel, type ItemPin } from './ItineraryMapInner'

export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
// Advanced markers need a Map ID; Google's demo ID works until a real one is configured.
export const GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID'
// Phones: one finger scrolls the page, two fingers move the map (no scroll trap). Desktop: wheel zooms.
function isTouchScreen() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}
export function gestureHandling() {
  return isTouchScreen() ? 'cooperative' : 'greedy'
}
// + / − buttons on desktop only (phones pinch to zoom). Middle of the right edge: the bottom bar covers the
// bottom corners of full-height maps, and the planner's Shrink/Hide buttons sit top-right.
export function zoomControlProps() {
  // The four-arrow camera control hides zoom inside it; plain + / − is clearer.
  return { zoomControl: !isTouchScreen(), zoomControlOptions: { position: ControlPosition.RIGHT_CENTER }, cameraControl: false }
}

function FitBounds({ pins }: { pins: ItemPin[] }) {
  const map = useMap()
  const key = JSON.stringify(pins.map(pin => [pin.lat, pin.lng]))
  useEffect(() => {
    if (!map) return
    const positions: [number, number][] = JSON.parse(key)
    function fit() {
      if (!map || !positions.length) return
      if (positions.length === 1) { map.setCenter({ lat: positions[0][0], lng: positions[0][1] }); map.setZoom(14); return }
      const bounds = new google.maps.LatLngBounds()
      for (const [lat, lng] of positions) bounds.extend({ lat, lng })
      map.fitBounds(bounds, 48)
      // Same cap as before: never zoom closer than street level when places are close together.
      google.maps.event.addListenerOnce(map, 'idle', () => { if ((map.getZoom() ?? 0) > 16) map.setZoom(16) })
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(map.getDiv())
    return () => observer.disconnect()
  }, [map, key])
  return null
}

function PinIcon({ pin }: { pin: ItemPin }) {
  return <div style={{ width: 36, height: 36, background: pin.color ?? mapDayColor(pin.day), borderRadius: '50%', border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, fontSize: 12, lineHeight: 1, color: 'white', fontWeight: 700 }}>
    {PIN_EMOJI[pin.type] ?? '📍'}{pin.day === null ? null : <span>{pin.day}</span>}
  </div>
}

// Google Maps version of ItineraryMapInner: same pins, colors, legend and popups.
export default function ItineraryMapGoogle({ pins }: { pins: ItemPin[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  if (pins.length === 0) return <div className="flex h-full items-center justify-center text-sm text-gray-400">No location data available for this itinerary.</div>
  const open = pins.find(pin => pin.id === selected)
  return <div className="flex h-full flex-col">
    <MapDayLegend pins={pins} />
    <div className="min-h-0 flex-1">
      <APIProvider apiKey={GOOGLE_MAPS_KEY}>
        <Map mapId={GOOGLE_MAP_ID} defaultCenter={{ lat: pins[0].lat, lng: pins[0].lng }} defaultZoom={12} gestureHandling={gestureHandling()}
          mapTypeControl={false} streetViewControl={false} fullscreenControl={false} {...zoomControlProps()} style={{ width: '100%', height: '100%' }} onClick={() => setSelected(null)}>
          <FitBounds pins={pins} />
          {pins.map(pin => <AdvancedMarker key={pin.id} position={{ lat: pin.lat, lng: pin.lng }} title={`${pin.name} · ${pinLabel(pin)}`} onClick={() => setSelected(pin.id)}>
            <PinIcon pin={pin} />
          </AdvancedMarker>)}
          {open && <InfoWindow position={{ lat: open.lat, lng: open.lng }} pixelOffset={[0, -20]} onCloseClick={() => setSelected(null)} headerDisabled>
            <div style={{ fontFamily: 'inherit', maxWidth: 200 }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: '#111', margin: 0 }}>{PIN_EMOJI[open.type] ?? '📍'} {open.name}</p>
              {open.recommendation !== 'none' && <p style={{ margin: '6px 0 0', color: open.recommendation === 'avoid' ? '#a44138' : '#59694f', fontWeight: 700 }}>
                {open.recommendation === 'option' ? 'Alternative' : open.recommendation === 'avoid' ? 'Avoid' : open.type === 'hotel' ? 'Must stay' : 'Must do'} · {open.recommendation === 'option' ? 'Saved as an alternative' : 'Poster’s recommendation'}
              </p>}
              <p style={{ margin: '6px 0 0', color: open.color ?? mapDayColor(open.day), fontWeight: 600 }}>{pinLabel(open)}</p>
            </div>
          </InfoWindow>}
        </Map>
      </APIProvider>
    </div>
  </div>
}

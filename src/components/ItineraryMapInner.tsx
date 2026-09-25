'use client'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { mapDayColor } from '@/lib/mapDays'
import type { PlaceRecommendation } from '@/lib/placeRecommendation'

export type ItemPin = {
  id: string
  name: string
  type: 'hotel' | 'food_drink' | 'activity' | 'transport'
  lat: number
  lng: number
  day: number | null
  recommendation: PlaceRecommendation
  // Overrides the day color and the day line in the popup (e.g. to group suggestions by trip idea).
  color?: string
  label?: string
}

const TYPE_STYLE: Record<string, { emoji: string }> = {
  hotel:      { emoji: '🏨' },
  food_drink: { emoji: '🍴' },
  activity:   { emoji: '📍' },
  transport: { emoji: '✈️' },
}

function itemIcon(type: string, day: number | null, color?: string) {
  const s = TYPE_STYLE[type] ?? TYPE_STYLE.activity
  return L.divIcon({
    className: '',
    html: `<div style="
      width:36px;height:36px;
      background:${color ?? mapDayColor(day)};
      border-radius:50%;
      border:2px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      font-size:12px;line-height:1;gap:3px;color:white;font-weight:700;
    ">${s.emoji}${day === null ? '' : `<span>${day}</span>`}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  })
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  const positionsKey = JSON.stringify(positions)
  const stablePositions = useMemo<[number, number][]>(() => JSON.parse(positionsKey), [positionsKey])
  useEffect(() => {
    function fit() {
      map.stop()
      map.invalidateSize()
      if (stablePositions.length === 1) {
        map.setView(stablePositions[0], 14, { animate: false })
      } else if (stablePositions.length > 1) {
        map.fitBounds(stablePositions, { padding: [48, 48], maxZoom: 16, animate: false })
      }
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map, stablePositions])
  return null
}

// Day colors, hotels and undated places. Pins with their own color are explained by the caller instead.
// Shared by the Leaflet and Google versions of this map.
export function MapDayLegend({ pins }: { pins: ItemPin[] }) {
  const dayPins = pins.filter(pin => !pin.color)
  const days = [...new Set(dayPins.flatMap(pin => pin.day === null ? [] : [pin.day]))].sort((a, b) => a - b)
  const hasHotels = dayPins.some(pin => pin.type === 'hotel' && pin.day === null)
  const hasUndatedPlaces = dayPins.some(pin => pin.type !== 'hotel' && pin.day === null)
  if (!dayPins.length) return null
  return <div aria-label="Map day legend" className="flex max-h-28 shrink-0 flex-wrap gap-x-4 gap-y-2 overflow-y-auto border-b border-[#d7cebc] bg-[#faf7ee] px-4 py-3 text-xs text-[#2e4147]">
    {days.map(day => <span key={day} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: mapDayColor(day) }} />Day {day}</span>)}
    {hasHotels && <span className="inline-flex items-center gap-1.5"><span aria-hidden="true">🏨</span>Hotels</span>}
    {hasUndatedPlaces && <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: mapDayColor(null) }} />No day assigned</span>}
  </div>
}

// What a pin's popup and tooltip say under its name.
export function pinLabel(pin: ItemPin) {
  return pin.label ?? (pin.day === null ? pin.type === 'hotel' ? 'Hotel' : 'No day assigned' : `Day ${pin.day}`)
}
export const PIN_EMOJI: Record<string, string> = { hotel: '🏨', food_drink: '🍴', activity: '📍', transport: '✈️' }

export default function ItineraryMapInner({ pins }: { pins: ItemPin[] }) {
  if (pins.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No location data available for this itinerary.
      </div>
    )
  }

  const center: [number, number] = [
    pins.reduce((s, p) => s + p.lat, 0) / pins.length,
    pins.reduce((s, p) => s + p.lng, 0) / pins.length,
  ]
  const positions: [number, number][] = pins.map(p => [p.lat, p.lng])
  return (
    <div className="flex h-full flex-col">
      <MapDayLegend pins={pins} />
      <div className="min-h-0 flex-1">
      <MapContainer
      center={center}
      zoom={12}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <FitBounds positions={positions} />
      {pins.map(pin => (
        <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={itemIcon(pin.type, pin.day, pin.color)}
          title={`${pin.name} · ${pin.label ?? (pin.day === null ? pin.type === 'hotel' ? 'Hotel' : 'No day assigned' : `Day ${pin.day}`)}`}
          alt={`${pin.name} · ${pin.label ?? (pin.day === null ? pin.type === 'hotel' ? 'Hotel' : 'No day assigned' : `Day ${pin.day}`)}`}>
          <Popup maxWidth={200} minWidth={140}>
            <div style={{ fontFamily: 'inherit' }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: '#111', margin: 0 }}>
                {TYPE_STYLE[pin.type]?.emoji ?? '📍'} {pin.name}
              </p>
              {pin.recommendation !== 'none' && <p style={{ margin: '6px 0 0', color: pin.recommendation === 'avoid' ? '#a44138' : '#59694f', fontWeight: 700 }}>
                {pin.recommendation === 'option' ? 'Alternative' : pin.recommendation === 'avoid' ? 'Avoid' : pin.type === 'hotel' ? 'Must stay' : 'Must do'} · {pin.recommendation === 'option' ? 'Saved as an alternative' : 'Poster’s recommendation'}
              </p>}
              <p style={{ margin: '6px 0 0', color: pin.color ?? mapDayColor(pin.day), fontWeight: 600 }}>
                {pin.label ?? (pin.day === null ? pin.type === 'hotel' ? 'Hotel' : 'No day assigned' : `Day ${pin.day}`)}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
      </div>
    </div>
  )
}

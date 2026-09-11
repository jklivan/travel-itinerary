'use client'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { mapDayColor } from '@/lib/mapDays'
import type { PlaceRecommendation } from '@/lib/placeRecommendation'

export type ItemPin = {
  id: string
  name: string
  type: 'hotel' | 'food_drink' | 'activity'
  lat: number
  lng: number
  day: number | null
  recommendation: PlaceRecommendation
}

const TYPE_STYLE: Record<string, { emoji: string }> = {
  hotel:      { emoji: '🏨' },
  food_drink: { emoji: '🍴' },
  activity:   { emoji: '📍' },
}

function itemIcon(type: string, day: number | null) {
  const s = TYPE_STYLE[type] ?? TYPE_STYLE.activity
  return L.divIcon({
    className: '',
    html: `<div style="
      width:36px;height:36px;
      background:${mapDayColor(day)};
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
  useEffect(() => {
    if (positions.length === 1) {
      map.setView(positions[0], 14)
    } else if (positions.length > 1) {
      map.fitBounds(positions, { padding: [48, 48] })
    }
  }, [map]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

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
  const days = [...new Set(pins.flatMap(pin => pin.day === null ? [] : [pin.day]))].sort((a, b) => a - b)
  const hasHotels = pins.some(pin => pin.type === 'hotel' && pin.day === null)
  const hasUndatedPlaces = pins.some(pin => pin.type !== 'hotel' && pin.day === null)

  return (
    <div className="flex h-full flex-col">
      <div aria-label="Map day legend" className="flex max-h-28 shrink-0 flex-wrap gap-x-4 gap-y-2 overflow-y-auto border-b border-[#d7cebc] bg-[#faf7ee] px-4 py-3 text-xs text-[#2e4147]">
        {days.map(day => <span key={day} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: mapDayColor(day) }} />Day {day}</span>)}
        {hasHotels && <span className="inline-flex items-center gap-1.5"><span aria-hidden="true">🏨</span>Hotels</span>}
        {hasUndatedPlaces && <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: mapDayColor(null) }} />No day assigned</span>}
      </div>
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
        <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={itemIcon(pin.type, pin.day)}
          title={`${pin.name} · ${pin.day === null ? pin.type === 'hotel' ? 'Hotel' : 'No day assigned' : `Day ${pin.day}`}`}
          alt={`${pin.name} · ${pin.day === null ? pin.type === 'hotel' ? 'Hotel' : 'No day assigned' : `Day ${pin.day}`}`}>
          <Popup maxWidth={200} minWidth={140}>
            <div style={{ fontFamily: 'inherit' }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: '#111', margin: 0 }}>
                {TYPE_STYLE[pin.type]?.emoji ?? '📍'} {pin.name}
              </p>
              {pin.recommendation !== 'none' && <p style={{ margin: '6px 0 0', color: pin.recommendation === 'avoid' ? '#a44138' : '#507c76', fontWeight: 700 }}>
                {pin.recommendation === 'option' ? 'Alternative' : pin.recommendation === 'avoid' ? 'Avoid' : pin.type === 'hotel' ? 'Must stay' : 'Must do'} · {pin.recommendation === 'option' ? 'Saved as an alternative' : 'Poster’s recommendation'}
              </p>}
              <p style={{ margin: '6px 0 0', color: mapDayColor(pin.day), fontWeight: 600 }}>
                {pin.day === null ? pin.type === 'hotel' ? 'Hotel' : 'No day assigned' : `Day ${pin.day}`}
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

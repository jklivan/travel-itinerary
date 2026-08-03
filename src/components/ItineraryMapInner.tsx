'use client'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

export type ItemPin = {
  id: string
  name: string
  type: 'hotel' | 'food_drink' | 'activity'
  lat: number
  lng: number
}

const TYPE_STYLE: Record<string, { bg: string; emoji: string }> = {
  hotel:      { bg: '#2563eb', emoji: '🏨' },
  food_drink: { bg: '#ea580c', emoji: '🍴' },
  activity:   { bg: '#16a34a', emoji: '📍' },
}

function itemIcon(type: string) {
  const s = TYPE_STYLE[type] ?? TYPE_STYLE.activity
  return L.divIcon({
    className: '',
    html: `<div style="
      width:26px;height:26px;
      background:${s.bg};
      border-radius:50%;
      border:2px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      font-size:12px;line-height:1;
    ">${s.emoji}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -16],
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

  return (
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
        <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={itemIcon(pin.type)}>
          <Popup maxWidth={200} minWidth={140}>
            <div style={{ fontFamily: 'inherit' }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: '#111', margin: 0 }}>
                {TYPE_STYLE[pin.type]?.emoji ?? '📍'} {pin.name}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

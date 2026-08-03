'use client'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'

export type DestPin = {
  id: string
  name: string
  country: string | null
  lat: number
  lng: number
  hotels: string[]
  foodCount: number
  activityCount: number
}

function stopIcon(index: number) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;
      background:#2563eb;
      border-radius:50%;
      border:2.5px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      color:white;font-size:11px;font-weight:700;
    ">${index + 1}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length === 1) {
      map.setView(positions[0], 11)
    } else if (positions.length > 1) {
      map.fitBounds(positions, { padding: [48, 48] })
    }
  }, [map]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function ItineraryMapInner({ pins }: { pins: DestPin[] }) {
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
      zoom={4}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <FitBounds positions={positions} />
      {positions.length > 1 && (
        <Polyline positions={positions} color="#93c5fd" weight={2} dashArray="6 5" opacity={0.8} />
      )}
      {pins.map((pin, i) => (
        <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={stopIcon(i)}>
          <Popup maxWidth={220} minWidth={160}>
            <div style={{ fontFamily: 'inherit' }}>
              <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#111' }}>
                {pin.name}{pin.country ? `, ${pin.country}` : ''}
              </p>
              {pin.hotels.map((h, j) => (
                <p key={j} style={{ fontSize: 12, color: '#374151', margin: '2px 0' }}>🏨 {h}</p>
              ))}
              {pin.foodCount > 0 && (
                <p style={{ fontSize: 12, color: '#374151', margin: '2px 0' }}>
                  🍴 {pin.foodCount} restaurant{pin.foodCount !== 1 ? 's' : ''}
                </p>
              )}
              {pin.activityCount > 0 && (
                <p style={{ fontSize: 12, color: '#374151', margin: '2px 0' }}>
                  📍 {pin.activityCount} activit{pin.activityCount !== 1 ? 'ies' : 'y'}
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

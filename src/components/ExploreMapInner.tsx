'use client'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

// Custom pin icon — avoids webpack image-path issues with Leaflet's default
const pinIcon = (count: number) =>
  L.divIcon({
    className: '',
    html: `<div style="
      width:${count > 1 ? 28 : 20}px;
      height:${count > 1 ? 28 : 20}px;
      background:#2563eb;
      border-radius:50%;
      border:2.5px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;
      align-items:center;
      justify-content:center;
      color:white;
      font-size:10px;
      font-weight:700;
    ">${count > 1 ? count : ''}</div>`,
    iconSize: [count > 1 ? 28 : 20, count > 1 ? 28 : 20],
    iconAnchor: [count > 1 ? 14 : 10, count > 1 ? 14 : 10],
    popupAnchor: [0, -14],
  })

export type MapPin = {
  lat: number
  lng: number
  destName: string
  country: string | null
  itineraryId: string
  itineraryTitle: string
}

export default function ExploreMapInner({ pins }: { pins: MapPin[] }) {
  // Cluster pins at the same approximate location
  const clusters = new Map<string, MapPin[]>()
  for (const pin of pins) {
    const key = `${pin.lat.toFixed(2)},${pin.lng.toFixed(2)}`
    if (!clusters.has(key)) clusters.set(key, [])
    clusters.get(key)!.push(pin)
  }

  const center: [number, number] =
    pins.length > 0
      ? [
          pins.reduce((s, p) => s + p.lat, 0) / pins.length,
          pins.reduce((s, p) => s + p.lng, 0) / pins.length,
        ]
      : [20, 0]

  return (
    <MapContainer
      center={center}
      zoom={pins.length > 0 ? 3 : 2}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      />
      {[...clusters.entries()].map(([key, group]) => {
        const [lat, lng] = key.split(',').map(Number)
        return (
          <Marker key={key} position={[lat, lng]} icon={pinIcon(group.length)}>
            <Popup maxWidth={220}>
              <div className="text-sm space-y-2">
                {group.map((pin, i) => (
                  <div key={i} className={i > 0 ? 'pt-2 border-t border-gray-100' : ''}>
                    <p className="font-semibold text-gray-900">
                      {pin.destName}{pin.country ? `, ${pin.country}` : ''}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5 leading-snug">{pin.itineraryTitle}</p>
                    <a
                      href={`/itinerary/${pin.itineraryId}`}
                      className="text-blue-600 text-xs hover:underline mt-1 inline-block"
                    >
                      View trip →
                    </a>
                  </div>
                ))}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}

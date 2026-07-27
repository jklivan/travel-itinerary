'use client'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()
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
        const { destName, country } = group[0]
        const cityUrl = `/explore?country=${encodeURIComponent(country ?? '')}&city=${encodeURIComponent(destName)}`
        const isCluster = group.length > 1

        return (
          <Marker
            key={key}
            position={[lat, lng]}
            icon={pinIcon(group.length)}
            eventHandlers={isCluster ? { click: () => router.push(cityUrl) } : undefined}
          >
            {isCluster ? (
              <Tooltip direction="top" offset={[0, -14]} opacity={0.92}>
                <span className="text-xs font-semibold">
                  {destName}{country ? `, ${country}` : ''} · {group.length} trips
                </span>
              </Tooltip>
            ) : (
              <Popup maxWidth={220}>
                <div className="text-sm">
                  <p className="font-semibold text-gray-900">
                    {destName}{country ? `, ${country}` : ''}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5 leading-snug">{group[0].itineraryTitle}</p>
                  <a
                    href={`/itinerary/${group[0].itineraryId}`}
                    className="text-blue-600 text-xs hover:underline mt-1 inline-block"
                  >
                    View trip →
                  </a>
                </div>
              </Popup>
            )}
          </Marker>
        )
      })}
    </MapContainer>
  )
}

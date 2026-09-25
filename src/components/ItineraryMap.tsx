'use client'
import dynamic from 'next/dynamic'
import type { ItemPin } from './ItineraryMapInner'

const ItineraryMapInner = dynamic(() => import('./ItineraryMapInner'), { ssr: false })
const ItineraryMapGoogle = dynamic(() => import('./ItineraryMapGoogle'), { ssr: false })
// Google Maps once a browser key is configured; OpenStreetMap until then.
const useGoogle = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

export default function ItineraryMap({ pins }: { pins: ItemPin[] }) {
  return (
    <div className="h-full w-full">
      {useGoogle ? <ItineraryMapGoogle pins={pins} /> : <ItineraryMapInner pins={pins} />}
    </div>
  )
}

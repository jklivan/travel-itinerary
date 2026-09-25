'use client'
import dynamic from 'next/dynamic'
import type { MapPin } from './ExploreMapInner'

const ExploreMapInner = dynamic(() => import('./ExploreMapInner'), { ssr: false })
const ExploreMapGoogle = dynamic(() => import('./ExploreMapGoogle'), { ssr: false })
// Google Maps once a browser key is configured; OpenStreetMap until then.
const useGoogle = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

export default function ExploreMap({ pins }: { pins: MapPin[] }) {
  return (
    <div className="h-full w-full">
      {useGoogle ? <ExploreMapGoogle pins={pins} /> : <ExploreMapInner pins={pins} />}
    </div>
  )
}

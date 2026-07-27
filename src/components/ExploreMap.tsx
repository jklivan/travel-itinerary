'use client'
import dynamic from 'next/dynamic'
import type { MapPin } from './ExploreMapInner'

const ExploreMapInner = dynamic(() => import('./ExploreMapInner'), { ssr: false })

export default function ExploreMap({ pins }: { pins: MapPin[] }) {
  return (
    <div className="h-full w-full">
      <ExploreMapInner pins={pins} />
    </div>
  )
}

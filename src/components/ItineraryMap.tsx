'use client'
import dynamic from 'next/dynamic'
import type { ItemPin } from './ItineraryMapInner'

const ItineraryMapInner = dynamic(() => import('./ItineraryMapInner'), { ssr: false })

export default function ItineraryMap({ pins }: { pins: ItemPin[] }) {
  return (
    <div className="h-full w-full">
      <ItineraryMapInner pins={pins} />
    </div>
  )
}

'use client'

import type { ReactNode } from 'react'
import { TripDates } from '@/lib/tripPhotos'

// For server pages: tells photo inputs below which dates the trip covers (see lib/tripPhotos).
export default function TripDatesProvider({ start, end, children }: { start: string; end: string; children: ReactNode }) {
  return <TripDates.Provider value={{ start, end }}>{children}</TripDates.Provider>
}

'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import HeaderPostButton from './HeaderPostButton'
import { previousPage } from '@/lib/backNavigation'
import { tripReturnPath } from '@/lib/tripNavigation'

// Where Back goes when there's no earlier page in the app (e.g. a link opened directly).
function parentPath(pathname: string, search: string) {
  if (search) return pathname // Explore views, filters and searches go back to that page's start.
  const trip = pathname.match(/^\/itinerary\/([^/]+)$/)
  if (trip) return tripReturnPath(trip[1], '/')
  if (/^\/plan\/[^/]+$/.test(pathname)) return '/trips'
  const parent = pathname.replace(/\/[^/]+\/?$/, '')
  return parent || '/'
}

// Left of the logo: + (post a trip) on Feed; Back everywhere else. Pages don't have their own Back links.
export default function HeaderLeft() {
  const pathname = usePathname()
  const router = useRouter()
  if (pathname === '/') return <HeaderPostButton />
  return <button type="button" onClick={() => {
    if (previousPage(window.history.state)) router.back()
    else router.push(parentPath(pathname, window.location.search))
  }} className="-ml-1 flex min-h-11 items-center gap-0.5 pr-2 text-base text-ink hover:text-ink-soft">
    <ChevronLeft size={22} strokeWidth={1.75} />Back
  </button>
}

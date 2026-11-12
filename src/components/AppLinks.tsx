'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'

const OUR_HOSTS = ['www.postcardtravel.app', 'postcardtravel.app', 'travel-itinerary-gules.vercel.app', 'postcard-travel-preview.vercel.app']

// In the iPhone app: a postcardtravel.app link tapped elsewhere (an email, a text) opens the app (Universal Links,
// app/api/aasa); this takes it to that page. Also when the link is what started the app.
export default function AppLinks() {
  const router = useRouter()
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('App')) return
    let remove: (() => void) | null = null, live = true
    const open = (url: string | undefined) => {
      try { const link = new URL(url ?? ''); if (OUR_HOSTS.includes(link.hostname)) router.push(`${link.pathname}${link.search}${link.hash}`) } catch { /* not a link of ours */ }
    }
    void import('@capacitor/app').then(async ({ App }) => {
      const launch = await App.getLaunchUrl().catch(() => null)
      if (live && launch?.url) open(launch.url)
      const handle = await App.addListener('appUrlOpen', event => open(event.url))
      if (live) remove = () => void handle.remove(); else void handle.remove()
    })
    return () => { live = false; remove?.() }
  }, [router])
  return null
}

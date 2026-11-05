'use client'

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

// The iPhone app's TestFlight test build opens the preview site (npm run ios:preview): a small tag at the top says so,
// so it's never mistaken for the live app (and an App Store build that opens the preview by mistake shows it too).
export default function PreviewAppTag() {
  const [show, setShow] = useState(false)
  useEffect(() => { setShow(Capacitor.isNativePlatform() && window.location.hostname === 'postcard-travel-preview.vercel.app') }, [])
  if (!show) return null
  return <span role="status" className="pointer-events-none fixed left-1/2 top-[env(safe-area-inset-top)] z-[90] -translate-x-1/2 rounded-b-lg bg-ink px-2 py-0.5 text-micro font-semibold uppercase tracking-caps text-white">Preview</span>
}

'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

// Right after posting a trip, in the iPhone app: Apple's own "Enjoying Postcard?" rating prompt, a few seconds after
// the Feed shows the new post. Apple decides whether it actually appears (at most about 3 times a year per person),
// and older app builds without the plugin just skip it.
export default function AskForRating() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('InAppReview')) return
    const timer = setTimeout(() => {
      void import('@capacitor-community/in-app-review').then(({ InAppReview }) => InAppReview.requestReview()).catch(() => {})
    }, 3000)
    return () => clearTimeout(timer)
  }, [])
  return null
}

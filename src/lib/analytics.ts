import posthog from 'posthog-js'
import { Capacitor } from '@capacitor/core'
import { TEST_ACCOUNT_IDS } from '@/lib/hiddenAccounts'

// Usage analytics (PostHog): page views, time on each page, and who did what once signed in. Events go through
// Postcard's own /ingest address (rewritten to PostHog in next.config.ts) so ad blockers don't drop them. Off when
// NEXT_PUBLIC_POSTHOG_KEY isn't set (local development) and for the test accounts.

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const LIVE_HOSTS = ['www.postcardtravel.app', 'postcardtravel.app', 'travel-itinerary-gules.vercel.app']

let started = false

export function startAnalytics() {
  if (!KEY || started || window.location.hostname === 'localhost') return
  started = true
  posthog.init(KEY, {
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    defaults: '2025-05-24', // a page view on every page change, and a page leave with the time spent there
    person_profiles: 'identified_only',
    disable_session_recording: true,
  })
  describeVisit()
}

// Sent with every event: the iPhone app loads this site, so tell its visits apart; and keep the preview site out of
// the live numbers.
function describeVisit() {
  posthog.register({ platform: Capacitor.isNativePlatform() ? 'ios-app' : 'web', site: LIVE_HOSTS.includes(window.location.hostname) ? 'live' : 'preview' })
}

// Ties this browser's visits to the signed-in account (or forgets it on sign-out). Test accounts aren't counted.
export function identifyVisitor(user: { id: string; name?: string | null } | null) {
  if (!started) return
  if (!user) {
    // Signed out: start fresh (reset also clears a test account's opt-out), so the next person isn't counted as them.
    if (posthog._isIdentified() || posthog.has_opted_out_capturing()) { posthog.reset(); describeVisit() }
    return
  }
  if (TEST_ACCOUNT_IDS.includes(user.id)) { posthog.opt_out_capturing(); return }
  if (posthog.has_opted_out_capturing()) { posthog.reset(); describeVisit() } // a test account was signed in here before
  posthog.identify(user.id, user.name ? { name: user.name } : undefined)
}

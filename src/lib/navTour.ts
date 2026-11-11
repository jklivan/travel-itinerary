// The first-run tour of the bottom bar: after the intro, Feed, then Plan, then Post each get a highlight and a short
// tip; tapping that tab (or ×) moves on. Kept on this device only.
export const NAV_TOUR_KEY = 'postcard-nav-tour'
export const NAV_TOUR = ['feed', 'plan', 'post'] as const
export type NavTourStep = typeof NAV_TOUR[number]

export function startNavTour() {
  try { if (!localStorage.getItem(NAV_TOUR_KEY)) localStorage.setItem(NAV_TOUR_KEY, 'feed') } catch { /* storage unavailable */ }
}

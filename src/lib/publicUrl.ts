// The address to put in links people share (Send, Plan together invites): always www.postcardtravel.app on the live
// site, including from the iPhone app (which loads travel-itinerary-gules.vercel.app), so links look right and open the
// app. The preview and local development keep their own address, so test links stay on test sites.
const LIVE_HOSTS = ['www.postcardtravel.app', 'postcardtravel.app', 'travel-itinerary-gules.vercel.app']

export function shareUrl(path: string) {
  const origin = LIVE_HOSTS.includes(window.location.hostname) ? 'https://www.postcardtravel.app' : window.location.origin
  return `${origin}${path}`
}

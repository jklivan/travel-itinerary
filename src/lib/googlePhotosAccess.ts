// Google Photos is only for testers until Google verifies the app (until then everyone else would see Google's
// "unverified app" warning, and only 100 people could ever use it). Testers: ADMIN_EMAIL and the comma-separated
// GOOGLE_PHOTOS_TESTERS. Once Google approves, set GOOGLE_PHOTOS_OPEN=1 to turn it on for everyone.
export function googlePhotosAllowed(email: string | null | undefined) {
  if (process.env.GOOGLE_PHOTOS_OPEN === '1') return true
  if (!email) return false
  const testers = [process.env.ADMIN_EMAIL ?? '', ...(process.env.GOOGLE_PHOTOS_TESTERS ?? '').split(',')].map(value => value.trim().toLowerCase()).filter(Boolean)
  return testers.includes(email.toLowerCase())
}

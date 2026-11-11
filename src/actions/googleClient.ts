'use server'

import { auth } from '@/auth'
import { googlePhotosAllowed } from '@/lib/googlePhotosAccess'

// For the Google Photos button: whether this person can use it yet, and the website's Google client id (public: it's in
// every Google sign-in page) for asking for access.
export async function googlePhotosSetup() {
  const email = (await auth())?.user?.email
  return { allowed: googlePhotosAllowed(email), clientId: process.env.AUTH_GOOGLE_ID ?? '' }
}

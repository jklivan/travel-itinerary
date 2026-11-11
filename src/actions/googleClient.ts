'use server'

// The website's Google client id (public: it's in every Google sign-in page), for asking for Google Photos access.
export async function googleWebClientId() {
  return process.env.AUTH_GOOGLE_ID ?? ''
}

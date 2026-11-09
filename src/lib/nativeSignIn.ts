import { createPublicKey, verify, type JsonWebKey } from 'node:crypto'

// Sign-in inside the iPhone app: the app signs in with Apple or Google natively and sends us the ID token it got.
// Before trusting its email we check, like a website sign-in would, that Apple or Google signed it (their published
// keys), that it was made for our app, that it hasn't expired, and that the email is verified.

import { APP_BUNDLE_ID, GOOGLE_IOS_CLIENT_ID } from './nativeSignInIds'
export { APP_BUNDLE_ID, GOOGLE_IOS_CLIENT_ID }

const ISSUERS = {
  google: { keys: 'https://www.googleapis.com/oauth2/v3/certs', iss: ['https://accounts.google.com', 'accounts.google.com'], aud: GOOGLE_IOS_CLIENT_ID },
  apple: { keys: 'https://appleid.apple.com/auth/keys', iss: ['https://appleid.apple.com'], aud: APP_BUNDLE_ID },
} as const
export type NativeProvider = keyof typeof ISSUERS

type Jwk = JsonWebKey & { kid?: string }
const keyCache = new Map<string, { at: number; keys: Jwk[] }>()
async function signingKeys(url: string, fetchKeys: (url: string) => Promise<{ keys: Jwk[] }>) {
  const cached = keyCache.get(url)
  if (cached && Date.now() - cached.at < 60 * 60 * 1000) return cached.keys
  const { keys } = await fetchKeys(url)
  keyCache.set(url, { at: Date.now(), keys })
  return keys
}
const fetchJson = async (url: string) => { const response = await fetch(url, { signal: AbortSignal.timeout(8000) }); if (!response.ok) throw new Error(`keys ${response.status}`); return response.json() }

// The verified email (lowercase) and name, or null if the token can't be trusted.
export async function verifyNativeIdToken(provider: string, token: unknown, now = Date.now(), fetchKeys = fetchJson): Promise<{ email: string; name: string | null } | null> {
  if (provider !== 'google' && provider !== 'apple') return null
  if (typeof token !== 'string' || token.length > 8000) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as { alg?: string; kid?: string }
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as { iss?: string; aud?: string | string[]; exp?: number; email?: string; email_verified?: boolean | string; name?: string }
    const issuer = ISSUERS[provider]
    if (header.alg !== 'RS256' || !header.kid) return null
    const jwk = (await signingKeys(issuer.keys, fetchKeys)).find(key => key.kid === header.kid)
    if (!jwk) return null
    const signed = verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
    if (!signed || !issuer.iss.includes(claims.iss as never) || !audiences.includes(issuer.aud) || !claims.exp || claims.exp * 1000 < now) return null
    if (!claims.email || String(claims.email_verified) !== 'true') return null
    return { email: claims.email.toLowerCase(), name: claims.name?.trim() || null }
  } catch { return null }
}

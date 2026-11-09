import { createPrivateKey, sign } from 'node:crypto'

// Sign in with Apple's "client secret" is a short JWT signed with our Sign in with Apple key (.p8). Apple accepts one
// for at most 6 months, so it's made from the key whenever the server starts (good for 30 days) instead of being
// pasted in and expiring. Null until APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY and AUTH_APPLE_ID are all set.
export function appleClientSecret(): string | null {
  const { APPLE_TEAM_ID: team, APPLE_KEY_ID: keyId, APPLE_PRIVATE_KEY: pem, AUTH_APPLE_ID: clientId } = process.env
  if (!team || !keyId || !pem || !clientId) return null
  const now = Math.floor(Date.now() / 1000)
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const body = `${part({ alg: 'ES256', kid: keyId.trim() })}.${part({ iss: team.trim(), iat: now, exp: now + 30 * 24 * 3600, aud: 'https://appleid.apple.com', sub: clientId.trim() })}`
  try {
    const key = createPrivateKey(pem.replace(/\\n/g, '\n').trim())
    return `${body}.${sign('sha256', Buffer.from(body), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`
  } catch {
    console.error('[auth] APPLE_PRIVATE_KEY could not be read; Sign in with Apple is off')
    return null
  }
}

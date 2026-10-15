import { createHmac, timingSafeEqual } from 'crypto'

// Password reset links carry a signed token instead of a stored one: who it's for, when it expires, and a
// signature over those plus the account's current password hash. Changing the password changes the hash,
// so a link works once, and only until it expires.
export const RESET_LINK_MINUTES = 60

function signature(userId: string, expires: number, passwordHash: string, secret: string) {
  return createHmac('sha256', secret).update(`${userId}.${expires}.${passwordHash}`).digest('base64url')
}

export function makeResetToken(userId: string, passwordHash: string, secret: string, now = Date.now()) {
  const expires = now + RESET_LINK_MINUTES * 60_000
  return `${Buffer.from(`${userId}.${expires}`).toString('base64url')}.${signature(userId, expires, passwordHash, secret)}`
}

// Who the token is for, without checking the signature (that needs their password hash).
export function readResetToken(token: unknown): { userId: string; expires: number; signed: string } | null {
  if (typeof token !== 'string' || token.length > 500) return null
  const [payload, signed] = token.split('.')
  if (!payload || !signed) return null
  const [userId, expiresText] = Buffer.from(payload, 'base64url').toString().split('.')
  const expires = Number(expiresText)
  if (!userId || !Number.isFinite(expires)) return null
  return { userId, expires, signed }
}

export function resetTokenValid(token: unknown, passwordHash: string, secret: string, now = Date.now()) {
  const read = readResetToken(token)
  if (!read || read.expires < now) return false
  const expected = Buffer.from(signature(read.userId, read.expires, passwordHash, secret))
  const given = Buffer.from(read.signed)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// "Send trips to Postcard": each person has a private address, trips-<token>@in.postcardtravel.app. Mail to it is read
// like Import notes or files and lands in their private plans (see api/inbound-email). Only mail that is really from
// them (their account email or an address they added, and signed by its email provider) is used.
export const INBOX_DOMAIN = process.env.INBOX_DOMAIN || 'in.postcardtravel.app'

// Ten letters and digits that can't be confused with each other (no 0/o, 1/l).
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export function newInboxToken() {
  return [...randomBytes(10)].map(byte => ALPHABET[byte % ALPHABET.length]).join('')
}
export const inboxAddress = (token: string) => `trips-${token}@${INBOX_DOMAIN}`

// The token from one of the addresses a message was sent to.
export function tokenFrom(addresses: string[]) {
  for (const address of addresses) {
    const match = /trips-([a-z0-9]{6,40})@/i.exec(address)
    if (match && address.toLowerCase().includes(`@${INBOX_DOMAIN}`)) return match[1].toLowerCase()
  }
  return null
}

// "Jen Rosenthal <jen@example.com>" → jen@example.com
export function emailOf(value: string) {
  const match = /<([^>]+)>/.exec(value)
  return (match ? match[1] : value).trim().toLowerCase()
}
export const validEmail = (value: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) && value.length <= 254

// The message really comes from that address: the receiving server's Authentication-Results show DKIM or DMARC
// passing for the sender's own domain. A "From" line on its own can be typed by anyone.
export function authenticatedFrom(authenticationResults: string[], sender: string) {
  const domain = sender.split('@')[1]?.toLowerCase()
  if (!domain) return false
  const text = authenticationResults.join('; ').toLowerCase()
  const dmarc = /dmarc=pass[^;]*header\.from=([a-z0-9.-]+)/.exec(text)
  if (dmarc && (dmarc[1] === domain || domain.endsWith('.' + dmarc[1]))) return true
  for (const match of text.matchAll(/dkim=pass[^;]*header\.(?:d|i)=@?([a-z0-9.-]+)/g)) {
    if (match[1] === domain || domain.endsWith('.' + match[1])) return true
  }
  return false
}

// Webhooks from Resend are signed (Svix): HMAC-SHA256 of "id.timestamp.body" with the endpoint's secret, sent as
// "v1,<base64>" (several may be listed), within five minutes of the timestamp.
export function verifyWebhook(body: string, headers: Headers, secret: string, now = Date.now()) {
  const id = headers.get('svix-id'), timestamp = headers.get('svix-timestamp'), signatures = headers.get('svix-signature')
  if (!id || !timestamp || !signatures || !secret) return false
  if (!/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 5 * 60) return false
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest()
  return signatures.split(' ').some(part => {
    const [version, value] = part.split(',')
    if (version !== 'v1' || !value) return false
    const given = Buffer.from(value, 'base64')
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}

// A UUID made from a value, so a webhook delivered twice imports once (the import and new plan use it as their id).
export function stableId(value: string, salt: string) {
  const hex = createHmac('sha256', salt).update(value).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

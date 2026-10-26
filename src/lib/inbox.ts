import { createHmac, timingSafeEqual } from 'node:crypto'

// "Send trips to Postcard": each person has their own address, like jen.rosenthal@in.postcardtravel.app. Mail to it is read
// like Import notes or files and lands in their private plans (see api/inbound-email). Only mail that is really from
// them (their account email or an address they added, and signed by its email provider) is used.
export const INBOX_DOMAIN = process.env.INBOX_DOMAIN || 'in.postcardtravel.app'

// The part before the @ is stored whole: a name the person picks or we suggest (jen.rosenthal), or, for the first
// addresses, trips- and ten random letters. Names are safe to guess: only mail signed by the person's own email
// account is used, so a stranger who knows the address can't add anything.
export const inboxAddress = (local: string) => `${local}@${INBOX_DOMAIN}`

// Words that would look official, or that mail servers use themselves.
const RESERVED = new Set(['admin', 'administrator', 'abuse', 'billing', 'help', 'hello', 'hostmaster', 'info', 'mail', 'mailer-daemon', 'no-reply', 'noreply', 'postcard', 'postcardtravel', 'postmaster', 'privacy', 'root', 'security', 'support', 'team', 'trips', 'webmaster'])

// A name someone typed, made into an address: lowercase letters, numbers, dots and dashes, 3–30 long. Returns the
// cleaned name, or why it can't be used.
export function cleanInboxName(value: string): { name: string } | { error: string } {
  const name = value.trim().toLowerCase().replace(new RegExp(`@${INBOX_DOMAIN.replace(/\./g, '\\.')}$`), '').replace(/\s+/g, '.')
  if (!/^[a-z0-9][a-z0-9.-]{1,28}[a-z0-9]$/.test(name) || /\.\.|--|\.-|-\./.test(name)) return { error: 'Use 3–30 letters or numbers, with dots or dashes between them.' }
  if (RESERVED.has(name) || /^trips-/.test(name)) return { error: 'That name is reserved. Try another.' }
  return { name }
}

// A suggestion from the person's name ("Jen Rosenthal" → jen.rosenthal), else their email's first part.
export function suggestedInboxName(personName: string | null | undefined, email: string) {
  const plain = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').replace(/\.{2,}/g, '.')
  const fromName = plain(personName ?? '').split('.').filter(Boolean).slice(0, 3).join('.')
  const base = (fromName.length >= 3 ? fromName : plain(email.split('@')[0])).slice(0, 26).replace(/\.+$/, '')
  return base.length >= 3 && !RESERVED.has(base) ? base : `traveler.${base || 'trips'}`.slice(0, 26)
}

// The address's own name from the addresses a message was sent to.
export function tokenFrom(addresses: string[]) {
  for (const address of addresses) {
    const match = new RegExp(`([a-z0-9][a-z0-9.-]{1,38}[a-z0-9])@${INBOX_DOMAIN.replace(/\./g, '\\.')}`, 'i').exec(address)
    if (match) return match[1].toLowerCase()
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

// One emailed import's ids, all from the reference in its reply's links: the places it added (ids "<import>:<n>")
// and the plan it started, if it started one.
export const inboxRefs = (ref: string) => ({ ref, import: stableId(ref, 'import'), plan: stableId(ref, 'plan') })

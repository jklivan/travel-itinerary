import mammoth from 'mammoth'
import { prisma } from '@/lib/prisma'
import { actAs } from '@/lib/actingUser'
import { extractFromImageBase64, extractFromPdfBuffer, extractFromText, extractPrompt, type ExtractedItinerary } from '@/lib/extractItinerary'
import { importedPlaces, type ImportedPlace } from '@/lib/planImport'
import { isDate, daysBetween } from '@/lib/placeDates'
import { samePlanDestination } from '@/lib/planPlaceIdentity'
import { authenticatedFrom, emailOf, inboxRefs, stableId, tokenFrom } from '@/lib/inbox'
import { sendEmail } from '@/lib/email'
import { startPlan } from '@/actions/planning'
import { importIntoPlan } from '@/actions/planImport'

// One email sent to someone's "Send trips to Postcard" address: check it's really from them, read it and its
// attachments like Import notes or files, and add the places to the private plan it belongs to (or a new one).
type Received = { from: string; to: string[]; subject?: string; text?: string | null; html?: string | null; headers?: Record<string, string | string[]> | null; raw?: { download_url?: string } | null }
type Attachment = { filename?: string; content_type?: string; content_disposition?: string | null; size?: number; download_url?: string }

const RESEND = 'https://api.resend.com'
const MAX_ATTACHMENTS = 10
const MAX_BYTES = 20 * 1024 * 1024
const log = (...parts: unknown[]) => console.log('[inbox]', ...parts)

async function resend<T>(path: string): Promise<T> {
  const response = await fetch(`${RESEND}${path}`, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Resend ${path}: ${response.status}`)
  return response.json() as Promise<T>
}

// The receiving server's Authentication-Results: from the headers Resend gives, else from the start of the raw email.
async function authenticationResults(email: Received) {
  const fromHeaders = Object.entries(email.headers ?? {}).filter(([name]) => name.toLowerCase() === 'authentication-results').flatMap(([, value]) => [value].flat())
  if (fromHeaders.length || !email.raw?.download_url) return fromHeaders
  const raw = await fetch(email.raw.download_url, { signal: AbortSignal.timeout(20_000) }).then(response => response.ok ? response.text() : '').catch(() => '')
  const end = raw.search(/\r?\n\r?\n/)
  const head = raw.slice(0, end > 0 ? end : 65536).replace(/\r?\n[ \t]+/g, ' ')
  return head.split(/\r?\n/).filter(line => /^authentication-results:/i.test(line)).map(line => line.replace(/^authentication-results:\s*/i, ''))
}

const plainText = (html: string) => html.replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim()

// Each readable part of the email: its text, then PDFs, photos and documents attached to it.
async function readEmail(emailId: string, email: Received) {
  const prompt = extractPrompt(true, [])
  const parts: ExtractedItinerary[] = []
  const body = [email.subject ? `Subject: ${email.subject}` : '', email.text?.trim() || (email.html ? plainText(email.html) : '')].filter(Boolean).join('\n\n').slice(0, 40000)
  if (body.replace(/Subject:.*/, '').trim().length > 20) parts.push(await extractFromText(body, prompt))
  const listed = await resend<{ data?: Attachment[] }>(`/emails/receiving/${emailId}/attachments?limit=${MAX_ATTACHMENTS}`).catch(() => ({ data: [] as Attachment[] }))
  for (const file of listed.data ?? []) {
    const type = (file.content_type ?? '').toLowerCase()
    // Inline pictures are signatures and logos, not travel documents.
    if (!file.download_url || (file.size ?? 0) > MAX_BYTES || (file.content_disposition === 'inline' && type.startsWith('image/'))) continue
    try {
      const buffer = Buffer.from(await (await fetch(file.download_url, { signal: AbortSignal.timeout(60_000) })).arrayBuffer())
      if (type.includes('pdf')) parts.push(await extractFromPdfBuffer(buffer, file.filename || 'attachment.pdf', prompt))
      else if (/^image\/(jpeg|png|webp|gif)$/.test(type) && buffer.length > 30_000) parts.push(await extractFromImageBase64(buffer.toString('base64'), type, prompt))
      else if (type.includes('wordprocessingml')) parts.push(await extractFromText((await mammoth.extractRawText({ buffer })).value, prompt))
      else if (type.startsWith('text/')) parts.push(await extractFromText(buffer.toString('utf8').slice(0, 40000), prompt))
    } catch (error) { log('attachment skipped', file.filename, error instanceof Error ? error.message : error) }
  }
  return parts
}

// The trip's dates: from the documents when they give them, else the earliest and latest booking dates.
function datesOf(parts: ExtractedItinerary[], places: ImportedPlace[]) {
  const stated = parts.find(part => isDate(part.startDate) && isDate(part.endDate) && part.endDate! >= part.startDate!)
  if (stated) return { start: stated.startDate!, end: stated.endDate! }
  const dates = places.flatMap(place => [place.date, place.endDate]).filter((date): date is string => isDate(date)).sort()
  return dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null
}

// Which private plan this belongs to: one whose dates overlap (a day either side), else one already going to the
// same place with no dates that disagree. The most recently started wins.
async function matchingPlan(userId: string, dates: { start: string; end: string } | null, places: ImportedPlace[]) {
  const plans = await prisma.itinerary.findMany({ where: { userId, isPlan: true, visibility: 'draft' }, orderBy: { createdAt: 'desc' }, take: 50,
    select: { id: true, title: true, datesFlexible: true, startDate: true, endDate: true, destinations: { select: { name: true, country: true } } } })
  const day = (value: Date) => value.toISOString().slice(0, 10)
  const overlaps = (plan: (typeof plans)[number]) => !!dates && !plan.datesFlexible && daysBetween(day(plan.endDate), dates.start) <= 1 && daysBetween(dates.end, day(plan.startDate)) <= 1
  const sameWhere = (plan: (typeof plans)[number]) => plan.destinations.some(stop => stop.name !== 'Destination to decide' && places.some(place => samePlanDestination(stop, { name: place.destination, country: place.country })))
  return plans.find(overlaps) ?? plans.find(plan => sameWhere(plan) && (plan.datesFlexible || !dates || overlaps(plan))) ?? null
}

function reply(to: string, subject: string, lines: string[], links: { href: string; label: string }[] = []) {
  const text = [...lines, ...links.map(link => `${link.label}: ${link.href}`)].join('\n\n')
  const html = `<div style="font-family:Georgia,serif;color:#1f3354;line-height:1.5">${lines.map(line => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`).join('')}${links.map(link => `<p><a href="${link.href}" style="color:#1f3354">${link.label}</a></p>`).join('')}<p style="color:#6b7285;font-size:13px">Postcard · Send trips to Postcard</p></div>`
  return sendEmail({ to, subject, text, html })
}

export async function processInboundEmail(emailId: string, origin: string) {
  const email = await resend<Received>(`/emails/receiving/${emailId}`)
  const token = tokenFrom(email.to ?? [])
  if (!token) return log('no inbox address in', email.to)
  const user = await prisma.user.findUnique({ where: { inboxToken: token }, select: { id: true, email: true, inboxSenders: true } })
  if (!user) return log('unknown inbox')
  const sender = emailOf(email.from ?? '')
  // Only the person themselves (their account email or an address they added), and only if it's really them.
  const allowed = [user.email, ...user.inboxSenders].map(address => address.toLowerCase())
  if (!allowed.includes(sender)) return log('sender not allowed for this inbox')
  const results = await authenticationResults(email)
  if (!authenticatedFrom(results, sender)) return log('sender not authenticated', results.length ? 'results present' : 'no authentication results')

  const parts = await readEmail(emailId, email)
  const places = parts.flatMap(part => importedPlaces(part)).slice(0, 200)
  const subject = email.subject ? `Re: ${email.subject}` : 'Your trip in Postcard'
  if (!places.length) { await reply(sender, subject, ['Postcard couldn’t find any hotels, restaurants or things to do in that email. Send a booking confirmation or a trip summary that names the places and their towns.']); return }

  const dates = datesOf(parts, places)
  // This email's own ids: its import and any plan it starts, both found again from one reference in the reply's links.
  const refs = inboxRefs(stableId(emailId, 'inbox'))
  let plan: { id: string; title: string } | null = await matchingPlan(user.id, dates, places)
  const created = !plan
  if (!plan) {
    const title = parts.map(part => part.title?.trim()).find(Boolean)?.slice(0, 160) || `Trip to ${places[0].destination}`
    const form = new FormData()
    for (const [key, value] of Object.entries({ clientId: refs.plan, title, destination: '', audience: 'family', format: 'auto', startDate: dates?.start ?? '', endDate: dates?.end ?? '' })) form.set(key, value)
    const started = await actAs(user.id, () => startPlan(form))
    if (!started.id) { log('could not start plan', started.error); return }
    plan = { id: started.id, title }
  }
  const result = await actAs(user.id, () => importIntoPlan(plan.id, refs.import, places, dates))
  if (result.error) { log('import failed', result.error); return }
  log('imported', places.length, 'places')
  await reply(sender, subject, [`Added ${places.length} ${places.length === 1 ? 'place' : 'places'} to ${created ? 'a new private plan, ' : ''}“${plan.title}”. Places already in the trip were updated, not repeated.`,
    'Plans stay private until you post them.'], [{ href: `${origin}/plan/${plan.id}`, label: 'Open the trip' }, { href: `${origin}/inbox/${refs.ref}`, label: 'Wrong trip? Move these places, make them their own trip, or undo' }])
}

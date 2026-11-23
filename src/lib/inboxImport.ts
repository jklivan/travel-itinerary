import mammoth from 'mammoth'
import { dkimVerify } from 'mailauth'
import { prisma } from '@/lib/prisma'
import { actAs } from '@/lib/actingUser'
import { extractFromImageBase64, extractFromPdfBuffer, extractFromText, extractPrompt, type ExtractedItinerary } from '@/lib/extractItinerary'
import { importedPlaces, type ImportedPlace } from '@/lib/planImport'
import { isDate, daysBetween } from '@/lib/placeDates'
import { samePlanDestination } from '@/lib/planPlaceIdentity'
import { canEdit } from '@/lib/tripAccess'
import { geocode, geocodePlaceByName } from '@/lib/geocode'
import { locateDestinations } from '@/lib/locateDestinations'
import { distanceMiles } from '@/lib/distance'
import { authenticatedFrom, emailOf, inboxRefs, stableId, tokenFrom } from '@/lib/inbox'
import { sendEmail } from '@/lib/email'
import { startPlan } from '@/actions/planning'
import { importIntoPlan } from '@/actions/planImport'
import { noteImported } from '@/lib/importNotice'
import { after } from 'next/server'

// One email sent to someone's "Send trips to Postcard" address: check it's really from them, read it and its
// attachments like Import notes or files, and add the places to the private plan it belongs to (or a new one).
type Received = { from: string; to: string[]; subject?: string; text?: string | null; html?: string | null; headers?: Record<string, string | string[]> | null; raw?: { download_url?: string } | null }
type Attachment = { filename?: string; content_type?: string; content_disposition?: string | null; size?: number; download_url?: string }

const RESEND = 'https://api.resend.com'
const MAX_ATTACHMENTS = 10
const MAX_BYTES = 20 * 1024 * 1024
const INLINE_LOGO_BYTES = 100_000
const log = (...parts: unknown[]) => console.log('[inbox]', ...parts)

// One received email, from Resend (also for the page that approves an unknown sender).
export const receivedEmail = (emailId: string) => resend<Received>(`/emails/receiving/${emailId}`)

async function resend<T>(path: string): Promise<T> {
  const response = await fetch(`${RESEND}${path}`, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Resend ${path}: ${response.status}`)
  return response.json() as Promise<T>
}

// Who really sent it. Resend's receiving server doesn't stamp its own verdict on the email, so Postcard checks the
// sender's DKIM signature itself: the raw email's signature against the key the sender's domain publishes in DNS
// (as mail servers do). Any Authentication-Results already on the email are read too.
async function authenticationResults(email: Received) {
  const stamped = Object.entries(email.headers ?? {}).filter(([name]) => name.toLowerCase() === 'authentication-results').flatMap(([, value]) => [value].flat())
  if (!email.raw?.download_url) return stamped
  const raw = await fetch(email.raw.download_url, { signal: AbortSignal.timeout(20_000) }).then(response => response.ok ? response.arrayBuffer() : null).catch(() => null)
  if (!raw) { log('raw email unreadable'); return stamped }
  const verified = await dkimVerify(Buffer.from(raw)).catch(error => { log('dkim check failed', error instanceof Error ? error.message : error); return null })
  const results = (verified?.results ?? []).map(result => String(result.info ?? ''))
  log('dkim', results.map(result => result.split(' ').slice(0, 2).join(' ')).join(' · ') || 'no signatures')
  return [...stamped, ...results]
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
    log('attachment', type || 'no type', file.content_disposition ?? 'no disposition', file.size ?? 'size unknown')
    // Small inline pictures are signatures and logos, not travel documents. A screenshot sent from an iPhone's Mail
    // is inline too (shown in the email's text), but much bigger, so it's read.
    const logo = (bytes: number) => file.content_disposition === 'inline' && type.startsWith('image/') && bytes < INLINE_LOGO_BYTES
    if (!file.download_url || (file.size ?? 0) > MAX_BYTES || (file.size !== undefined && logo(file.size))) continue
    try {
      const buffer = Buffer.from(await (await fetch(file.download_url, { signal: AbortSignal.timeout(60_000) })).arrayBuffer())
      if (logo(buffer.length)) continue
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

// Where the emailed places are: the first hotel, restaurant or activity Google can find (a flight's places are
// airports, so they come last), else its town.
async function emailedArea(places: ImportedPlace[]) {
  const ordered = [...places.filter(place => place.type !== 'transport'), ...places.filter(place => place.type === 'transport')].slice(0, 3)
  for (const place of ordered) {
    const town = [place.destination, place.country].filter(Boolean).join(', ')
    const point = await geocodePlaceByName([place.name, town].filter(Boolean).join(', ')) ?? (town ? await geocode(town) : null)
    if (point) return point
  }
  return null
}

const NEAR_MILES = 50

// Which private plan this belongs to (yours, or a group plan you've joined), most recently started first:
// 1) its dates overlap (a day either side) and it's going to the same area (within 50 miles, or the same town name);
// 2) it's going to the same area and has no fixed dates, or the email has none;
// 3) its dates overlap and it has no destination yet, or the email's places couldn't be located.
// A plan whose dates overlap but is somewhere else isn't a match: the places start their own plan.
export async function matchingPlan(userId: string, dates: { start: string; end: string } | null, places: ImportedPlace[]) {
  const select = { id: true, title: true, datesFlexible: true, startDate: true, endDate: true,
    destinations: { select: { name: true, country: true, lat: true, lng: true, items: { where: { lat: { not: null } }, select: { lat: true, lng: true }, take: 1 } } } } as const
  const find = () => prisma.itinerary.findMany({ where: { ...canEdit(userId), isPlan: true, visibility: 'draft' }, orderBy: { createdAt: 'desc' }, take: 50, select })
  let plans = await find()
  const day = (value: Date) => value.toISOString().slice(0, 10)
  const overlaps = (plan: (typeof plans)[number]) => !!dates && !plan.datesFlexible && daysBetween(day(plan.endDate), dates.start) <= 1 && daysBetween(dates.end, day(plan.startDate)) <= 1
  const undated = (plan: (typeof plans)[number]) => plan.datesFlexible || !dates
  const stops = (plan: (typeof plans)[number]) => plan.destinations.filter(stop => stop.name !== 'Destination to decide')
  const where = (stop: (typeof plans)[number]['destinations'][number]) => stop.lat !== null && stop.lng !== null ? { lat: stop.lat, lng: stop.lng } : stop.items[0]?.lat != null && stop.items[0]?.lng != null ? { lat: stop.items[0].lat, lng: stop.items[0].lng } : null
  // Plans that could fit by date, with towns not yet on the map: put them on it first (a few at most).
  const unlocated = plans.filter(plan => (overlaps(plan) || undated(plan)) && stops(plan).some(stop => !where(stop))).slice(0, 5)
  if (unlocated.length) { await Promise.all(unlocated.map(plan => locateDestinations(plan.id).catch(() => {}))); plans = await find() }
  const area = await emailedArea(places)
  const near = (plan: (typeof plans)[number]) => stops(plan).some(stop => {
    const point = where(stop)
    if (area && point && distanceMiles(area, point) <= NEAR_MILES) return true
    return places.some(place => samePlanDestination(stop, { name: place.destination, country: place.country }))
  })
  return plans.find(plan => overlaps(plan) && near(plan))
    ?? plans.find(plan => undated(plan) && near(plan))
    ?? plans.find(plan => overlaps(plan) && (!stops(plan).length || !area))
    ?? null
}

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
function reply(to: string, subject: string, lines: string[], links: { href: string; label: string }[] = []) {
  const text = [...lines, ...links.map(link => `${link.label}: ${link.href}`)].join('\n\n')
  const html = `<div style="font-family:Georgia,serif;color:#1f3354;line-height:1.5">${lines.map(line => `<p>${escape(line)}</p>`).join('')}${links.map(link => `<p><a href="${escape(link.href)}" style="color:#1f3354">${escape(link.label)}</a></p>`).join('')}<p style="color:#6b7285;font-size:13px">Postcard · Send trips to Postcard</p></div>`
  return sendEmail({ to, subject, text, html })
}

// Emails held for an address the person hasn't added yet, kept as notifications with no trip (no list, count or push
// shows those): `inbox_held:<person>:<sender>:<email id>`.
const heldKey = (userId: string, sender: string) => `inbox_held:${userId}:${sender}:`

// From an address the person hasn't added (a travel agent, or an assistant's own address): nothing is read yet, but
// the email is held, and read once they add the address (by the emailed link or in Settings). The person is emailed
// a link that adds it (inbox/allow); the sender, when the email really is from them, hears it's waiting for approval.
// Those notes go at most once a day per sender, so a flood of mail sends one.
async function waitForApproval(emailId: string, email: Received, owner: { id: string; email: string }, sender: string, origin: string) {
  await prisma.notification.createMany({ data: [{ recipientId: owner.id, actorId: owner.id, kind: 'inbox_held', dedupeKey: heldKey(owner.id, sender) + emailId }], skipDuplicates: true }).catch(() => {})
  const day = new Date().toISOString().slice(0, 10)
  const marked = await prisma.notification.createManyAndReturn({ data: [{ recipientId: owner.id, actorId: owner.id, kind: 'inbox_waiting', dedupeKey: `inbox_waiting:${owner.id}:${sender}:${day}` }], skipDuplicates: true }).catch(() => [])
  if (!marked.length) return log('already asked about this sender today')
  await reply(owner.email, `Add ${sender} to your Postcard address?`, [
    `${sender} sent “${email.subject?.trim() || 'an email'}” to your Postcard address. Postcard only reads mail from you and addresses you’ve added, so nothing from it is in your trips yet.`,
    'If you know them (your travel agent, say), add their address and Postcard will read this email now. What they send after that goes straight in.',
    'If you don’t know them, you can ignore this.',
  ], [{ href: `${origin}/inbox/allow/${emailId}`, label: `Add ${sender} and read this email` }])
  if (authenticatedFrom(await authenticationResults(email), sender)) await reply(sender, email.subject ? `Re: ${email.subject}` : 'Your email to Postcard', [
    'This Postcard address only takes trips from its owner and the addresses they’ve added. We’ve asked them to add yours. Once they do, this email is read and its places go into their trips; you don’t need to send it again.',
  ])
}

// They've added `sender`: read what it sent while it wasn't allowed (the last 30 days, up to 10 emails), oldest first,
// as if each had just arrived. Returns how many it will read; the reading carries on in the background.
export async function readHeldEmails(userId: string, sender: string, origin: string, alsoEmailId?: string) {
  const since = new Date(Date.now() - 30 * 86_400_000)
  const held = await prisma.notification.findMany({ where: { recipientId: userId, kind: 'inbox_held', dedupeKey: { startsWith: heldKey(userId, sender) } }, orderBy: { createdAt: 'asc' }, select: { id: true, dedupeKey: true, createdAt: true } })
  await prisma.notification.deleteMany({ where: { id: { in: held.map(row => row.id) } } })
  const ids = [...new Set([...held.filter(row => row.createdAt >= since).map(row => row.dedupeKey.slice(heldKey(userId, sender).length)), ...(alsoEmailId ? [alsoEmailId] : [])])].slice(-10)
  after(async () => { for (const id of ids) await processInboundEmail(id, origin).catch(error => console.error('[inbox] failed', error instanceof Error ? error.message : error)) })
  return ids.length
}

export async function processInboundEmail(emailId: string, origin: string) {
  const email = await receivedEmail(emailId)
  const token = tokenFrom(email.to ?? [])
  if (!token) return log('no inbox address in', email.to)
  const user = await prisma.user.findUnique({ where: { inboxToken: token }, select: { id: true, email: true, inboxSenders: true } })
  if (!user) return log('unknown inbox')
  const sender = emailOf(email.from ?? '')
  // Only the person themselves (their account email or an address they added), and only if it's really them.
  const allowed = [user.email, ...user.inboxSenders].map(address => address.toLowerCase())
  if (!allowed.includes(sender)) { log('sender not allowed for this inbox'); return waitForApproval(emailId, email, user, sender, origin) }
  const results = await authenticationResults(email)
  if (!authenticatedFrom(results, sender)) return log('sender not authenticated', results.length ? 'results present' : 'no authentication results')

  const parts = await readEmail(emailId, email)
  const places = parts.flatMap(part => importedPlaces(part)).slice(0, 200)
  const subject = email.subject ? `Re: ${email.subject}` : 'Your trip in Postcard'
  // Sent by someone they added (their agent, say): the person hears what came of it too, and the sender gets a short note.
  const byOther = sender !== user.email.toLowerCase()
  if (!places.length) { await reply(byOther ? user.email : sender, byOther ? `Nothing found in ${sender}’s email` : subject, ['Postcard couldn’t find any hotels, restaurants or things to do in that email. Send a booking confirmation or a trip summary that names the places and their towns.']); return }

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
  // Marked as importing meanwhile, so the trip says so rather than showing no places (components/ImportingNotice).
  const planId = plan.id
  await prisma.itinerary.update({ where: { id: planId }, data: { importingSince: new Date() } })
  const result = await actAs(user.id, () => importIntoPlan(planId, refs.import, places, dates))
    .finally(() => prisma.itinerary.update({ where: { id: planId }, data: { importingSince: null } }).catch(() => {}))
  if (result.error) { log('import failed', result.error); return }
  log('imported', places.length, 'places')
  await noteImported(user.id, plan.id, created)
  // Bookings for places already in the trip on another day or time: the app asks which is right when it's opened.
  const checks = 'checks' in result && Array.isArray(result.checks) ? result.checks : []
  const checkLine = checks.length ? [`${checks.length === 1 ? `${checks[0]}’s booking is` : `The bookings for ${checks.slice(0, -1).join(', ')} and ${checks.at(-1)} are`} for a different day or time than your trip has. Open Postcard to choose which is right; it moves ${checks.length === 1 ? 'it' : 'them'} if you pick the booking.`] : []
  if (byOther) await reply(sender, subject, [`Added ${places.length} ${places.length === 1 ? 'place' : 'places'} to their Postcard trip “${plan.title}”. Thanks!`])
  await reply(user.email, byOther ? `${sender} added ${places.length === 1 ? 'a place' : 'places'} to “${plan.title}”` : subject, [`Added ${places.length} ${places.length === 1 ? 'place' : 'places'} to ${created ? 'a new private plan, ' : ''}“${plan.title}”. Places already in the trip were updated, not repeated.`,
    ...checkLine, 'Plans stay private until you post them.'], [{ href: `${origin}/plan/${plan.id}`, label: 'Open the trip' }, { href: `${origin}/inbox/${refs.ref}`, label: 'Wrong trip? Move these places, make them their own trip, or undo' }])
}

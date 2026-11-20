import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { auth } from '@/auth'
import { audienceLabel } from '@/lib/audience'
import { tripSeason } from '@/lib/tripSeason'
import { tripLocationLabel } from '@/lib/tripLocation'
import { TRIP_STAMPS, STAMP_COLORS } from '@/lib/tripStamps'
import { tripSharePhotos } from '@/lib/tripSharePhotos'

export const maxDuration = 60

// A trip as an Instagram-ready picture (components/ShareToInstagram): POSTCARD and a headline ("5 days in Paris") over
// the trip's card as the feed shows it (its photo with who it was with, the Must go! stamp, where, the title, how long,
// who posted it). ?format=story (9:16) or post (4:5); ?style=photo (the chosen picture also fills the background) or
// plain (cream); ?photo= one of the trip's own photos (anything else falls back to its cover), or POST a picture from
// the phone. A Story leaves its bottom clear for Instagram's Link sticker back to the trip; a post says where to find it.
// Colours are the palette's (globals.css), written out because the image is drawn outside the page.
const ink = '#1f3354', link = '#3f5a80', brown = '#8b6f4e', paper = '#f7f3ec', card = '#fffdf7', lineSoft = '#e3dccf', avatar = '#4d6a8c'
const SIZES = { story: { width: 1080, height: 1920, card: 880 }, post: { width: 1080, height: 1350, card: 720 } }

// The fonts the feed card uses: Playfair (titles) and Geist (labels). The site's own Playfair (public/fonts) is a
// variable font, which the image drawing can't read, so both come from Google Fonts as plain .ttf files, kept between
// requests.
const fontCache = new Map<string, Promise<ArrayBuffer>>()
function googleFont(family: string, weight: number) {
  const key = `${family}:${weight}`
  if (!fontCache.has(key)) fontCache.set(key, fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}`).then(response => response.text())
    .then(css => { const url = css.match(/url\((https:[^)]+\.ttf)\)/)?.[1]; if (!url) throw new Error(`No ${family} font`); return fetch(url) })
    .then(response => response.arrayBuffer())
    .catch(error => { fontCache.delete(key); throw error }))
  return fontCache.get(key)!
}

// The picture, upright and not too big, as a data address the drawing can use: phone photos are often stored sideways
// with a note saying which way is up, which the drawing ignores (a portrait photo came out on its side).
async function upright(source: ArrayBuffer, size = 1600) {
  const jpeg = await sharp(Buffer.from(source)).rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}

type Trip = NonNullable<Awaited<ReturnType<typeof tripSharePhotos>>>['trip']
const lengthOf = (trip: Trip) => trip.durationDays ?? (trip.datesFlexible ? null : Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / 86_400_000) + 1)
// The headline over the card: "5 days in Paris", or the trip's name when there's no length or place. People can write
// their own (?headline=), up to 80 characters.
function headlineFor(trip: Trip, asked: string | null) {
  const own = asked?.replace(/\s+/g, ' ').trim().slice(0, 80)
  if (own) return own
  const town = tripLocationLabel(trip.destinations)?.split(',')[0]?.trim() || null
  const days = lengthOf(trip)
  return days && days > 0 && town ? `${days} ${days === 1 ? 'day' : 'days'} in ${town}` : trip.title
}

// GET: one of the trip's own pictures (?photo=, else its cover); ?info=1 answers with just the headline it would use.
// POST: a picture from the phone (form field "photo").
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const search = new URL(request.url).searchParams
  const id = (await params).id
  if (search.get('info') === '1') {
    const userId = (await auth())?.user?.id
    const found = userId ? await tripSharePhotos(id, userId) : null
    return found ? Response.json({ headline: headlineFor(found.trip, null) }) : Response.json({ error: 'This trip is unavailable.' }, { status: 404 })
  }
  return draw(request, id, search.get('format'), search.get('style'), search.get('headline'), { url: search.get('photo') })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const form = await request.formData().catch(() => null)
  const file = form?.get('photo')
  if (!(file instanceof File) || file.size > 4_000_000 || !file.type.startsWith('image/')) return Response.json({ error: 'Choose a photo under 4 MB.' }, { status: 400 })
  return draw(request, (await params).id, String(form?.get('format') ?? ''), String(form?.get('style') ?? ''), String(form?.get('headline') ?? ''), { upload: await file.arrayBuffer() })
}

async function draw(request: Request, id: string, formatAsked: string | null, styleAsked: string | null, headlineAsked: string | null, chosen: { url?: string | null; upload?: ArrayBuffer }) {
  const userId = (await auth())?.user?.id
  if (!userId) return Response.json({ error: 'Please sign in.' }, { status: 401 })
  const format = formatAsked === 'post' ? 'post' : 'story'
  const style = styleAsked === 'plain' ? 'plain' : 'photo'
  const size = SIZES[format]
  const found = await tripSharePhotos(id, userId)
  if (!found) return Response.json({ error: 'This trip is unavailable.' }, { status: 404 })
  const { trip, photos } = found

  const origin = new URL(request.url).origin
  const absolute = (url: string | null | undefined) => !url ? null : url.startsWith('/') ? `${origin}${url}` : url
  const fetchBytes = (url: string | null) => url ? fetch(url).then(response => response.ok ? response.arrayBuffer() : null).catch(() => null) : Promise.resolve(null)
  const address = absolute(chosen.url && photos.includes(chosen.url) ? chosen.url : photos[0])
  const [source, face, playfair, geist] = await Promise.all([
    chosen.upload ? Promise.resolve(chosen.upload) : fetchBytes(address),
    fetchBytes(absolute(trip.user.image)),
    googleFont('Playfair Display', 400), googleFont('Geist', 500),
  ])
  const photo = source ? await upright(source).catch(() => null) : null
  const authorPhoto = face ? await upright(face, 200).catch(() => null) : null

  const where = tripLocationLabel(trip.destinations)
  const days = lengthOf(trip)
  const season = tripSeason({ startDate: trip.startDate, endDate: trip.endDate, datesFlexible: trip.datesFlexible, postType: trip.postType, bestMonths: trip.bestMonths })
  const audience = audienceLabel(trip.audience)
  const stamp = TRIP_STAMPS.find(entry => entry.value === trip.tripRating)
  const headline = headlineFor(trip, headlineAsked)
  const story = format === 'story'
  const onPhoto = style === 'photo'
  const words = onPhoto ? '#fff' : ink
  const cardWidth = size.card
  const photoHeight = Math.round((cardWidth - 44) * 0.75)
  const initials = trip.user.name.split(/\s+/).map(part => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  const brand = <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: onPhoto ? '#fff' : brown }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <div style={{ display: 'flex', width: 60, height: 2, background: 'currentColor', opacity: 0.6 }} />
      <div style={{ display: 'flex', fontFamily: 'Playfair', fontSize: 34, letterSpacing: 12 }}>POSTCARD</div>
      <div style={{ display: 'flex', width: 60, height: 2, background: 'currentColor', opacity: 0.6 }} />
    </div>
    <div style={{ display: 'flex', marginTop: 8, fontFamily: 'Playfair', fontSize: 18, letterSpacing: 7 }}>PLACES WORTH SHARING</div>
  </div>

  // The trip's card, as the feed shows it.
  const tripCard = <div style={{ display: 'flex', flexDirection: 'column', width: cardWidth, padding: 22, background: card, border: `2px solid ${lineSoft}`, borderRadius: 18, boxShadow: '0 20px 50px rgba(15,25,45,0.25)' }}>
    <div style={{ display: 'flex', position: 'relative', width: cardWidth - 44, height: photoHeight, borderRadius: 14, overflow: 'hidden', background: lineSoft }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo && <img src={photo} alt="" width={cardWidth - 44} height={photoHeight} style={{ width: cardWidth - 44, height: photoHeight, objectFit: 'cover' }} />}
      {audience && <div style={{ display: 'flex', position: 'absolute', top: 22, left: 22, padding: '8px 20px', borderRadius: 12, background: 'rgba(250,247,241,0.95)', color: ink, fontSize: 22, letterSpacing: 3 }}>{audience.toUpperCase()}</div>}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', padding: '24px 6px 0' }}>
      {stamp && <div style={{ display: 'flex', position: 'absolute', top: -44, right: 0, padding: 6, background: STAMP_COLORS[stamp.value], transform: 'rotate(-12deg)' }}>
        <div style={{ display: 'flex', padding: '8px 18px', border: '3px dashed rgba(255,255,255,0.85)', color: '#fff', fontSize: 26, letterSpacing: 3 }}>{stamp.label.toUpperCase()}</div>
      </div>}
      {where && <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: link, fontSize: 22, letterSpacing: 3, paddingRight: stamp ? 200 : 0 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={brown} strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
        {where.toUpperCase()}
      </div>}
      <div style={{ display: 'flex', marginTop: 10, fontFamily: 'Playfair', fontSize: story ? 46 : 40, lineHeight: 1.1, letterSpacing: 4, color: ink }}>{trip.title.toUpperCase()}</div>
      <div style={{ display: 'flex', marginTop: 10, color: link, fontSize: 22, letterSpacing: 3 }}>{days && days > 0 ? `${days}-DAY TRIP` : 'GUIDE'}</div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, paddingTop: 18, borderTop: `2px solid ${lineSoft}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {authorPhoto
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={authorPhoto} alt="" width={56} height={56} style={{ width: 56, height: 56, borderRadius: 28, objectFit: 'cover' }} />
          : <div style={{ display: 'flex', width: 56, height: 56, borderRadius: 28, background: avatar, color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{initials}</div>}
        <div style={{ display: 'flex', fontFamily: 'Playfair', fontSize: 22, letterSpacing: 3, color: link }}>{trip.user.name.toUpperCase()}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {season && <div style={{ display: 'flex', fontSize: 18, letterSpacing: 4, color: brown }}>{season.toUpperCase()}</div>}
        {trip.budget && trip.budget > 0 && <div style={{ display: 'flex', fontSize: 22 }}>{[1, 2, 3, 4, 5].map(n => <span key={n} style={{ color: n <= trip.budget! ? ink : '#b3a78e' }}>$</span>)}</div>}
      </div>
    </div>
  </div>

  const page = <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: onPhoto ? ink : paper, fontFamily: 'Geist' }}>
    {/* Photo: the picture fills the background, darkened at the top so the words read. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {onPhoto && photo && <img src={photo} alt="" width={size.width} height={size.height} style={{ position: 'absolute', top: 0, left: 0, width: size.width, height: size.height, objectFit: 'cover' }} />}
    {onPhoto && <div style={{ position: 'absolute', top: 0, left: 0, width: size.width, height: size.height, display: 'flex', backgroundImage: 'linear-gradient(to bottom, rgba(15,25,45,0.6) 0%, rgba(15,25,45,0.2) 35%, rgba(15,25,45,0.1) 70%, rgba(15,25,45,0.35) 100%)' }} />}
    <div style={{ position: 'absolute', top: 28, left: 28, right: 28, bottom: 28, display: 'flex', border: onPhoto ? '3px solid rgba(255,255,255,0.85)' : `3px solid ${lineSoft}` }} />
    <div style={{ position: 'absolute', top: 0, left: 0, width: size.width, height: size.height, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: story ? '110px 80px 300px' : '64px 80px 60px', color: words }}>
      {brand}
      <div style={{ display: 'flex', marginTop: story ? 48 : 26, fontFamily: 'Playfair', fontSize: headline.length > 30 ? (story ? 64 : 52) : (story ? 84 : 66), lineHeight: 1.08, textAlign: 'center', justifyContent: 'center', textShadow: onPhoto ? '0 2px 18px rgba(0,0,0,0.35)' : 'none' }}>{headline}</div>
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: story ? 40 : 24 }}>{tripCard}</div>
      {/* Where to find the trip, as plain words: anything drawn into the picture can't be tapped, so it mustn't look like
          a link (a pill with a link icon did, and confused people). The real link is the Link sticker they add. */}
      {!story && <div style={{ display: 'flex', marginTop: 26, fontFamily: 'Playfair', fontSize: 32, textShadow: onPhoto ? '0 1px 10px rgba(0,0,0,0.5)' : 'none' }}>See the whole trip on postcardtravel.app</div>}
    </div>
  </div>

  try {
    return new ImageResponse(page, { width: size.width, height: size.height, headers: { 'Cache-Control': 'private, max-age=300' },
      fonts: [{ name: 'Playfair', data: playfair, weight: 400, style: 'normal' }, { name: 'Geist', data: geist, weight: 500, style: 'normal' }] })
  } catch (error) {
    console.error('[share-image] failed', error)
    return Response.json({ error: 'Could not make the picture.' }, { status: 500 })
  }
}

import { ImageResponse } from 'next/og'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canEdit } from '@/lib/tripAccess'
import { audienceLabel } from '@/lib/audience'
import { tripSeason } from '@/lib/tripSeason'
import { getRecommendation } from '@/lib/placeRecommendation'

export const maxDuration = 60

// A posted trip as an Instagram-ready picture (components/ShareToInstagram): its cover photo as a polaroid, the title,
// where and when, its best places, and "See the whole trip on Postcard". ?format=story (9:16, for a Story with a link
// sticker) or post (4:5). Posted trips for anyone signed in; private plans only for the people planning them.
// Colours are the palette's (globals.css), written out because the image is drawn outside the page.
const ink = '#1f3354', muted = '#6b7285', brown = '#8b6f4e', paper = '#f7f3ec', card = '#fffdf7', line = '#d7cebc', stamp = '#6f8b6e'
const SIZES = { story: { width: 1080, height: 1920, photo: 840, places: 5 }, post: { width: 1080, height: 1350, photo: 560, places: 4 } }

// Playfair for the title. The site's own copy (public/fonts) is a variable font, which the image drawing can't read,
// so the regular weight comes from Google Fonts (asked for plainly, it answers with a .ttf), kept between requests.
let playfairCache: Promise<ArrayBuffer> | null = null
function playfairFont() {
  playfairCache ??= fetch('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400').then(response => response.text())
    .then(css => { const url = css.match(/url\((https:[^)]+\.ttf)\)/)?.[1]; if (!url) throw new Error('No Playfair font'); return fetch(url) })
    .then(response => response.arrayBuffer())
    .catch(error => { playfairCache = null; throw error })
  return playfairCache
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = (await auth())?.user?.id
  if (!userId) return Response.json({ error: 'Please sign in.' }, { status: 401 })
  const { id } = await params
  const format = new URL(request.url).searchParams.get('format') === 'post' ? 'post' : 'story'
  const size = SIZES[format]
  const trip = await prisma.itinerary.findFirst({
    where: { id, OR: [{ visibility: 'public' }, canEdit(userId)] },
    select: { title: true, audience: true, postType: true, bestMonths: true, datesFlexible: true, startDate: true, endDate: true, durationDays: true, coverPhoto: true,
      photos: { select: { url: true, isStock: true } },
      destinations: { orderBy: { order: 'asc' }, select: { name: true, country: true, items: { orderBy: { order: 'asc' }, select: { name: true, type: true, tags: true, rating: true, photoUrl: true, photoUrls: true } } } } },
  })
  if (!trip) return Response.json({ error: 'This trip is unavailable.' }, { status: 404 })

  const origin = new URL(request.url).origin
  const absolute = (url: string | null | undefined) => !url ? null : url.startsWith('/') ? `${origin}${url}` : url
  const items = trip.destinations.flatMap(destination => destination.items)
  // The cover the trip shows: the chosen one, then its own photos, its places' photos, then a stock photo.
  const cover = absolute(trip.coverPhoto ?? trip.photos.find(photo => !photo.isStock)?.url ?? items.flatMap(item => item.photoUrls.length ? item.photoUrls : item.photoUrl ? [item.photoUrl] : [])[0] ?? trip.photos[0]?.url)
  // Its best places: Must go! first, then the best rated, in the trip's order; no transport, backups or avoids.
  const places = items.filter(item => item.type !== 'transport' && !['option', 'avoid'].includes(getRecommendation(item.tags)))
    .map((item, order) => ({ name: item.name, must: getRecommendation(item.tags) === 'must', rating: item.rating ?? 0, order }))
    .sort((a, b) => Number(b.must) - Number(a.must) || b.rating - a.rating || a.order - b.order).slice(0, size.places)
  const where = [...new Set(trip.destinations.filter(destination => destination.name !== 'Destination to decide').map(destination => destination.name))].slice(0, 2).join(' & ')
  const days = trip.durationDays ?? (trip.datesFlexible ? null : Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / 86_400_000) + 1)
  const season = tripSeason({ startDate: trip.startDate, endDate: trip.endDate, datesFlexible: trip.datesFlexible, postType: trip.postType, bestMonths: trip.bestMonths })
  const details = [where, days && days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}` : null, audienceLabel(trip.audience), season].filter(Boolean).join(' · ')

  const playfair = await playfairFont()
  // The site's own logo, by address (a server function can't read the public folder directly).
  const logoSrc = `${origin}/brand/postcard-stamp-logo.png`

  try {
    return new ImageResponse(
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', background: paper, padding: format === 'story' ? '110px 80px 90px' : '60px 80px 56px', color: ink }}>
        <div style={{ display: 'flex', fontFamily: 'Playfair', fontSize: 30, letterSpacing: 10, color: brown }}>POSTCARD</div>
        {cover && <div style={{ display: 'flex', marginTop: format === 'story' ? 56 : 32, padding: '22px 22px 70px', background: card, border: `2px solid ${line}`, boxShadow: '0 18px 40px rgba(31,51,84,0.18)', transform: 'rotate(-2deg)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" width={size.photo} height={Math.round(size.photo * 0.78)} style={{ objectFit: 'cover' }} />
        </div>}
        <div style={{ display: 'flex', marginTop: format === 'story' ? 64 : 40, fontFamily: 'Playfair', fontSize: format === 'story' ? 78 : 66, lineHeight: 1.1, textAlign: 'center', justifyContent: 'center' }}>{trip.title}</div>
        {details && <div style={{ display: 'flex', marginTop: 18, fontSize: 30, color: muted, textAlign: 'center' }}>{details}</div>}
        {places.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'stretch', marginTop: format === 'story' ? 52 : 34, padding: '8px 0', borderTop: `2px solid ${line}` }}>
          {places.map(place => <div key={place.order} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 4px', borderBottom: `1px solid ${line}` }}>
            <div style={{ display: 'flex', fontSize: 34, maxWidth: 700 }}>{place.name}</div>
            {place.must && <div style={{ display: 'flex', padding: '6px 16px', border: `3px dashed ${stamp}`, color: stamp, fontSize: 22, fontWeight: 700, letterSpacing: 2, transform: 'rotate(-4deg)' }}>MUST GO!</div>}
          </div>)}
        </div>}
        <div style={{ display: 'flex', flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="" width={96} height={96} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 32 }}>See the whole trip on Postcard</div>
            <div style={{ display: 'flex', fontSize: 28, color: brown }}>postcardtravel.app</div>
          </div>
        </div>
      </div>,
      { width: size.width, height: size.height, fonts: [{ name: 'Playfair', data: playfair, weight: 400, style: 'normal' }], headers: { 'Cache-Control': 'private, max-age=300' } },
    )
  } catch (error) {
    console.error('[share-image] failed', error)
    return Response.json({ error: 'Could not make the picture.' }, { status: 500 })
  }
}

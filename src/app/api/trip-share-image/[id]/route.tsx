import { ImageResponse } from 'next/og'
import { auth } from '@/auth'
import { audienceLabel } from '@/lib/audience'
import { tripSeason } from '@/lib/tripSeason'
import { tripSharePhotos } from '@/lib/tripSharePhotos'

export const maxDuration = 60

// A trip as an Instagram-ready picture (components/ShareToInstagram). ?format=story (9:16) or post (4:5);
// ?style=photo (the chosen picture fills it, the trip's name over it) or plain (cream, the name, the picture framed in
// the middle); ?photo= one of the trip's own photos (anything else falls back to its cover). The bottom is left clear for
// Instagram's Link sticker back to the trip. Colours are the palette's (globals.css), written out because the image is
// drawn outside the page.
const ink = '#1f3354', brown = '#8b6f4e', muted = '#6b7285', paper = '#f7f3ec', card = '#fffdf7', line = '#d7cebc'
const SIZES = { story: { width: 1080, height: 1920 }, post: { width: 1080, height: 1350 } }

// Playfair for the words. The site's own copy (public/fonts) is a variable font, which the image drawing can't read,
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
  const search = new URL(request.url).searchParams
  const format = search.get('format') === 'post' ? 'post' : 'story'
  const style = search.get('style') === 'plain' ? 'plain' : 'photo'
  const size = SIZES[format]
  const found = await tripSharePhotos(id, userId)
  if (!found) return Response.json({ error: 'This trip is unavailable.' }, { status: 404 })
  const { trip, photos } = found

  const origin = new URL(request.url).origin
  const absolute = (url: string | undefined) => !url ? null : url.startsWith('/') ? `${origin}${url}` : url
  const asked = search.get('photo')
  const photo = absolute(asked && photos.includes(asked) ? asked : photos[0])
  const where = [...new Set(trip.destinations.filter(destination => destination.name !== 'Destination to decide').map(destination => destination.name))].slice(0, 2).join(' & ')
  const days = trip.durationDays ?? (trip.datesFlexible ? null : Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / 86_400_000) + 1)
  const season = tripSeason({ startDate: trip.startDate, endDate: trip.endDate, datesFlexible: trip.datesFlexible, postType: trip.postType, bestMonths: trip.bestMonths })
  const details = [where, days && days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}` : null, audienceLabel(trip.audience), season].filter(Boolean).join(' · ')
  const playfair = await playfairFont()
  // The site's own logo, by address (a server function can't read the public folder directly).
  const logo = `${origin}/brand/postcard-stamp-logo.png`
  const story = format === 'story'
  const titleSize = trip.title.length > 34 ? (story ? 76 : 64) : (story ? 96 : 80)
  // The empty strip at the bottom where the Link sticker goes.
  const stickerRoom = story ? 300 : 170

  const brand = (color: string) => <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, color }}>
    <div style={{ display: 'flex', width: 60, height: 2, background: color, opacity: 0.6 }} />
    <div style={{ display: 'flex', fontSize: 34, letterSpacing: 12 }}>POSTCARD</div>
    <div style={{ display: 'flex', width: 60, height: 2, background: color, opacity: 0.6 }} />
  </div>

  const photoStyle = <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: ink }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {photo && <img src={photo} alt="" width={size.width} height={size.height} style={{ position: 'absolute', top: 0, left: 0, width: size.width, height: size.height, objectFit: 'cover' }} />}
    {/* Darker at the top (and a little at the bottom), so white words read on any photo. */}
    <div style={{ position: 'absolute', top: 0, left: 0, width: size.width, height: size.height, display: 'flex', backgroundImage: 'linear-gradient(to bottom, rgba(15,25,45,0.62) 0%, rgba(15,25,45,0.15) 38%, rgba(15,25,45,0) 60%, rgba(15,25,45,0.25) 100%)' }} />
    <div style={{ position: 'absolute', top: 28, left: 28, right: 28, bottom: 28, display: 'flex', border: '3px solid rgba(255,255,255,0.85)' }} />
    <div style={{ position: 'absolute', top: story ? 130 : 90, left: 80, right: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#fff' }}>
      {brand('#fff')}
      <div style={{ display: 'flex', marginTop: story ? 60 : 40, fontSize: titleSize, lineHeight: 1.08, textAlign: 'center', justifyContent: 'center', textShadow: '0 2px 18px rgba(0,0,0,0.35)' }}>{trip.title}</div>
      {details && <div style={{ display: 'flex', marginTop: 22, fontSize: 32, textAlign: 'center', textShadow: '0 1px 10px rgba(0,0,0,0.4)' }}>{details}</div>}
    </div>
  </div>

  const plainStyle = <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', background: paper, padding: `${story ? 120 : 76}px 80px ${stickerRoom}px`, color: ink, position: 'relative' }}>
    <div style={{ position: 'absolute', top: 28, left: 28, right: 28, bottom: 28, display: 'flex', border: `3px solid ${line}` }} />
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={logo} alt="" width={110} height={110} style={{ position: 'absolute', top: story ? 70 : 52, right: 70, opacity: 0.85 }} />
    {brand(brown)}
    <div style={{ display: 'flex', marginTop: story ? 70 : 40, fontSize: titleSize, lineHeight: 1.08, textAlign: 'center', justifyContent: 'center' }}>{trip.title}</div>
    {details && <div style={{ display: 'flex', marginTop: 20, fontSize: 30, color: muted, textAlign: 'center' }}>{details}</div>}
    {photo && <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', marginTop: story ? 60 : 36 }}>
      <div style={{ display: 'flex', padding: 18, background: card, border: `2px solid ${line}`, boxShadow: '0 18px 40px rgba(31,51,84,0.18)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="" width={story ? 860 : 700} height={story ? 900 : 560} style={{ objectFit: 'cover' }} />
      </div>
    </div>}
  </div>

  try {
    return new ImageResponse(style === 'photo' ? photoStyle : plainStyle,
      { width: size.width, height: size.height, fonts: [{ name: 'Playfair', data: playfair, weight: 400, style: 'normal' }], headers: { 'Cache-Control': 'private, max-age=300' } })
  } catch (error) {
    console.error('[share-image] failed', error)
    return Response.json({ error: 'Could not make the picture.' }, { status: 500 })
  }
}

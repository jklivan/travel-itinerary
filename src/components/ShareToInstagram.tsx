'use client'

import { useState } from 'react'
import { ImageUp } from 'lucide-react'
import { shareUrl } from '@/lib/publicUrl'

// A trip, as a picture for Instagram (api/trip-share-image). Choose the look (Photo: your picture fills it with the
// trip's name over it; Plain: cream with the picture framed) and which of the trip's pictures, then Story (tall, with
// room for a Link sticker back to the trip) or Post (4:5). The phone's share sheet opens with the picture, so Instagram
// is one tap away, and the trip's link is copied to paste into the Link sticker or the caption (Instagram posts can't
// hold a tappable link; Stories can). Without a share sheet (a computer) the picture downloads instead.
// align: which edge the panel lines up with (left when the button sits at the start of a line).
export default function ShareToInstagram({ tripId, title, photos, align = 'right' }: { tripId: string; title: string; photos: string[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const [look, setLook] = useState<'photo' | 'plain'>('photo')
  const [photo, setPhoto] = useState(photos[0] ?? '')
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  async function share(format: 'story' | 'post') {
    setBusy(format); setNote('')
    const link = shareUrl(`/itinerary/${tripId}`)
    // Copied first, while the tap still counts (phones only allow copying straight from one).
    const copied = await navigator.clipboard.writeText(format === 'story' ? link : `${title}: every place we loved is on Postcard. ${link}`).then(() => true, () => false)
    try {
      const query = new URLSearchParams({ format, style: look, ...(photo ? { photo } : {}) })
      const response = await fetch(`/api/trip-share-image/${tripId}?${query}`)
      if (!response.ok) throw new Error()
      const name = `${title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'postcard-trip'}-${format}.png`
      const file = new File([await response.blob()], name, { type: 'image/png' })
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
        await navigator.share({ files: [file] }).catch(() => {})
      } else {
        const url = URL.createObjectURL(file)
        const anchor = Object.assign(document.createElement('a'), { href: url, download: name })
        document.body.append(anchor); anchor.click(); anchor.remove()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
      setNote(!copied ? `Add this link: ${link}` : format === 'story' ? 'Link copied. In Instagram, add a Link sticker and paste it.' : 'Caption with the link copied. Paste it into your post.')
    } catch { setNote('Couldn’t make the picture. Please try again.') }
    finally { setBusy('') }
  }
  return <span className="relative inline-flex">
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="chip"><ImageUp size={14} />Instagram</button>
    {open && <div className={`panel absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] space-y-3 p-3 shadow-pop`}>
      <p className="text-sm text-ink">Share this trip as a picture on Instagram.</p>
      <div className="flex gap-2" role="group" aria-label="Look">
        <button type="button" aria-pressed={look === 'photo'} onClick={() => setLook('photo')} className="chip">Photo</button>
        <button type="button" aria-pressed={look === 'plain'} onClick={() => setLook('plain')} className="chip">Plain</button>
      </div>
      {photos.length > 1 && <div>
        <p className="field-label mb-1.5">Picture</p>
        <div className="flex gap-2 overflow-x-auto pb-1">{photos.slice(0, 24).map(url => <button key={url} type="button" aria-pressed={photo === url} aria-label="Use this picture" onClick={() => setPhoto(url)}
          className={`size-14 shrink-0 overflow-hidden rounded-lg border-2 ${photo === url ? 'border-ink' : 'border-transparent'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="size-full object-cover" />
        </button>)}</div>
      </div>}
      <div className="flex gap-2">
        <button type="button" disabled={!!busy} onClick={() => void share('story')} className="btn btn-primary btn-sm flex-1">{busy === 'story' ? 'Making…' : 'Story'}</button>
        <button type="button" disabled={!!busy} onClick={() => void share('post')} className="btn btn-outline btn-sm flex-1">{busy === 'post' ? 'Making…' : 'Post'}</button>
      </div>
      <p role="status" className="break-words text-xs text-muted">{note || 'A Story can link back to the trip with a Link sticker; we’ll copy the link for you.'}</p>
    </div>}
  </span>
}

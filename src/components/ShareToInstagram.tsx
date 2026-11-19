'use client'

import { useEffect, useState } from 'react'
import { ImagePlus, ImageUp } from 'lucide-react'
import { shareUrl } from '@/lib/publicUrl'
import { compressPhoto } from '@/lib/photoSizing'

// A trip, as a picture for Instagram (api/trip-share-image). Choose the headline, the look (Photo: your picture fills it;
// Plain: cream) and which picture, then Share to Instagram. One 4:5 picture works for everything Instagram offers next
// (Post, Story, Reel, Message), so it doesn't ask Story or Post twice: as a Story it sits mid-screen with room for a
// Link sticker. The phone's share sheet opens with the picture, and the trip's link is copied to paste into the Link
// sticker or the caption (posts can't hold a tappable link). Without a share sheet (a computer) it downloads instead.
// align: which edge the panel lines up with (left when the button sits at the start of a line).
export default function ShareToInstagram({ tripId, title, photos, align = 'right' }: { tripId: string; title: string; photos: string[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const [look, setLook] = useState<'photo' | 'plain'>('photo')
  const [photo, setPhoto] = useState(photos[0] ?? '')
  // A picture from the phone instead of one of the trip's (shrunk first, so it uploads quickly).
  const [upload, setUpload] = useState<{ file: File; preview: string } | null>(null)
  // The words over the picture: the automatic one ("5 days in Paris") until they write their own.
  const [headline, setHeadline] = useState('')
  useEffect(() => {
    if (!open || headline) return
    void fetch(`/api/trip-share-image/${tripId}?info=1`).then(response => response.ok ? response.json() : null).then(info => { if (info?.headline) setHeadline(current => current || info.headline) }, () => {})
  }, [open, headline, tripId])
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  async function share() {
    const format = 'post'
    setBusy(format); setNote('')
    const link = shareUrl(`/itinerary/${tripId}`)
    // Copied first, while the tap still counts (phones only allow copying straight from one).
    const copied = await navigator.clipboard.writeText(link).then(() => true, () => false)
    try {
      let response: Response
      if (upload) {
        const form = new FormData()
        form.set('format', format); form.set('style', look); form.set('headline', headline); form.set('photo', upload.file)
        response = await fetch(`/api/trip-share-image/${tripId}`, { method: 'POST', body: form })
      } else response = await fetch(`/api/trip-share-image/${tripId}?${new URLSearchParams({ format, style: look, headline, ...(photo ? { photo } : {}) })}`)
      if (!response.ok) throw new Error()
      const name = `${title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'postcard-trip'}.png`
      const file = new File([await response.blob()], name, { type: 'image/png' })
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
        await navigator.share({ files: [file] }).catch(() => {})
      } else {
        const url = URL.createObjectURL(file)
        const anchor = Object.assign(document.createElement('a'), { href: url, download: name })
        document.body.append(anchor); anchor.click(); anchor.remove()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
      setNote(!copied ? `Add this link: ${link}` : 'Link copied. On a Story, add a Link sticker and paste it; on a post, paste it into the caption.')
    } catch { setNote('Couldn’t make the picture. Please try again.') }
    finally { setBusy('') }
  }
  return <span className="relative inline-flex">
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="chip"><ImageUp size={14} />Instagram</button>
    {open && <div className={`panel absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] space-y-3 p-3 shadow-pop`}>
      <p className="text-sm text-ink">Share this trip as a picture on Instagram.</p>
      <label className="block"><span className="field-label mb-1.5 block">Headline</span>
        <input value={headline} onChange={event => setHeadline(event.target.value)} maxLength={80} placeholder="5 days in Paris" className="field w-full" /></label>
      <div className="flex gap-2" role="group" aria-label="Look">
        <button type="button" aria-pressed={look === 'photo'} onClick={() => setLook('photo')} className="chip">Photo</button>
        <button type="button" aria-pressed={look === 'plain'} onClick={() => setLook('plain')} className="chip">Plain</button>
      </div>
      <div>
        <p className="field-label mb-1.5">Picture</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {upload && <button type="button" aria-pressed="true" aria-label="Your picture" className="size-14 shrink-0 overflow-hidden rounded-lg border-2 border-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={upload.preview} alt="" className="size-full object-cover" />
          </button>}
          {photos.slice(0, 24).map(url => <button key={url} type="button" aria-pressed={!upload && photo === url} aria-label="Use this picture" onClick={() => { setUpload(null); setPhoto(url) }}
            className={`size-14 shrink-0 overflow-hidden rounded-lg border-2 ${!upload && photo === url ? 'border-ink' : 'border-transparent'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="size-full object-cover" />
          </button>)}
          {/* Any picture from the phone's library. */}
          <label className="panel-dashed flex size-14 shrink-0 cursor-pointer flex-col items-center justify-center text-link" aria-label="Choose a picture from your phone">
            <ImagePlus size={18} /><span className="text-label">Phone</span>
            <input type="file" accept="image/*" className="sr-only" onChange={event => { const chosen = event.target.files?.[0]; if (!chosen) return; void compressPhoto(chosen).then(file => setUpload({ file, preview: URL.createObjectURL(file) })) }} />
          </label>
        </div>
      </div>
      <button type="button" disabled={!!busy} onClick={() => void share()} className="btn btn-primary btn-sm w-full">{busy ? 'Making your picture…' : 'Share to Instagram'}</button>
      <p role="status" className="break-words text-xs text-muted">{note || 'Post it, or share it as a Story and add a Link sticker back to the trip; we’ll copy the link for you.'}</p>
    </div>}
  </span>
}

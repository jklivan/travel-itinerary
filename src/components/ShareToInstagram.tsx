'use client'

import { useState } from 'react'
import { ImageUp } from 'lucide-react'
import { shareUrl } from '@/lib/publicUrl'

// A posted trip, as a picture for Instagram (api/trip-share-image): a Story (tall, for a Link sticker back to the trip)
// or a post (4:5). The phone's share sheet opens with the picture, so Instagram is one tap away, and the trip's link is
// copied to paste into the Link sticker or the caption (Instagram posts can't hold a tappable link; Stories can).
// Without a share sheet (a computer) the picture downloads instead.
export default function ShareToInstagram({ tripId, title }: { tripId: string; title: string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  async function share(format: 'story' | 'post') {
    setBusy(format); setNote('')
    const link = shareUrl(`/itinerary/${tripId}`)
    // Copied first, while the tap still counts (phones only allow copying straight from one).
    const copied = await navigator.clipboard.writeText(format === 'story' ? link : `${title}: every place we loved is on Postcard. ${link}`).then(() => true, () => false)
    try {
      const response = await fetch(`/api/trip-share-image/${tripId}?format=${format}`)
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
    {open && <div className="panel absolute right-0 top-full z-30 mt-2 w-72 space-y-3 p-3 shadow-pop">
      <p className="text-sm text-ink">Share this trip as a picture on Instagram.</p>
      <div className="flex gap-2">
        <button type="button" disabled={!!busy} onClick={() => void share('story')} className="btn btn-primary btn-sm flex-1">{busy === 'story' ? 'Making…' : 'Story'}</button>
        <button type="button" disabled={!!busy} onClick={() => void share('post')} className="btn btn-outline btn-sm flex-1">{busy === 'post' ? 'Making…' : 'Post'}</button>
      </div>
      <p role="status" className="break-words text-xs text-muted">{note || 'A Story can link back to the trip with a Link sticker; we’ll copy the link for you.'}</p>
    </div>}
  </span>
}

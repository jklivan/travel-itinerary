'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { shareUrl } from '@/lib/publicUrl'
import { compressPhoto } from '@/lib/photoSizing'

// A trip, as a picture for Instagram (api/trip-share-image), in a sheet that slides up: the picture itself as a preview,
// which changes as they edit the headline, switch the look (Photo: their picture fills it; Plain: cream) or pick another
// picture, then Share to Instagram. One 4:5 picture works for everything Instagram offers next (Post, Story, Reel,
// Message), so it doesn't ask Story or Post twice: as a Story it sits mid-screen with room for a Link sticker. The
// phone's share sheet opens with the previewed picture, and the trip's link is copied to paste into the Link sticker or
// the caption (posts can't hold a tappable link). Without a share sheet (a computer) it downloads instead.
// Instagram's own logo (the icon set has no brand logos), so the button is recognisable at a glance.
function InstagramLogo({ size }: { size: number }) {
  const id = useId()
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <defs><radialGradient id={id} cx="0.3" cy="1.07" r="1.3"><stop offset="0" stopColor="#fdd56a" /><stop offset="0.25" stopColor="#f9a03f" /><stop offset="0.5" stopColor="#e1306c" /><stop offset="0.8" stopColor="#833ab4" /><stop offset="1" stopColor="#5b51d8" /></radialGradient></defs>
    <rect width="24" height="24" rx="6.5" fill={`url(#${id})`} />
    <rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.8" /><circle cx="16.4" cy="7.6" r="1" fill="#fff" />
  </svg>
}

export default function ShareToInstagram({ tripId, title, photos }: { tripId: string; title: string; photos: string[] }) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [look, setLook] = useState<'photo' | 'plain'>('photo')
  const [photo, setPhoto] = useState(photos[0] ?? '')
  // A picture from the phone instead of one of the trip's (shrunk first, so it uploads quickly).
  const [upload, setUpload] = useState<{ file: File; preview: string } | null>(null)
  // The words over the picture: the automatic one ("5 days in Paris") until they write their own. The preview waits
  // until they pause typing.
  const [headline, setHeadline] = useState('')
  const [settledHeadline, setSettledHeadline] = useState('')
  useEffect(() => { const timer = setTimeout(() => setSettledHeadline(headline), 600); return () => clearTimeout(timer) }, [headline])
  useEffect(() => {
    if (!open || headline) return
    void fetch(`/api/trip-share-image/${tripId}?info=1`).then(response => response.ok ? response.json() : null).then(info => { if (info?.headline) { setHeadline(current => current || info.headline); setSettledHeadline(current => current || info.headline) } }, () => {})
  }, [open, headline, tripId])
  // The picture as it will be shared, remade whenever a choice changes; sharing uses it as is.
  // Each set of choices has a key; the preview is up to date when its key matches the current one.
  const key = JSON.stringify([look, upload?.preview ?? photo, settledHeadline])
  const [preview, setPreview] = useState<{ blob: Blob; url: string; key: string } | null>(null)
  const [failed, setFailed] = useState('')
  const loading = open && !!settledHeadline && preview?.key !== key && failed !== key
  const error = failed === key ? 'Couldn’t make the picture. Please try again.' : ''
  useEffect(() => {
    if (!open || !settledHeadline) return
    const controller = new AbortController()
    const request = upload
      ? (() => { const form = new FormData(); form.set('format', 'post'); form.set('style', look); form.set('headline', settledHeadline); form.set('photo', upload.file); return fetch(`/api/trip-share-image/${tripId}`, { method: 'POST', body: form, signal: controller.signal }) })()
      : fetch(`/api/trip-share-image/${tripId}?${new URLSearchParams({ format: 'post', style: look, headline: settledHeadline, ...(photo ? { photo } : {}) })}`, { signal: controller.signal })
    void request.then(async response => {
      if (!response.ok) throw new Error()
      const blob = await response.blob()
      setPreview(current => { if (current) URL.revokeObjectURL(current.url); return { blob, url: URL.createObjectURL(blob), key } })
    }).catch(caught => { if ((caught as Error).name !== 'AbortError') setFailed(key) })
    return () => controller.abort()
  }, [open, look, photo, upload, settledHeadline, tripId, key])
  useEffect(() => { if (open) dialog.current?.showModal() }, [open])
  const [note, setNote] = useState('')

  async function share() {
    if (!preview) return
    setNote('')
    const link = shareUrl(`/itinerary/${tripId}`)
    // Copied first, while the tap still counts (phones only allow copying straight from one).
    const copied = await navigator.clipboard.writeText(link).then(() => true, () => false)
    const name = `${title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'postcard-trip'}.png`
    const file = new File([preview.blob], name, { type: 'image/png' })
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      await navigator.share({ files: [file] }).catch(() => {})
    } else {
      const anchor = Object.assign(document.createElement('a'), { href: preview.url, download: name })
      document.body.append(anchor); anchor.click(); anchor.remove()
    }
    setNote(!copied ? `Add this link: ${link}` : 'Link copied. On a Story, add a Link sticker and paste it; on a post, paste it into the caption.')
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="chip"><InstagramLogo size={18} />Instagram</button>
    {open && <dialog ref={dialog} aria-labelledby={titleId} onClose={() => setOpen(false)} onClick={event => { if (event.target === dialog.current) dialog.current?.close() }}
      className="bottom-sheet m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-card p-0 text-ink shadow-pop backdrop:bg-ink/50 sm:mx-auto sm:max-w-md">
      <div className="space-y-3 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <span aria-hidden="true" className="mx-auto block h-1 w-10 rounded-full bg-line" />
        <header className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="type-title">Share to Instagram</h2>
          <button type="button" aria-label="Close" onClick={() => dialog.current?.close()} className="btn-icon"><X size={18} /></button>
        </header>
        {/* The picture as it will look on Instagram. */}
        <div className="relative mx-auto aspect-[4/5] w-full max-w-[min(14rem,30dvh)] overflow-hidden rounded-lg bg-chip">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview && <img src={preview.url} alt="Your Instagram picture" className={`size-full object-cover transition-opacity ${loading ? 'opacity-50' : ''}`} />}
          {loading && <p role="status" className="absolute inset-x-0 bottom-3 text-center text-sm text-ink">Updating…</p>}
          {error && <p role="alert" className="absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-sm text-danger">{error}</p>}
        </div>
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
        <button type="button" disabled={!preview || loading} onClick={() => void share()} className="btn btn-primary w-full">{!preview || loading ? 'Making your picture…' : 'Share to Instagram'}</button>
        <p role="status" className="break-words text-xs text-muted">{note || 'Post it, or share it as a Story and add a Link sticker back to the trip; we’ll copy the link for you.'}</p>
      </div>
    </dialog>}
  </>
}

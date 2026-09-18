'use client'

import { useEffect, useId, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import Link from 'next/link'
import SavePlaceToPlan from './SavePlaceToPlan'
import PhotoStrip from './PhotoStrip'
import PlacePhoto from './PlacePhoto'
import { eventPhotos } from '@/lib/eventPhotos'
import { ArrowUpRight, MapPin, X, Plus, Check } from 'lucide-react'
import styles from './PlaceDetailsCard.module.css'
import type { PlaceRecommendation } from '@/lib/placeRecommendation'

type Place = {
  id?: string
  name: string
  description?: string | null
  notes?: string | null
  address?: string | null
  alternative?: string | null
  photoUrl?: string | null
  photoUrls?: string[]
  link?: string | null
  lat?: number | null
  lng?: number | null
  placeId?: string | null
}

export default function PlaceDetailsCard({ place, destination, category, recommendation = 'none', isHotel = false, messageHref, className, children }: {
  place: Place
  messageHref?: string
  destination: string
  category: string
  recommendation?: PlaceRecommendation
  isHotel?: boolean
  className: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const canSave = !!messageHref && !!place.id
  const photos = eventPhotos(place.photoUrls, place.photoUrl)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    dialog.current?.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])

  const mapUrl = new URL('https://www.google.com/maps/search/')
  mapUrl.searchParams.set('api', '1')
  mapUrl.searchParams.set('query', place.lat != null && place.lng != null
    ? `${place.lat},${place.lng}`
    : [place.name, place.address, destination].filter(Boolean).join(', '))
  if (place.placeId) mapUrl.searchParams.set('query_place_id', place.placeId)
  const website = place.link && /^https?:\/\//i.test(place.link) ? place.link : null

  return (
    <>
      <article className={`${className} ${styles.tile} ${canSave ? styles.saveable : ''}`} style={canSave ? { '--place-save-space': '44px', '--place-stamp-gap': '40px', '--place-header-space': '36px' } as CSSProperties : undefined}>
        <button type="button" className={styles.openTile} onClick={() => setOpen(true)}
          aria-label={`View details for ${place.name}`} aria-haspopup="dialog">
          <span className={styles.detailsHint}>View notes &amp; details →</span>
        </button>
        {children}
        {canSave && <button type="button" className={styles.savePlace} aria-label={`Save ${place.name} to a trip`} title="Save to a trip" aria-haspopup="dialog" onClick={() => setSaveOpen(true)}>{saved ? <Check size={19} /> : <Plus size={20} />}</button>}
      </article>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={event => {
          if (event.target === event.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect()
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close()
          }
        }}>
        {open && (
          <div className={styles.content}>
            <header className={styles.header}>
              <div>
                <p className={styles.category}>{category} · {destination}</p>
                {recommendation !== 'none' && <p className={`mt-2 text-sm font-semibold ${recommendation === 'avoid' ? 'text-red-700' : 'text-[#59694f]'}`}>{recommendation === 'option' ? 'Alternative' : recommendation === 'avoid' ? 'Avoid' : isHotel ? 'Must stay' : 'Must do'} · {recommendation === 'option' ? 'Saved as an alternative' : 'Poster’s recommendation'}</p>}
                <h2 id={titleId} className={styles.title}>{place.name}</h2>
              </div>
              <button type="button" autoFocus className={styles.close} aria-label="Close place details" onClick={() => dialog.current?.close()}><X size={22} /></button>
            </header>
            {place.notes && <section><h3 className={styles.sectionTitle}>Poster’s notes</h3><p className={styles.text}>{place.notes}</p></section>}
            {!place.notes && <p className={styles.muted}>The trip author hasn’t added notes for this place.</p>}
            {place.description && <p className={styles.text}>{place.description}</p>}
            {photos.length > 0 ? <PhotoStrip photos={photos.map((url, index) => ({ id: String(index), url, caption: null }))} title={place.name} contain />
              : place.id && <PlacePhoto itemId={place.id} name={place.name} thumbnailClass={styles.providerPhoto} fallback={null} fullWidth />}
            {place.address && <section><h3 className={styles.sectionTitle}>Address</h3><p className={styles.address}><MapPin size={17} />{place.address}</p></section>}
            {place.alternative && <section><h3 className={styles.sectionTitle}>Suggested alternative</h3><p className={styles.text}>{place.alternative}</p></section>}
            {canSave && <button type="button" className={styles.saveInline} aria-haspopup="dialog" onClick={() => setSaveOpen(true)}><span>{saved ? <Check size={19} /> : <Plus size={20} />}</span>Save to a trip</button>}
            {messageHref && <Link href={messageHref} onClick={() => dialog.current?.close()} className="inline-block rounded-full bg-[#59694f] px-4 py-2 text-sm text-white">Message about this place</Link>}
            <div className={styles.actions}>
              <a href={mapUrl.toString()} target="_blank" rel="noopener noreferrer" className={styles.mapLink}><MapPin size={17} />View on map<span className="sr-only"> (opens Google Maps in a new tab)</span></a>
              {website && <a href={website} target="_blank" rel="noopener noreferrer" className={styles.website}>Official website<ArrowUpRight size={16} /><span className="sr-only"> (opens in a new tab)</span></a>}
            </div>
          </div>
        )}
      </dialog>
      {canSave && place.id && <SavePlaceToPlan itemId={place.id} placeName={place.name} open={saveOpen} onClose={() => setSaveOpen(false)} onSaved={() => setSaved(true)} />}
    </>
  )
}

'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { ArrowUpRight, MapPin, Navigation, X } from 'lucide-react'
import styles from './PlaceDetailsCard.module.css'
import type { PlaceRecommendation } from '@/lib/placeRecommendation'

type Place = {
  name: string
  description?: string | null
  notes?: string | null
  address?: string | null
  alternative?: string | null
  photoUrl?: string | null
  link?: string | null
  lat?: number | null
  lng?: number | null
  placeId?: string | null
}

export default function PlaceDetailsCard({ place, destination, category, recommendation = 'none', isHotel = false, className, children }: {
  place: Place
  destination: string
  category: string
  recommendation?: PlaceRecommendation
  isHotel?: boolean
  className: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [photoFailed, setPhotoFailed] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    dialog.current?.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])

  const directions = new URL('https://www.google.com/maps/dir/')
  directions.searchParams.set('api', '1')
  directions.searchParams.set('destination', place.lat != null && place.lng != null
    ? `${place.lat},${place.lng}`
    : [place.name, place.address, destination].filter(Boolean).join(', '))
  if (place.placeId) directions.searchParams.set('destination_place_id', place.placeId)
  const website = place.link && /^https?:\/\//i.test(place.link) ? place.link : null

  return (
    <>
      <article className={className}>
        <button type="button" className={styles.openTile} onClick={() => setOpen(true)}
          aria-label={`View details for ${place.name}`} aria-haspopup="dialog" />
        {children}
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
                {recommendation !== 'none' && <p className={`mt-2 text-sm font-semibold ${recommendation === 'avoid' ? 'text-red-700' : 'text-[#507c76]'}`}>{recommendation === 'avoid' ? 'Avoid' : isHotel ? 'Must stay' : 'Must do'} · Poster’s recommendation</p>}
                <h2 id={titleId} className={styles.title}>{place.name}</h2>
              </div>
              <button type="button" autoFocus className={styles.close} aria-label="Close place details" onClick={() => dialog.current?.close()}><X size={22} /></button>
            </header>
            {place.photoUrl && !photoFailed && <Image src={place.photoUrl} alt={place.name} width={900} height={600}
              sizes="(max-width: 640px) 100vw, 640px" className={styles.photo} onError={() => setPhotoFailed(true)} />}
            {place.photoUrl && photoFailed && <p className={styles.muted}>This photo could not be loaded.</p>}
            {place.description && <p className={styles.text}>{place.description}</p>}
            {place.notes && <section><h3 className={styles.sectionTitle}>Poster’s notes</h3><p className={styles.text}>{place.notes}</p></section>}
            {place.address && <section><h3 className={styles.sectionTitle}>Address</h3><p className={styles.address}><MapPin size={17} />{place.address}</p></section>}
            {place.alternative && <section><h3 className={styles.sectionTitle}>Suggested alternative</h3><p className={styles.text}>{place.alternative}</p></section>}
            <div className={styles.actions}>
              <a href={directions.toString()} target="_blank" rel="noopener noreferrer" className={styles.directions}><Navigation size={17} />Directions<span className="sr-only"> (opens Google Maps in a new tab)</span></a>
              {website && <a href={website} target="_blank" rel="noopener noreferrer" className={styles.website}>Official website<ArrowUpRight size={16} /><span className="sr-only"> (opens in a new tab)</span></a>}
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}

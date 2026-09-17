'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Heart, Users, ChevronRight, X } from 'lucide-react'
import { placePeople } from '@/actions/placePeople'
import styles from './PlacePeople.module.css'

type Result = Awaited<ReturnType<typeof placePeople>>
export default function PlacePeople({ placeId, name, location = '', compact = false }: { placeId: string; name: string; location?: string; compact?: boolean }) {
  const [result, setResult] = useState<Result | null>(null)
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void placePeople(placeId, name, location).then(value => { if (active) setResult(value) }).catch(() => { if (active) setResult({ people: [], error: 'Could not load recommendations.' }) })
    return () => { active = false }
  }, [placeId, name, location, attempt])
  if (!result) return <p className={styles.status} role="status">Checking friends’ recommendations…</p>
  if (result.error) return <p className={styles.status}>{result.error} <button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></p>
  const liked = result.people.filter(person => person.isFriend && person.liked)
  const friends = result.people.filter(person => person.isFriend)
  const recommendedNames = liked.slice(0, 2).map(person => person.name).join(' and ')
  const friendRatings = friends.filter(person => person.rating !== null).slice(0, 2)
    .map(person => `${person.name}: ${person.rating}/5 ★`).join(' · ')
  const label = compact && liked.length ? `Recommended by ${recommendedNames}${liked.length > 2 ? ` + ${liked.length - 2} more` : ''}`
    : compact && friends.length ? `Shared by ${friends.slice(0, 2).map(person => person.name).join(' and ')}${friends.length > 2 ? ` + ${friends.length - 2} more` : ''}`
    : liked.length ? `${liked[0].name}${liked.length > 1 ? ` + ${liked.length - 1} friend${liked.length > 2 ? 's' : ''}` : ''} liked this`
    : friends.length ? `${friends.length} friend${friends.length === 1 ? '' : 's'} shared this place`
    : result.people.length ? `${result.people.length} ${result.people.length === 1 ? 'person' : 'people'} shared this place` : 'No shared visits or recommendations yet'
  if (compact && !result.people.length) return null
  return <>
    {result.people.length ? <button type="button" className={`${styles.cue} ${compact ? styles.compact : ''}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <span className={styles.icon}>{liked.length ? <Heart size={19} /> : <Users size={19} />}</span><span><strong>{label}</strong><small>{compact && friendRatings ? friendRatings : 'See visits, guides & recommendations'}</small></span><ChevronRight size={18} />
    </button> : <p className={styles.status}>{label}</p>}
    {open && <PeopleDialog name={name} people={result.people} onClose={() => setOpen(false)} />}
  </>
}
function PeopleDialog({ name, people, onClose }: { name: string; people: Result['people']; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [tab, setTab] = useState(people.some(person => person.isFriend) ? 'friends' : 'others')
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { element?.close(); document.body.style.overflow = previous }
  }, [])
  const shown = people.filter(person => tab === 'friends' ? person.isFriend : !person.isFriend)
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onClose={onClose}>
    <header className={styles.header}><div><p>Visits & recommendations</p><h2 id={titleId}>{name}</h2></div><button type="button" autoFocus aria-label="Close visits" onClick={() => dialog.current?.close()}><X size={22} /></button></header>
    <div className={styles.tabs} role="tablist" aria-label="People"><button type="button" role="tab" id={`${titleId}-friends`} aria-selected={tab === 'friends'} aria-controls={`${titleId}-panel`} onClick={() => setTab('friends')}>Friends ({people.filter(person => person.isFriend).length})</button><button type="button" role="tab" id={`${titleId}-others`} aria-selected={tab === 'others'} aria-controls={`${titleId}-panel`} onClick={() => setTab('others')}>Others ({people.filter(person => !person.isFriend).length})</button></div>
    <div id={`${titleId}-panel`} role="tabpanel" aria-labelledby={`${titleId}-${tab}`} className={styles.list}>
      {!shown.length && <p className={styles.status}>No shared visits or recommendations from friends yet.</p>}
      {shown.map(person => <article key={person.userId} className={styles.person}>
        <div className={styles.personHeader}><Link href={`/user/${person.userId}`} className={styles.personName}><span className={styles.avatar} aria-hidden="true">{person.name.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('')}</span>{person.name}</Link>{person.liked && <span className={styles.liked}><Heart size={13} />Liked it</span>}</div>
        <p className={styles.rating}>{person.visited ? 'Visited' : person.inGuide ? 'Included in a guide' : 'Shared a recommendation'}{person.rating !== null && <span aria-label={`${person.rating} out of 5 stars`}> · {'★'.repeat(person.rating)}{'☆'.repeat(5 - person.rating)}</span>}{person.recommendation === 'avoid' && ' · Would avoid'}</p>
        {person.notes && <p className={styles.notes}>{person.notes}</p>}
        <Link className={styles.trip} href={`/itinerary/${person.tripId}`}>View {person.tripTitle}<ChevronRight size={16} /></Link>
      </article>)}
    </div>
    <p className={styles.footnote}>Friends are people you follow. Only shared trips and recommendations appear here.</p>
  </dialog>
}

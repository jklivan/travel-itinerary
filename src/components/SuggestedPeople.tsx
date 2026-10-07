'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import UserAvatar from './UserAvatar'
import { sendFollowRequest, unfollowUser } from '@/actions/friends'

type Person = { id: string; name: string; image: string | null; trips: number; following: boolean }

function FollowChip({ person, onChange }: { person: Person; onChange: (following: boolean) => void }) {
  const [pending, startTransition] = useTransition()
  return <button type="button" disabled={pending} aria-pressed={person.following} aria-label={`${person.following ? 'Unfollow' : 'Follow'} ${person.name}`} onClick={() => startTransition(async () => {
    if (person.following) await unfollowUser(person.id); else await sendFollowRequest(person.id)
    onChange(!person.following)
  })} className="chip shrink-0">{person.following ? 'Following' : '+ Follow'}</button>
}

// Suggested travelers, each with a Follow chip (tap again to unfollow).
export default function SuggestedPeople({ people: initial }: { people: Person[] }) {
  const [people, setPeople] = useState(initial)
  return <ul className="panel divide-y divide-line-soft">{people.map(person => <li key={person.id} className="flex items-center gap-3 p-4">
    <Link href={`/user/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3">
      <UserAvatar name={person.name} image={person.image} size={48} />
      <span className="min-w-0">
        <span className="type-card block truncate">{person.name}</span>
        <span className="type-meta block">{person.trips} {person.trips === 1 ? 'trip' : 'trips'} posted</span>
      </span>
    </Link>
    <FollowChip person={person} onChange={following => setPeople(current => current.map(item => item.id === person.id ? { ...item, following } : item))} />
  </li>)}</ul>
}

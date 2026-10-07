'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import UserAvatar from './UserAvatar'
import { sendFollowRequest, unfollowUser } from '@/actions/friends'

export type ListedPerson = { id: string; name: string; image: string | null; meta?: string; following: boolean; followsYou?: boolean }

function FollowChip({ person, onChange }: { person: ListedPerson; onChange: (following: boolean) => void }) {
  const [pending, startTransition] = useTransition()
  const label = person.following ? 'Following' : person.followsYou ? 'Follow back' : '+ Follow'
  return <button type="button" disabled={pending} aria-pressed={person.following} aria-label={`${person.following ? 'Unfollow' : 'Follow'} ${person.name}`} onClick={() => startTransition(async () => {
    if (person.following) await unfollowUser(person.id); else await sendFollowRequest(person.id)
    onChange(!person.following)
  })} className="chip shrink-0">{label}</button>
}

// A list of people (suggested travelers, someone's followers, who they follow), each with a Follow chip.
// No chip on yourself, or when signed out.
export default function PeopleList({ people: initial, viewerId }: { people: ListedPerson[]; viewerId: string | null }) {
  const [people, setPeople] = useState(initial)
  return <ul className="panel divide-y divide-line-soft">{people.map(person => <li key={person.id} className="flex items-center gap-3 p-4">
    <Link href={`/user/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3">
      <UserAvatar name={person.name} image={person.image} size={48} />
      <span className="min-w-0">
        <span className="type-card block truncate">{person.name}</span>
        {person.meta && <span className="type-meta block">{person.meta}</span>}
      </span>
    </Link>
    {viewerId && person.id !== viewerId && <FollowChip person={person} onChange={following => setPeople(current => current.map(item => item.id === person.id ? { ...item, following } : item))} />}
  </li>)}</ul>
}

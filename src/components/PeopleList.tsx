'use client'

import { useState } from 'react'
import Link from 'next/link'
import UserAvatar from './UserAvatar'
import FollowButton from './FollowButton'

export type ListedPerson = { id: string; name: string; image: string | null; meta?: string; following: boolean; followsYou?: boolean }


// A list of people (suggested travelers, someone's followers, who they follow), each with a Follow chip.
// No chip on yourself, or when signed out.
// bare: no box of its own, for a list inside another panel.
export default function PeopleList({ people: initial, viewerId, bare = false }: { people: ListedPerson[]; viewerId: string | null; bare?: boolean }) {
  const [people, setPeople] = useState(initial)
  return <ul className={`${bare ? '' : 'panel '}divide-y divide-line-soft`}>{people.map(person => <li key={person.id} className="flex items-center gap-3 p-4">
    <Link href={`/user/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3">
      <UserAvatar name={person.name} image={person.image} size={48} />
      <span className="min-w-0">
        <span className="type-card block truncate">{person.name}</span>
        {person.meta && <span className="type-meta block">{person.meta}</span>}
      </span>
    </Link>
    {viewerId && person.id !== viewerId && <FollowButton userId={person.id} name={person.name} initialStatus={person.following} followsYou={person.followsYou} onChange={following => setPeople(current => current.map(item => item.id === person.id ? { ...item, following } : item))} />}
  </li>)}</ul>
}

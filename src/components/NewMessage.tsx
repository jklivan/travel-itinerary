'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SquarePen } from 'lucide-react'
import BottomSheet from './ui/BottomSheet'
import UserAvatar from './UserAvatar'
import SearchField from './ui/SearchField'

export type Friend = { id: string; name: string; image: string | null }

// Messages: pick a friend (people you follow and who follow you) to start a conversation. Shown as a list right
// on the page while there are no conversations yet, and behind the New message button once there are.
export function FriendPicker({ friends }: { friends: Friend[] }) {
  const [query, setQuery] = useState('')
  const shown = friends.filter(friend => friend.name.toLowerCase().includes(query.trim().toLowerCase()))
  if (!friends.length) return <p className="text-sm text-muted">Follow travelers (under Friends) to message them here.</p>
  return <div className="space-y-3">
    {friends.length > 6 && <SearchField value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a friend…" aria-label="Find a friend" buttonLabel="Clear" buttonDisabled={!query} onButtonClick={() => setQuery('')} />}
    <ul className="divide-y divide-line-soft">{shown.map(friend => <li key={friend.id}>
      <Link href={`/messages/${friend.id}`} className="flex items-center gap-3 py-2.5 hover:bg-cream">
        <UserAvatar name={friend.name} image={friend.image} size={40} /><span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{friend.name}</span>
      </Link>
    </li>)}</ul>
    {!shown.length && <p className="text-sm text-muted">No friends match “{query}”.</p>}
  </div>
}

export default function NewMessage({ friends }: { friends: Friend[] }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" onClick={() => setOpen(true)} className="btn btn-primary btn-sm"><SquarePen size={16} />New message</button>
    {open && <BottomSheet title="New message" label="Choose a friend to message" onClose={() => setOpen(false)}><FriendPicker friends={friends} /></BottomSheet>}
  </>
}

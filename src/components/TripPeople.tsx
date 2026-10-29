'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Link2, UserPlus, X } from 'lucide-react'
import UserAvatar from './UserAvatar'
import { friendsToInvite, inviteFriend, inviteLink, removeMember } from '@/actions/tripMembers'

type Person = { id: string; name: string; image: string | null; status: string }

// Who's planning a trip together (#116), under its title: faces, then Invite (the creator) or Leave (everyone else).
// Invite opens friends to invite, a link to share, and the people already on it (the creator can remove them).
export default function TripPeople({ tripId, people, isOwner, viewerId }: { tripId: string; people: Person[]; isOwner: boolean; viewerId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [friends, setFriends] = useState<{ id: string; name: string; image: string | null }[] | null>(null)
  const [invited, setInvited] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [leaving, setLeaving] = useState(false)
  const joined = people.filter(person => person.status !== 'invited')
  const waiting = people.filter(person => person.status === 'invited')

  async function show() {
    setOpen(value => !value); setMessage('')
    if (!friends) setFriends(await friendsToInvite(tripId).catch(() => []))
  }
  async function invite(friendId: string) {
    setBusy(friendId); setMessage('')
    try { const result = await inviteFriend(tripId, friendId); if (result.error) setMessage(result.error); else { setInvited(current => [...current, friendId]); router.refresh() } }
    catch { setMessage('Could not send the invite. Please try again.') } finally { setBusy(null) }
  }
  async function copyLink() {
    setBusy('link'); setMessage('')
    try {
      const result = await inviteLink(tripId)
      if (result.error || !result.link) { setMessage(result.error ?? 'Could not make a link.'); return }
      const url = `${window.location.origin}${result.link}`
      try { await navigator.clipboard.writeText(url); setMessage('Invite link copied. Send it to anyone you’d like to plan with.') }
      catch { setMessage(`Copy this link: ${url}`) }
    } finally { setBusy(null) }
  }
  async function remove(personId: string) {
    setBusy(personId); setMessage('')
    try {
      const result = await removeMember(tripId, personId)
      if (result.error) { setMessage(result.error); return }
      if (personId === viewerId) router.push('/plan'); else router.refresh()
    } catch { setMessage('Could not do that. Please try again.') } finally { setBusy(null) }
  }

  return <div className="mt-2">
    <div className="flex flex-wrap items-center gap-2">
      {people.length > 1 && <div className="flex -space-x-2" aria-label={`Planning together: ${joined.map(person => person.name).join(', ')}`}>
        {joined.slice(0, 6).map(person => <UserAvatar key={person.id} name={person.name} image={person.image} size={28} className="ring-2 ring-paper" />)}
      </div>}
      {people.length > 1 && <span className="text-xs text-muted">{joined.length === 1 ? 'Just you so far' : `${joined.length} planning`}{waiting.length ? ` · ${waiting.length} invited` : ''}</span>}
      {isOwner
        ? <button type="button" onClick={() => void show()} aria-expanded={open} className="chip"><UserPlus size={14} />{people.length > 1 ? 'People' : 'Plan together'}</button>
        : <button type="button" onClick={() => setLeaving(true)} className="chip">Leave trip</button>}
    </div>
    {leaving && <div className="panel-inset mt-2 space-y-2 p-3 text-sm">
      <p>Leave this trip? It comes off your plans; the others keep planning it.</p>
      <div className="flex gap-2"><button type="button" disabled={!!busy} onClick={() => void remove(viewerId)} className="btn btn-danger btn-sm">Leave trip</button><button type="button" onClick={() => setLeaving(false)} className="btn btn-outline btn-sm">Stay</button></div>
    </div>}
    {open && <section aria-label="Plan together" className="panel mt-2 space-y-3 p-4">
      <div>
        <h3 className="type-label text-ink">Plan this trip together</h3>
        <p className="mt-1 text-xs text-muted">Friends you invite can add and change places. Everyone’s stars, notes and photos stay their own.</p>
      </div>
      <button type="button" disabled={busy === 'link'} onClick={() => void copyLink()} className="btn btn-outline btn-sm"><Link2 size={16} />{busy === 'link' ? 'Making link…' : 'Copy invite link'}</button>
      {people.length > 1 && <div className="space-y-1.5">
        <p className="field-label">On this trip</p>
        {people.map(person => <div key={person.id} className="flex items-center gap-2 text-sm">
          <UserAvatar name={person.name} image={person.image} size={28} />
          <span className="min-w-0 flex-1 truncate">{person.name}{person.status === 'creator' ? ' · started it' : person.status === 'invited' ? ' · invited' : ''}</span>
          {person.status !== 'creator' && <button type="button" disabled={busy === person.id} onClick={() => void remove(person.id)} aria-label={`Remove ${person.name}`} className="btn-icon"><X size={16} /></button>}
        </div>)}
      </div>}
      <div className="space-y-1.5">
        <p className="field-label">Invite friends</p>
        {friends === null ? <p className="text-xs text-muted">Loading…</p> : !friends.length ? <p className="text-xs text-muted">Follow friends on Postcard to invite them here, or send the link.</p>
          : friends.map(friend => <div key={friend.id} className="flex items-center gap-2 text-sm">
            <UserAvatar name={friend.name} image={friend.image} size={28} />
            <span className="min-w-0 flex-1 truncate">{friend.name}</span>
            {invited.includes(friend.id) ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-link"><Check size={14} />Invited</span>
              : <button type="button" disabled={busy === friend.id} onClick={() => void invite(friend.id)} className="chip">{busy === friend.id ? 'Inviting…' : 'Invite'}</button>}
          </div>)}
      </div>
      {message && <p role="status" className="text-sm text-link [overflow-wrap:anywhere]">{message}</p>}
    </section>}
    {!open && message && <p role="status" className="mt-1 text-sm text-danger">{message}</p>}
  </div>
}

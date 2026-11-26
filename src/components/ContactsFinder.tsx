'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Capacitor } from '@capacitor/core'
import { BookUser } from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'
import { INVITE } from '@/components/InviteFriendsButton'
import { findContactsOnPostcard } from '@/actions/friends'

type Match = { id: string; name: string; image: string | null }
type Invitee = { key: string; name: string; phone: string | null; email: string | null }

const SHOWN = 25
const noSubscribe = () => () => {}
const hasContactsPlugin = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Contacts')

// Friends → Find friends from your contacts (iPhone app only: a website can't read contacts). Only after a tap does
// the phone ask for permission; then the contacts' email addresses are checked against Postcard accounts (compared,
// never saved). People already here get Follow; everyone else gets Invite, a text (or an email) with the invite.
// Older app builds don't have the contacts plugin, so the section only shows where it's there.
export default function ContactsFinder({ renderFollow, onMatched }: {
  renderFollow: (user: Match) => React.ReactNode
  onMatched: (users: Match[]) => void
}) {
  const available = useSyncExternalStore(noSubscribe, hasContactsPlugin, () => false)
  const [state, setState] = useState<'idle' | 'loading' | 'denied' | 'failed' | 'done'>('idle')
  const [matches, setMatches] = useState<Match[]>([])
  const [invitees, setInvitees] = useState<Invitee[]>([])
  const [showAll, setShowAll] = useState(false)


  async function find() {
    setState('loading')
    try {
      const { Contacts } = await import('@capacitor-community/contacts')
      const permission = await Contacts.requestPermissions()
      if (permission.contacts !== 'granted' && permission.contacts !== 'limited') { setState('denied'); return }
      const { contacts } = await Contacts.getContacts({ projection: { name: true, emails: true, phones: true } })
      const people = contacts.map(c => ({
        key: c.contactId,
        name: c.name?.display || [c.name?.given, c.name?.family].filter(Boolean).join(' '),
        emails: (c.emails ?? []).map(e => e.address?.trim().toLowerCase()).filter((e): e is string => !!e),
        phone: (c.phones ?? []).find(p => p.type === 'mobile')?.number ?? c.phones?.[0]?.number ?? null,
      })).filter(p => p.name && (p.emails.length || p.phone))
      const found = await findContactsOnPostcard(people.flatMap(p => p.emails))
      const matchedEmails = new Set(found.map(u => u.email))
      const users = found.filter((u, i) => found.findIndex(x => x.id === u.id) === i).map(({ id, name, image }) => ({ id, name, image }))
      setMatches(users)
      onMatched(users)
      setInvitees(people.filter(p => !p.emails.some(e => matchedEmails.has(e)))
        .map(p => ({ key: p.key, name: p.name, phone: p.phone, email: p.emails[0] ?? null }))
        .sort((a, b) => a.name.localeCompare(b.name)))
      setState('done')
    } catch {
      setState('failed')
    }
  }

  if (!available) return null

  function inviteLink(person: Invitee) {
    if (person.phone) return `sms:${person.phone.replace(/[^\d+]/g, '')}&body=${encodeURIComponent(INVITE)}`
    return `mailto:${person.email}?subject=${encodeURIComponent('Join me on Postcard')}&body=${encodeURIComponent(INVITE)}`
  }

  return (
    <section className="panel overflow-hidden">
      <div className="px-5 py-3 border-b border-sand flex items-center gap-2">
        <BookUser size={16} className="text-brown" />
        <h2 className="type-label text-ink">From your contacts</h2>
      </div>
      {state !== 'done' ? (
        <div className="p-4">
          <p className="mb-3 text-sm text-brown">See which of your contacts are already on Postcard. Their email addresses are only checked, never saved.</p>
          <button type="button" onClick={() => void find()} disabled={state === 'loading'} className="btn btn-outline w-full">
            <BookUser size={18} />{state === 'loading' ? 'Looking…' : 'Find friends from your contacts'}
          </button>
          {state === 'denied' && <p role="status" className="mt-3 text-sm text-muted">Postcard can’t see your contacts. To allow it, open the iPhone’s Settings, then Apps, Postcard, Contacts.</p>}
          {state === 'failed' && <p role="status" className="mt-3 text-sm text-danger">Something went wrong reading your contacts. Try again.</p>}
        </div>
      ) : (
        <div>
          {matches.length > 0 ? (
            <ul className="divide-y divide-sand">
              {matches.map(user => (
                <li key={user.id} className="flex items-center justify-between px-5 py-3">
                  <Link href={`/user/${user.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <UserAvatar name={user.name} image={user.image} size={48} />
                    <p className="text-sm font-medium text-ink">{user.name}</p>
                  </Link>
                  {renderFollow(user)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-brown italic px-5 pt-4">None of your contacts are on Postcard yet. Invite a few below.</p>
          )}
          {invitees.length > 0 && <>
            <p className="field-label px-5 pt-4">Invite to Postcard</p>
            <ul className="divide-y divide-sand">
              {(showAll ? invitees : invitees.slice(0, SHOWN)).map(person => (
                <li key={person.key} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <p className="min-w-0 truncate text-sm text-ink">{person.name}</p>
                  <a href={inviteLink(person)} className="chip shrink-0">Invite</a>
                </li>
              ))}
            </ul>
            {!showAll && invitees.length > SHOWN && <div className="px-5 pb-4 pt-1">
              <button type="button" onClick={() => setShowAll(true)} className="btn btn-outline btn-sm w-full">Show all {invitees.length}</button>
            </div>}
          </>}
        </div>
      )}
    </section>
  )
}

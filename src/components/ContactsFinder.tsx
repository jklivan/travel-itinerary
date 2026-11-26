'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookUser, Check } from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'
import { INVITE } from '@/components/InviteFriendsButton'
import useContactsOnPostcard, { type ContactInvitee, type ContactMatch } from '@/components/useContactsOnPostcard'

const SHOWN = 25
// Who's been invited from this phone (contact ids stay on the phone), so Invited ✓ is still there next time.
const INVITED_KEY = 'postcard-invited-contacts'

function readInvited(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(INVITED_KEY) || '[]')) } catch { return new Set() }
}

function inviteLink(person: ContactInvitee) {
  if (person.phone) return `sms:${person.phone.replace(/[^\d+]/g, '')}&body=${encodeURIComponent(INVITE)}`
  return `mailto:${person.email}?subject=${encodeURIComponent('Join me on Postcard')}&body=${encodeURIComponent(INVITE)}`
}

// Contacts not on Postcard yet, each with Invite (a text to their number, or an email): the first 25, then Show all.
// Once tapped it turns into Invited ✓ (still tappable, to send it again).
export function InviteList({ invitees }: { invitees: ContactInvitee[] }) {
  const [showAll, setShowAll] = useState(false)
  const [invited, setInvited] = useState(readInvited)
  function markInvited(key: string) {
    const next = new Set([...invited, key])
    setInvited(next)
    try { localStorage.setItem(INVITED_KEY, JSON.stringify([...next])) } catch {}
  }
  if (!invitees.length) return null
  return <>
    <p className="field-label px-5 pt-4">Invite to Postcard</p>
    <ul className="divide-y divide-sand">
      {(showAll ? invitees : invitees.slice(0, SHOWN)).map(person => (
        <li key={person.key} className="flex items-center justify-between gap-3 px-5 py-2.5">
          <p className="min-w-0 truncate text-sm text-ink">{person.name}</p>
          <a href={inviteLink(person)} onClick={() => markInvited(person.key)} className="chip shrink-0">
            {invited.has(person.key) ? <><Check size={14} />Invited</> : 'Invite'}
          </a>
        </li>
      ))}
    </ul>
    {!showAll && invitees.length > SHOWN && <div className="px-5 pb-4 pt-1">
      <button type="button" onClick={() => setShowAll(true)} className="btn btn-outline btn-sm w-full">Show all {invitees.length}</button>
    </div>}
  </>
}

// The button that reads contacts, with what to say while it looks or if it can't.
export function FindContactsButton({ state, find, outline = false }: { state: ReturnType<typeof useContactsOnPostcard>['state']; find: () => Promise<unknown>; outline?: boolean }) {
  return <>
    <button type="button" onClick={() => void find()} disabled={state === 'loading'} className={`btn ${outline ? 'btn-outline' : 'btn-primary'} w-full`}>
      <BookUser size={18} />{state === 'loading' ? 'Looking…' : 'Find friends from your contacts'}
    </button>
    {state === 'denied' && <p role="status" className="mt-3 text-sm text-muted">Postcard can’t see your contacts. To allow it, open the iPhone’s Settings, then Apps, Postcard, Contacts.</p>}
    {state === 'failed' && <p role="status" className="mt-3 text-sm text-danger">Something went wrong reading your contacts. Try again.</p>}
  </>
}

// Friends → From your contacts (iPhone app only). People already here get Follow (Friends' own follow buttons, so
// they join People you follow); everyone else gets Invite.
export default function ContactsFinder({ renderFollow, onMatched }: {
  renderFollow: (user: ContactMatch) => React.ReactNode
  onMatched: (users: ContactMatch[]) => void
}) {
  const contacts = useContactsOnPostcard()
  const { available, state, matches, invitees } = contacts
  if (!available) return null

  async function find() {
    onMatched(await contacts.find())
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
          <FindContactsButton state={state} find={find} outline />
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
          <InviteList invitees={invitees} />
        </div>
      )}
    </section>
  )
}

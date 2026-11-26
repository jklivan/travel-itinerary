'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Capacitor } from '@capacitor/core'
import { findContactsOnPostcard } from '@/actions/friends'

export type ContactMatch = { id: string; name: string; image: string | null; following: boolean }
export type ContactInvitee = { key: string; name: string; phone: string | null; email: string | null }

type Found = { matches: ContactMatch[]; invitees: ContactInvitee[]; emails: string[]; limited?: boolean }

// The last results, kept on the phone for this session only, so opening someone's profile and coming back shows the
// list again instead of asking to look again.
const FOUND_KEY = 'postcard-contacts-found'
function readFound(): Found | null {
  try { return JSON.parse(sessionStorage.getItem(FOUND_KEY) || 'null') } catch { return null }
}
function keepFound(found: Found) {
  try { sessionStorage.setItem(FOUND_KEY, JSON.stringify(found)) } catch {}
}

const noSubscribe = () => () => {}
// iPhone app builds with the contacts plugin only (a website can't read contacts; older builds don't have it).
const hasContactsPlugin = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Contacts')

// Reading the phone's contacts, only when find() runs (from a tap): the phone asks permission, then the contacts'
// email addresses are checked against Postcard accounts (compared, never saved). matches: contacts already on
// Postcard; invitees: everyone else with a phone number or email, for Invite.
export default function useContactsOnPostcard() {
  const available = useSyncExternalStore(noSubscribe, hasContactsPlugin, () => false)
  const [kept] = useState(readFound)
  const [state, setState] = useState<'idle' | 'loading' | 'denied' | 'failed' | 'done'>(kept ? 'done' : 'idle')
  const [matches, setMatches] = useState<ContactMatch[]>(kept?.matches ?? [])
  const [invitees, setInvitees] = useState<ContactInvitee[]>(kept?.invitees ?? [])
  // iOS lets people share only some contacts (Select Contacts); then only those are checked.
  const [limited, setLimited] = useState(kept?.limited ?? false)

  // Back from a profile: the kept list, with who you follow brought up to date (you may have followed them there).
  useEffect(() => {
    if (!kept) return
    findContactsOnPostcard(kept.emails).then(found => {
      const following = new Map(found.map(u => [u.id, u.following]))
      const updated = kept.matches.filter(m => following.has(m.id)).map(m => ({ ...m, following: following.get(m.id)! }))
      setMatches(updated)
      keepFound({ ...kept, matches: updated })
    }).catch(() => {})
  }, [kept])

  async function find(): Promise<ContactMatch[]> {
    setState('loading')
    try {
      const { Contacts } = await import('@capacitor-community/contacts')
      const permission = await Contacts.requestPermissions()
      if (permission.contacts !== 'granted' && permission.contacts !== 'limited') { setState('denied'); return [] }
      const someOnly = permission.contacts === 'limited'
      const { contacts } = await Contacts.getContacts({ projection: { name: true, emails: true, phones: true } })
      const people = contacts.map(c => ({
        key: c.contactId,
        name: c.name?.display || [c.name?.given, c.name?.family].filter(Boolean).join(' '),
        emails: (c.emails ?? []).map(e => e.address?.trim().toLowerCase()).filter((e): e is string => !!e),
        phone: (c.phones ?? []).find(p => p.type === 'mobile')?.number ?? c.phones?.[0]?.number ?? null,
      })).filter(p => p.name && (p.emails.length || p.phone))
      const emails = people.flatMap(p => p.emails)
      const found = await findContactsOnPostcard(emails)
      const matchedEmails = new Set(found.map(u => u.email))
      const users = found.filter((u, i) => found.findIndex(x => x.id === u.id) === i).map(({ id, name, image, following }) => ({ id, name, image, following }))
      const others = people.filter(p => !p.emails.some(e => matchedEmails.has(e)))
        .map(p => ({ key: p.key, name: p.name, phone: p.phone, email: p.emails[0] ?? null }))
        .sort((a, b) => a.name.localeCompare(b.name))
      setMatches(users)
      setInvitees(others)
      setLimited(someOnly)
      keepFound({ matches: users, invitees: others, emails: [...new Set(emails)], limited: someOnly })
      setState('done')
      return users
    } catch {
      setState('failed')
      return []
    }
  }

  return { available, state, matches, invitees, limited, find }
}

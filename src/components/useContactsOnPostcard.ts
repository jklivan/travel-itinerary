'use client'

import { useState, useSyncExternalStore } from 'react'
import { Capacitor } from '@capacitor/core'
import { findContactsOnPostcard } from '@/actions/friends'

export type ContactMatch = { id: string; name: string; image: string | null; following: boolean }
export type ContactInvitee = { key: string; name: string; phone: string | null; email: string | null }

const noSubscribe = () => () => {}
// iPhone app builds with the contacts plugin only (a website can't read contacts; older builds don't have it).
const hasContactsPlugin = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Contacts')

// Reading the phone's contacts, only when find() runs (from a tap): the phone asks permission, then the contacts'
// email addresses are checked against Postcard accounts (compared, never saved). matches: contacts already on
// Postcard; invitees: everyone else with a phone number or email, for Invite.
export default function useContactsOnPostcard() {
  const available = useSyncExternalStore(noSubscribe, hasContactsPlugin, () => false)
  const [state, setState] = useState<'idle' | 'loading' | 'denied' | 'failed' | 'done'>('idle')
  const [matches, setMatches] = useState<ContactMatch[]>([])
  const [invitees, setInvitees] = useState<ContactInvitee[]>([])

  async function find(): Promise<ContactMatch[]> {
    setState('loading')
    try {
      const { Contacts } = await import('@capacitor-community/contacts')
      const permission = await Contacts.requestPermissions()
      if (permission.contacts !== 'granted' && permission.contacts !== 'limited') { setState('denied'); return [] }
      const { contacts } = await Contacts.getContacts({ projection: { name: true, emails: true, phones: true } })
      const people = contacts.map(c => ({
        key: c.contactId,
        name: c.name?.display || [c.name?.given, c.name?.family].filter(Boolean).join(' '),
        emails: (c.emails ?? []).map(e => e.address?.trim().toLowerCase()).filter((e): e is string => !!e),
        phone: (c.phones ?? []).find(p => p.type === 'mobile')?.number ?? c.phones?.[0]?.number ?? null,
      })).filter(p => p.name && (p.emails.length || p.phone))
      const found = await findContactsOnPostcard(people.flatMap(p => p.emails))
      const matchedEmails = new Set(found.map(u => u.email))
      const users = found.filter((u, i) => found.findIndex(x => x.id === u.id) === i).map(({ id, name, image, following }) => ({ id, name, image, following }))
      setMatches(users)
      setInvitees(people.filter(p => !p.emails.some(e => matchedEmails.has(e)))
        .map(p => ({ key: p.key, name: p.name, phone: p.phone, email: p.emails[0] ?? null }))
        .sort((a, b) => a.name.localeCompare(b.name)))
      setState('done')
      return users
    } catch {
      setState('failed')
      return []
    }
  }

  return { available, state, matches, invitees, find }
}

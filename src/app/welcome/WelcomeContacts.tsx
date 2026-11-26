'use client'

import { useState } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'
import PeopleList from '@/components/PeopleList'
import { ContactsFootnote, FindContactsButton, InviteList } from '@/components/ContactsFinder'
import useContactsOnPostcard from '@/components/useContactsOnPostcard'

// Sign-up → Welcome, in the iPhone app: a sheet that pops up to find friends from your contacts. The phone only asks
// for permission after the tap; then the friends already on Postcard are listed to follow, and the rest to invite.
// Closing it (Not now, Done, ✕) leaves the Welcome page as it was.
export default function WelcomeContacts({ viewerId }: { viewerId: string }) {
  const { available, state, matches, invitees, limited, find } = useContactsOnPostcard()
  const [open, setOpen] = useState(true)
  if (!available || !open) return null
  const done = state === 'done'
  return <BottomSheet title="Find your friends" label="Find friends from your contacts" onClose={() => setOpen(false)}
    footer={<button type="button" onClick={() => setOpen(false)} className={`btn ${done ? 'btn-primary' : 'btn-outline'} w-full`}>{done ? 'Done' : 'Not now'}</button>}>
    {!done ? <div className="px-1 pt-2">
      <h3 className="type-title mb-2">See who you know on Postcard</h3>
      <p className="mb-5 text-sm text-muted">Postcard checks the email addresses in your contacts for friends who are already here, so you can follow them. Your contacts are never saved.</p>
      <FindContactsButton state={state} find={find} />
    </div> : <>
      {matches.length > 0
        ? <>
          <p className="mb-2 px-1 text-sm text-muted">{matches.length === 1 ? '1 friend is' : `${matches.length} friends are`} on Postcard. Follow them to see their trips in your feed.</p>
          <PeopleList key={matches.map(m => `${m.id}${m.following}`).join()} people={matches} viewerId={viewerId} bare />
        </>
        : <p className="px-1 text-sm text-muted">None of your contacts are on Postcard yet. Invite a few so you can see each other’s trips.</p>}
      <div className="-mx-4"><InviteList invitees={invitees} /><ContactsFootnote limited={limited} find={find} /></div>
    </>}
  </BottomSheet>
}

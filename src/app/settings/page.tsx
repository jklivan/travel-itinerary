import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { NotificationPreferences } from '@/components/NativeNotifications'
import { unregisterPushDevice } from '@/actions/notifications'
import { LogOut } from 'lucide-react'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import DeleteAccount from '@/components/DeleteAccount'
import BlockButton from '@/components/BlockButton'
import UserAvatar from '@/components/UserAvatar'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const blocked = await prisma.block.findMany({ where: { blockerId: session.user.id }, orderBy: { createdAt: 'desc' }, select: { blocked: { select: { id: true, name: true, image: true } } } })

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="type-display mb-6">Settings</h1>
      <NotificationPreferences />

      <section className="panel p-5">
        <div>
          <h2 className="type-label text-ink">Public profiles</h2>
          <p className="text-sm text-brown mt-0.5">
            Profiles and published itineraries are public for now. You can still follow friends to see their trips together.
          </p>
        </div>
      </section>
      <form className="mt-6" action={async () => {
        'use server'
        await unregisterPushDevice()
        await signOut({ redirectTo: '/' })
      }}>
        <button type="submit" className="btn btn-outline"><LogOut size={16} />Sign out</button>
      </form>
      {/* People you've blocked, with Unblock. */}
      {blocked.length > 0 && <section className="panel mt-6 p-5" aria-labelledby="blocked-heading">
        <h2 id="blocked-heading" className="type-label text-ink">Blocked accounts</h2>
        <ul className="mt-3 divide-y divide-line-soft">{blocked.map(({ blocked: person }) => <li key={person.id} className="flex items-center justify-between gap-3 py-2.5">
          <Link href={`/user/${person.id}`} className="flex min-w-0 items-center gap-2"><UserAvatar name={person.name} image={person.image} size={32} /><span className="truncate text-sm">{person.name}</span></Link>
          <BlockButton userId={person.id} name={person.name} initialBlocked />
        </li>)}</ul>
      </section>}
      <DeleteAccount />
      <p className="mt-6 text-xs text-muted"><Link href="/terms" className="underline">Terms of use</Link> · <Link href="/privacy" className="underline">Privacy</Link></p>
    </div>
  )
}

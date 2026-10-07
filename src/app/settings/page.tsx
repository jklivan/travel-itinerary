import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { NotificationPreferences } from '@/components/NativeNotifications'
import { unregisterPushDevice } from '@/actions/notifications'
import { LogOut } from 'lucide-react'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

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
    </div>
  )
}

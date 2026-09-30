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
      <h1 className="font-[family-name:var(--font-playfair)] text-2xl text-ink mb-6">Settings</h1>
      <NotificationPreferences />

      <section className="bg-cream rounded-xl border border-sand p-5">
        <div>
          <h2 className="font-semibold text-ink">Public profiles</h2>
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
        <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft hover:bg-line-soft"><LogOut size={16} />Sign out</button>
      </form>
    </div>
  )
}

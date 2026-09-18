import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { NotificationPreferences } from '@/components/NativeNotifications'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-[family-name:var(--font-playfair)] text-2xl text-[#242e25] mb-6">Settings</h1>
      <NotificationPreferences />

      <section className="bg-[#faf7f1] rounded-xl border border-[#dfd3c2] p-5">
        <div>
          <h2 className="font-semibold text-[#242e25]">Public profiles</h2>
          <p className="text-sm text-[#8B6F4E] mt-0.5">
            Profiles and published itineraries are public for now. You can still follow friends to see their trips together.
          </p>
        </div>
      </section>
    </div>
  )
}

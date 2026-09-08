import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-[family-name:var(--font-playfair)] text-2xl text-[#2C1810] mb-6">Settings</h1>

      <section className="bg-[#FAF7F2] rounded-xl border border-[#E8D5B7] p-5">
        <div>
          <h2 className="font-semibold text-[#2C1810]">Public profiles</h2>
          <p className="text-sm text-[#8B6F4E] mt-0.5">
            Profiles and published itineraries are public for now. You can still follow friends to see their trips together.
          </p>
        </div>
      </section>
    </div>
  )
}

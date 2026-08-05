import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Settings</h1>

      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div>
          <h2 className="font-semibold text-gray-900">Public profiles</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Profiles and published itineraries are public for now. You can still follow friends to see their trips together.
          </p>
        </div>
      </section>
    </div>
  )
}

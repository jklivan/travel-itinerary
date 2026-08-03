import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { updateAccountPrivacy } from '@/actions/friends'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPrivate: true },
  })
  if (!user) redirect('/login')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Settings</h1>

      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">Account Privacy</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {user.isPrivate
              ? 'Your account is private. Only approved followers can see your itineraries.'
              : 'Your account is public. Anyone can follow you and see your itineraries.'}
          </p>
        </div>

        <form action={async (formData: FormData) => {
          'use server'
          await updateAccountPrivacy(formData.get('isPrivate') === '1')
        }}>
          <div className="flex items-center justify-between py-3 border-t border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Private account</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {user.isPrivate
                  ? 'New followers need your approval. Switching to public will auto-approve pending requests.'
                  : 'When turned on, new followers will need to send a request you approve.'}
              </p>
            </div>
            <button
              type="submit"
              name="isPrivate"
              value={user.isPrivate ? '0' : '1'}
              className={`ml-4 shrink-0 w-11 h-6 rounded-full relative transition-colors focus:outline-none ${user.isPrivate ? 'bg-blue-600' : 'bg-gray-200'}`}
              aria-label={user.isPrivate ? 'Make account public' : 'Make account private'}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${user.isPrivate ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

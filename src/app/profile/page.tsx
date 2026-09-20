import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ChevronRight, Settings, Users, Map } from 'lucide-react'

export default async function ProfilePage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/login?callbackUrl=%2Fprofile')
  const [user, followers, following, pending] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.follow.count({ where: { followingId: userId, status: 'accepted' } }),
    prisma.follow.count({ where: { followerId: userId, status: 'accepted' } }),
    prisma.follow.count({ where: { followingId: userId, status: 'pending' } }),
  ])
  if (!user) redirect('/login')
  const initials = user.name.split(' ').filter(Boolean).map(word => word[0]).join('').slice(0, 2).toUpperCase()
  return <main className="mx-auto max-w-xl px-5 py-7 text-[#2e4147] sm:px-8">
    <section className="rounded-2xl border border-[#c7d7cf] bg-[#edf1e9] p-5">
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#59694f] text-xl font-bold text-white">{initials}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#59694f]">Profile</p>
          <h1 className="mt-1 break-words font-[family-name:var(--font-playfair)] text-2xl text-[#242e25]">{user.name}</h1>
          <p className="mt-1 text-xs text-[#59694f]">{followers} followers · {following} following</p>
        </div>
        <Link href="/settings" aria-label="Settings" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[#b5c8bc] text-[#59694f] hover:bg-white/60"><Settings size={19} /></Link>
      </div>
    </section>
    <div className="mt-5 space-y-3">
      <Link href={`/user/${userId}`} className="group flex min-h-20 items-center gap-4 rounded-2xl border border-[#d7cebc] bg-[#fffdf7] p-4 hover:bg-[#f5efe2]">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#59694f]/10 text-[#59694f]"><Map size={22} /></span>
        <span className="min-w-0 flex-1"><span className="block font-[family-name:var(--font-playfair)] text-xl">My Trips</span><span className="mt-0.5 block text-sm text-[#73786d]">View your posts and plans</span></span><ChevronRight size={20} className="text-[#59694f]" />
      </Link>
      <Link href="/friends" className="group flex min-h-20 items-center gap-4 rounded-2xl border border-[#d7cebc] bg-[#fffdf7] p-4 hover:bg-[#f5efe2]">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#59694f]/10 text-[#59694f]"><Users size={22} /></span>
        <span className="min-w-0 flex-1"><span className="block font-[family-name:var(--font-playfair)] text-xl">Friends</span><span className="mt-0.5 block text-sm text-[#73786d]">{pending ? `${pending} friend request${pending === 1 ? '' : 's'} waiting` : 'Find friends & see who you follow'}</span></span>{pending > 0 && <span className="rounded-full bg-[#59694f] px-2 py-1 text-xs font-semibold text-white">{pending}</span>}<ChevronRight size={20} className="text-[#59694f]" />
      </Link>
      <Link href="/settings" className="group flex min-h-20 items-center gap-4 rounded-2xl border border-[#d7cebc] bg-[#fffdf7] p-4 hover:bg-[#f5efe2]">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#59694f]/10 text-[#59694f]"><Settings size={22} /></span>
        <span className="min-w-0 flex-1"><span className="block font-[family-name:var(--font-playfair)] text-xl">Settings</span><span className="mt-0.5 block text-sm text-[#73786d]">Account and notification preferences</span></span><ChevronRight size={20} className="text-[#59694f]" />
      </Link>
    </div>
  </main>
}

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export default async function AdminPage() {
  const session = await auth()
  if (!ADMIN_EMAIL || session?.user?.email !== ADMIN_EMAIL) {
    redirect('/')
  }

  const now = new Date()
  const ago7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
  const ago30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalUsers, newUsers7, newUsers30,
    totalPublic, newPublic7, newPublic30, totalDrafts, totalGuides,
    totalSaves, totalComments,
    topDests,
    mostSaved,
    recentUsers,
    recentPosts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: ago7 } } }),
    prisma.user.count({ where: { createdAt: { gte: ago30 } } }),

    prisma.itinerary.count({ where: { visibility: 'public' } }),
    prisma.itinerary.count({ where: { visibility: 'public', createdAt: { gte: ago7 } } }),
    prisma.itinerary.count({ where: { visibility: 'public', createdAt: { gte: ago30 } } }),
    prisma.itinerary.count({ where: { visibility: 'draft' } }),
    prisma.itinerary.count({ where: { visibility: 'public', postType: 'guide' } }),

    prisma.bucketListItem.count(),
    prisma.comment.count(),

    prisma.destination.groupBy({
      by: ['name', 'country'],
      _count: { id: true },
      where: { itinerary: { visibility: 'public' } },
      orderBy: { _count: { id: 'desc' } },
      take: 8,
    }),

    prisma.itinerary.findMany({
      where: { visibility: 'public' },
      orderBy: { bucketedBy: { _count: 'desc' } },
      take: 5,
      select: {
        id: true, title: true,
        user: { select: { name: true } },
        _count: { select: { bucketedBy: true } },
      },
    }),

    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, name: true, email: true, createdAt: true,
        _count: { select: { itineraries: true } } },
    }),

    prisma.itinerary.findMany({
      where: { visibility: 'public' },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true, title: true, postType: true, createdAt: true,
        user: { select: { name: true } },
        _count: { select: { bucketedBy: true, comments: true } },
      },
    }),
  ])

  function fmt(d: Date) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Site overview</p>
      </div>

      {/* ── Top stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total users',   value: totalUsers,   sub: `+${newUsers30} this month` },
          { label: 'Public posts',  value: totalPublic,  sub: `+${newPublic30} this month` },
          { label: 'Saves',         value: totalSaves,   sub: `across all trips` },
          { label: 'Comments',      value: totalComments,sub: `total` },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-900">{s.value.toLocaleString()}</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">{s.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Growth ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">User growth</h2>
          <div className="space-y-2">
            {[
              { label: 'Last 7 days',  value: newUsers7 },
              { label: 'Last 30 days', value: newUsers30 },
              { label: 'All time',     value: totalUsers },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{r.label}</span>
                <span className="font-semibold text-gray-900">{r.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Post breakdown</h2>
          <div className="space-y-2">
            {[
              { label: 'New this week',  value: newPublic7 },
              { label: 'New this month', value: newPublic30 },
              { label: 'Guides',         value: totalGuides },
              { label: 'Drafts',         value: totalDrafts },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{r.label}</span>
                <span className="font-semibold text-gray-900">{r.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Top destinations + Most saved ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Top destinations</h2>
          <div className="space-y-2">
            {topDests.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate mr-2">
                  {d.name}{d.country ? <span className="text-gray-400">, {d.country}</span> : null}
                </span>
                <span className="text-gray-500 shrink-0">{d._count.id} trip{d._count.id !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Most saved trips</h2>
          <div className="space-y-2">
            {mostSaved.map(it => (
              <div key={it.id} className="flex items-center justify-between text-sm gap-2">
                <div className="min-w-0">
                  <a href={`/itinerary/${it.id}`} className="font-medium text-gray-900 hover:text-blue-600 truncate block">{it.title}</a>
                  <p className="text-xs text-gray-400">{it.user.name}</p>
                </div>
                <span className="text-gray-500 shrink-0">♥ {it._count.bucketedBy}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent signups ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Recent signups</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium text-right">Posts</th>
                <th className="pb-2 font-medium text-right">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentUsers.map(u => (
                <tr key={u.id}>
                  <td className="py-2 font-medium text-gray-900">{u.name}</td>
                  <td className="py-2 text-gray-500">{u.email}</td>
                  <td className="py-2 text-right text-gray-600">{u._count.itineraries}</td>
                  <td className="py-2 text-right text-gray-400 whitespace-nowrap">{fmt(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Recent posts ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Recent posts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Title</th>
                <th className="pb-2 font-medium">By</th>
                <th className="pb-2 font-medium text-right">Saves</th>
                <th className="pb-2 font-medium text-right">Comments</th>
                <th className="pb-2 font-medium text-right">Posted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentPosts.map(it => (
                <tr key={it.id}>
                  <td className="py-2">
                    <a href={`/itinerary/${it.id}`} className="font-medium text-gray-900 hover:text-blue-600 line-clamp-1">{it.title}</a>
                    {it.postType === 'guide' && <span className="ml-1 text-xs text-green-600">guide</span>}
                  </td>
                  <td className="py-2 text-gray-500">{it.user.name}</td>
                  <td className="py-2 text-right text-gray-600">{it._count.bucketedBy}</td>
                  <td className="py-2 text-right text-gray-600">{it._count.comments}</td>
                  <td className="py-2 text-right text-gray-400 whitespace-nowrap">{fmt(it.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

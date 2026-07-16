import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { followUser, unfollowUser } from '@/actions/friends'

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return null
  return (
    <span className="text-sm leading-none">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={s <= rating ? 'text-yellow-400' : 'text-gray-200'}>★</span>
      ))}
    </span>
  )
}

const SECTIONS = [
  { type: 'hotel',      label: 'Hotels',      icon: '🏨' },
  { type: 'food_drink', label: 'Food & Drink', icon: '🍜' },
  { type: 'activity',   label: 'Activities',  icon: '🎯' },
] as const

export default async function ItineraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()

  const it = await prisma.itinerary.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      destinations: {
        orderBy: { order: 'asc' },
        include: { items: true },
      },
      photos: true,
    },
  })

  if (!it) notFound()

  const isOwn = session?.user?.id === it.user.id
  const isFollowing = session?.user?.id && !isOwn
    ? !!(await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: session.user.id, followingId: it.user.id } },
      }))
    : false

  function fmtShort(d: Date) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const days =
    Math.ceil((new Date(it.endDate).getTime() - new Date(it.startDate).getTime()) / 86400000) + 1

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/" className="text-sm text-indigo-600 hover:underline mb-6 inline-block">
        ← Back to feed
      </Link>

      {it.photos.length > 0 && (
        <div className="relative h-72 w-full rounded-2xl overflow-hidden mb-8 bg-gray-100">
          <Image src={it.photos[0].url} alt={it.title} fill className="object-cover" priority />
        </div>
      )}

      <div className="mb-8">
        <div className="flex flex-wrap gap-2 mb-3">
          {it.destinations.map((d, i) => (
            <span key={i} className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-medium">
              {d.name}{d.country ? `, ${d.country}` : ''}
            </span>
          ))}
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${
            it.audience === 'adult' ? 'bg-rose-50 text-rose-600' : 'bg-green-50 text-green-700'
          }`}>
            {it.audience === 'adult' ? 'Adults only' : 'Family friendly'}
          </span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 leading-tight">{it.title}</h1>
        {it.description && <p className="text-gray-600 mt-2 text-base">{it.description}</p>}

        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-500">
          <span>📅 {fmtShort(it.startDate)} – {fmtShort(it.endDate)} ({days} days)</span>
          <div className="flex items-center gap-3">
            <span>✍️ {it.user.name}</span>
            {session?.user && !isOwn && (
              <form action={async () => {
                'use server'
                if (isFollowing) await unfollowUser(it.user.id)
                else await followUser(it.user.id)
              }}>
                <button type="submit"
                  className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
                    isFollowing
                      ? 'border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500'
                      : 'border-indigo-300 text-indigo-600 hover:bg-indigo-50'
                  }`}>
                  {isFollowing ? 'Following' : '+ Follow'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {it.destinations.length > 0 && (
        <section className="mb-8 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Destinations</h2>
          {it.destinations.map((dest) => (
            <div key={dest.id} className="bg-white border border-gray-200 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📍 {dest.name}{dest.country ? `, ${dest.country}` : ''}
              </h3>

              {SECTIONS.map(({ type, label, icon }) => {
                const items = dest.items.filter((it) => it.type === type)
                if (items.length === 0) return null
                return (
                  <div key={type} className="mb-4 last:mb-0">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      {icon} {label}
                    </p>
                    <ul className="space-y-2">
                      {items.map((item) => (
                        <li key={item.id} className="flex gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800">{item.name}</span>
                              <Stars rating={item.rating} />
                            </div>
                            {item.notes && (
                              <p className="text-xs text-gray-500 mt-0.5">{item.notes}</p>
                            )}
                            {item.link && (
                              <a href={item.link} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-indigo-500 hover:underline mt-0.5 inline-block">
                                🔗 Official site
                              </a>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}

              {dest.items.length === 0 && (
                <p className="text-sm text-gray-400 italic">No items listed.</p>
              )}
            </div>
          ))}
        </section>
      )}

      {it.notes && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Notes & Tips</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-gray-700 whitespace-pre-line">
            {it.notes}
          </div>
        </section>
      )}

      {it.photos.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Photos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {it.photos.map((photo) => (
              <div key={photo.id} className="space-y-1">
                <div className="relative h-44 rounded-xl overflow-hidden bg-gray-100">
                  <Image src={photo.url} alt={photo.caption ?? ''} fill className="object-cover" />
                </div>
                {photo.caption && (
                  <p className="text-xs text-gray-500 text-center">{photo.caption}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

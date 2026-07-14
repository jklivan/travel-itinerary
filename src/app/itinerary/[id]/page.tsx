import { prisma } from '@/lib/prisma'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function ItineraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const it = await prisma.itinerary.findUnique({
    where: { id },
    include: {
      user: { select: { name: true } },
      destinations: {
        orderBy: { order: 'asc' },
        include: { items: true },
      },
      photos: true,
    },
  })

  if (!it) notFound()

  function fmtShort(d: Date) {
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }
  const days =
    Math.ceil(
      (new Date(it.endDate).getTime() - new Date(it.startDate).getTime()) / 86400000
    ) + 1

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/" className="text-sm text-indigo-600 hover:underline mb-6 inline-block">
        ← Back to feed
      </Link>

      {/* Cover photo */}
      {it.photos.length > 0 && (
        <div className="relative h-72 w-full rounded-2xl overflow-hidden mb-8 bg-gray-100">
          <Image
            src={it.photos[0].url}
            alt={it.title}
            fill
            className="object-cover"
            priority
          />
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2 mb-3">
          {it.destinations.map((d, i) => (
            <span key={i} className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-medium">
              {d.name}{d.country ? `, ${d.country}` : ''}
            </span>
          ))}
        </div>
        <h1 className="text-3xl font-bold text-gray-900 leading-tight">{it.title}</h1>
        {it.description && (
          <p className="text-gray-600 mt-2 text-base">{it.description}</p>
        )}
        <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-500">
          <span>📅 {fmtShort(it.startDate)} – {fmtShort(it.endDate)} ({days} days)</span>
          {it.budget && <span>💰 {it.currency} {it.budget.toLocaleString()}</span>}
          <span>✍️ {it.user.name}</span>
        </div>
      </div>

      {/* Destinations with items */}
      {it.destinations.length > 0 && (
        <section className="mb-8 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Destinations</h2>
          {it.destinations.map((dest) => {
            const acts = dest.items.filter((it) => it.type === 'activity')
            const food = dest.items.filter((it) => it.type === 'food_drink')
            return (
              <div key={dest.id} className="bg-white border border-gray-200 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  📍 {dest.name}{dest.country ? `, ${dest.country}` : ''}
                </h3>

                {acts.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Activities
                    </p>
                    <ul className="space-y-2">
                      {acts.map((item) => (
                        <li key={item.id} className="flex gap-3">
                          <span className="text-indigo-500 mt-0.5">🎯</span>
                          <div>
                            <span className="text-sm font-medium text-gray-800">{item.name}</span>
                            {item.notes && (
                              <p className="text-xs text-gray-500 mt-0.5">{item.notes}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {food.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Food & Drink
                    </p>
                    <ul className="space-y-2">
                      {food.map((item) => (
                        <li key={item.id} className="flex gap-3">
                          <span className="mt-0.5">🍜</span>
                          <div>
                            <span className="text-sm font-medium text-gray-800">{item.name}</span>
                            {item.notes && (
                              <p className="text-xs text-gray-500 mt-0.5">{item.notes}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {acts.length === 0 && food.length === 0 && (
                  <p className="text-sm text-gray-400 italic">No activities or places listed.</p>
                )}
              </div>
            )
          })}
        </section>
      )}

      {/* Notes */}
      {it.notes && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Notes & Tips</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-gray-700 whitespace-pre-line">
            {it.notes}
          </div>
        </section>
      )}

      {/* Photo gallery */}
      {it.photos.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Photos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {it.photos.map((photo) => (
              <div key={photo.id} className="space-y-1">
                <div className="relative h-44 rounded-xl overflow-hidden bg-gray-100">
                  <Image
                    src={photo.url}
                    alt={photo.caption ?? ''}
                    fill
                    className="object-cover"
                  />
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

import Link from 'next/link'
import Image from 'next/image'

type Props = {
  id: string
  title: string
  description: string | null
  startDate: Date
  endDate: Date
  budget: number | null
  currency: string
  authorName: string
  destinations: { name: string; country: string | null }[]
  coverPhoto: string | null
  createdAt: Date
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function tripLength(start: Date, end: Date) {
  const days = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1
  return `${days} day${days !== 1 ? 's' : ''}`
}

export default function ItineraryCard({
  id, title, description, startDate, endDate, budget, currency,
  authorName, destinations, coverPhoto, createdAt,
}: Props) {
  return (
    <Link href={`/itinerary/${id}`} className="block group">
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
        {coverPhoto ? (
          <div className="relative h-48 w-full bg-gray-100">
            <Image
              src={coverPhoto}
              alt={title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="h-48 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
            <span className="text-5xl">✈️</span>
          </div>
        )}
        <div className="p-5">
          <div className="flex flex-wrap gap-1 mb-3">
            {destinations.map((d, i) => (
              <span
                key={i}
                className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium"
              >
                {d.name}{d.country ? `, ${d.country}` : ''}
              </span>
            ))}
          </div>
          <h2 className="font-semibold text-gray-900 text-lg leading-snug group-hover:text-indigo-600 transition-colors">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{description}</p>
          )}
          <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
            <div className="flex gap-3">
              <span>{formatDate(startDate)}</span>
              <span>·</span>
              <span>{tripLength(startDate, endDate)}</span>
              {budget && (
                <>
                  <span>·</span>
                  <span>{currency} {budget.toLocaleString()}</span>
                </>
              )}
            </div>
            <span className="font-medium text-gray-500">{authorName}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

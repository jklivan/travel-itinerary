'use client'

import { useRouter } from 'next/navigation'
import { TAGS } from '@/lib/tags'

export default function TagBrowser({ selected }: { selected: string[] }) {
  const router = useRouter()

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((t) => t !== id)
      : [...selected, id]
    const qs = next.length > 0 ? `&tags=${next.join(',')}` : ''
    router.push(`/explore?view=tags${qs}`)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {TAGS.map((t) => {
        const active = selected.includes(t.id)
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => toggle(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
              active
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            <span>{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

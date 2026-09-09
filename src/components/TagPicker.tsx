'use client'

import { TAGS } from '@/lib/tags'

export default function TagPicker({
  selected,
  onChange,
  theme = 'default',
}: {
  selected: string[]
  onChange: (tags: string[]) => void
  theme?: 'default' | 'paper'
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id])
  }

  return (
    <div className="flex flex-wrap gap-2">
      {TAGS.map((tag) => {
        const active = selected.includes(tag.id)
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              theme === 'paper'
                ? active
                  ? 'bg-[#507c76] border-[#507c76] text-white shadow-sm'
                  : 'bg-[#fffdf6] border-[#d7cebc] text-[#6b7067] hover:border-[#507c76] hover:text-[#507c76]'
                : active
                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            <span>{tag.emoji}</span>
            {tag.label}
          </button>
        )
      })}
    </div>
  )
}

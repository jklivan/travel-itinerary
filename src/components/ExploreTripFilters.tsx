'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TAGS } from '@/lib/tags'
import { TRIP_TYPES } from '@/lib/exploreFilters'

export default function ExploreTripFilters({ types, tags }: { types: string[]; tags: string[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState({ types, tags })
  const groups = [
    { name: 'types' as const, title: 'Who’s coming?', options: TRIP_TYPES },
    { name: 'tags' as const, title: 'What’s your travel style?', options: TAGS },
  ]

  return <form className="rounded-2xl border border-[#C4A882] bg-[#FAF7F2] p-5 sm:p-6" onSubmit={event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const query = new URLSearchParams({ view: 'tags' })
    for (const name of ['types', 'tags']) {
      const values = data.getAll(name).map(String)
      if (values.length) query.set(name, values.join(','))
    }
    startTransition(() => router.push(`/explore?${query}`, { scroll: false }))
  }}>
    <p className="mb-5 text-sm leading-relaxed text-[#8B6F4E]">Choose as many as you like. We’ll find trips for any selected group with at least one of your selected vibes.</p>
    {groups.map(group => <fieldset key={group.name} disabled={pending} className="mb-6">
      <legend className="mb-3 font-[family-name:var(--font-playfair)] text-xl text-[#2C1810]">{group.title}</legend>
      <div className="flex flex-wrap gap-2">
        {group.options.map(option => <label key={option.id} className="cursor-pointer">
          <input type="checkbox" name={group.name} value={option.id} checked={selected[group.name].includes(option.id)} onChange={event => {
            const checked = event.target.checked
            setSelected(current => ({ ...current, [group.name]: checked ? [...current[group.name], option.id] : current[group.name].filter(id => id !== option.id) }))
          }} className="peer sr-only" />
          <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#C4A882] bg-[#FFFCF7] px-3.5 py-2 text-sm font-medium text-[#5C3D2E] transition-colors hover:bg-[#E8D5B7] peer-checked:border-[#507c76] peer-checked:bg-[#507c76] peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#507c76] peer-disabled:opacity-60">
            <span aria-hidden="true">{option.emoji}</span>{option.label}
          </span>
        </label>)}
      </div>
    </fieldset>)}
    <div className="flex flex-wrap items-center gap-4 border-t border-[#E8D5B7] pt-4">
      <button type="submit" disabled={pending} className="min-h-11 rounded-full bg-[#2C1810] px-6 py-2.5 text-sm font-medium text-[#FAF7F2] transition-colors hover:bg-[#5C3D2E] disabled:opacity-60">{pending ? 'Finding trips…' : 'Find trips'}</button>
      <button type="button" disabled={pending} onClick={() => {
        setSelected({ types: [], tags: [] })
        startTransition(() => router.push('/explore?view=tags', { scroll: false }))
      }} className="text-sm text-[#8B6F4E] underline underline-offset-4">Clear all</button>
    </div>
  </form>
}

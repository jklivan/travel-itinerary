'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TAGS } from '@/lib/tags'
import { TRIP_TYPES } from '@/lib/exploreFilters'
import { ChevronDown, MapPin } from 'lucide-react'

export default function ExploreTripFilters({
  types,
  tags,
  location: initialLocation,
}: {
  types: string[]
  tags: string[]
  location: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState({ types, tags })
  const [location, setLocation] = useState(initialLocation)
  const hasActive = types.length > 0 || tags.length > 0 || !!initialLocation
  const [open, setOpen] = useState(!hasActive)

  const groups = [
    { name: 'types' as const, title: 'Who\u2019s coming?', options: TRIP_TYPES },
    { name: 'tags' as const, title: 'What\u2019s your travel style?', options: TAGS },
  ]

  function submit() {
    const query = new URLSearchParams({ view: 'tags' })
    if (selected.types.length) query.set('types', selected.types.join(','))
    if (selected.tags.length) query.set('tags', selected.tags.join(','))
    if (location.trim()) query.set('location', location.trim())
    startTransition(() => {
      router.push(`/explore?${query}`, { scroll: false })
      setOpen(false)
    })
  }

  const activeLabels = [
    ...selected.types.map(id => TRIP_TYPES.find(t => t.id === id)?.label ?? id),
    ...selected.tags.map(id => TAGS.find(t => t.id === id)?.label ?? id),
    ...(location.trim() ? [location.trim()] : []),
  ]

  return (
    <div className="rounded-2xl border border-[#c1ad93] bg-[#faf7f1] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-3"
      >
        <div className="min-w-0">
          <span className="font-[family-name:var(--font-playfair)] text-lg text-[#242e25]">
            {hasActive ? 'Your filters' : 'Filter trips'}
          </span>
          {!open && activeLabels.length > 0 && (
            <p className="text-sm text-[#8B6F4E] mt-0.5 truncate">
              {activeLabels.slice(0, 4).join(' · ')}{activeLabels.length > 4 ? ` +${activeLabels.length - 4} more` : ''}
            </p>
          )}
        </div>
        <ChevronDown
          className="shrink-0 h-5 w-5 text-[#8B6F4E] transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {open && (
        <form
          className="px-5 pb-5 sm:px-6 sm:pb-6 border-t border-[#dfd3c2]"
          onSubmit={e => { e.preventDefault(); submit() }}
        >
          <p className="mt-4 mb-5 text-sm leading-relaxed text-[#8B6F4E]">
            Choose as many as you like. We&apos;ll find trips for any selected group with at least one of your selected vibes.
          </p>

          {groups.map(group => (
            <fieldset key={group.name} disabled={pending} className="mb-6">
              <legend className="mb-3 font-[family-name:var(--font-playfair)] text-xl text-[#242e25]">
                {group.title}
              </legend>
              <div className="grid grid-cols-4 gap-2">
                {group.options.map(option => {
                  const isChecked = selected[group.name].includes(option.id)
                  return (
                    <label key={option.id} className="cursor-pointer">
                      <input
                        type="checkbox"
                        name={group.name}
                        value={option.id}
                        checked={isChecked}
                        onChange={e => {
                          const checked = e.target.checked
                          setSelected(cur => ({
                            ...cur,
                            [group.name]: checked
                              ? [...cur[group.name], option.id]
                              : cur[group.name].filter(id => id !== option.id),
                          }))
                        }}
                        className="sr-only"
                      />
                      <div className={[
                        'flex flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 text-center transition-all select-none',
                        isChecked
                          ? 'border-[#59694f] bg-[#59694f] shadow-sm'
                          : 'border-[#c1ad93] bg-[#FFFCF7] hover:bg-[#f0e8db]',
                        pending ? 'opacity-60' : '',
                      ].join(' ')}>
                        <span className="text-xl leading-none" aria-hidden="true">{option.emoji}</span>
                        <span className={`text-[10px] font-medium leading-tight ${isChecked ? 'text-white' : 'text-[#485340]'}`}>
                          {option.label}
                        </span>
                      </div>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ))}

          <div className="mb-6">
            <p className="mb-3 font-[family-name:var(--font-playfair)] text-xl text-[#242e25]">Where?</p>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B6F4E] pointer-events-none" />
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Europe, Japan, beach…"
                disabled={pending}
                className="w-full rounded-full border border-[#c1ad93] bg-[#FFFCF7] pl-9 pr-4 py-2.5 text-sm text-[#242e25] placeholder:text-[#c1ad93] focus:outline-2 focus:outline-[#59694f] disabled:opacity-60"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-[#dfd3c2] pt-4">
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 rounded-full bg-[#242e25] px-6 py-2.5 text-sm font-medium text-[#faf7f1] transition-colors hover:bg-[#485340] disabled:opacity-60"
            >
              {pending ? 'Finding trips\u2026' : 'Find trips'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setSelected({ types: [], tags: [] })
                setLocation('')
                startTransition(() => router.push('/explore?view=tags', { scroll: false }))
              }}
              className="text-sm text-[#8B6F4E] underline underline-offset-4"
            >
              Clear all
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

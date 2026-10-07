'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useTransition } from 'react'
import { Search } from 'lucide-react'

export default function ExploreSearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const current = searchParams.get('q') ?? ''

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = inputRef.current?.value.trim()
    if (!q) return
    startTransition(() => {
      router.push(`/explore?q=${encodeURIComponent(q)}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="relative mb-6">
      <Search
        size={16}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brown pointer-events-none"
      />
      <input
        key={current}
        ref={inputRef}
        type="text"
        defaultValue={current}
        placeholder={'Try \u201cfamily trip in Europe\u201d or \u201ccheap beach vacation\u201d\u2026'}
        className="w-full pl-10 pr-24 py-3 rounded-xl border border-line-strong text-xs sm:text-sm tracking-normal text-ink placeholder-brown focus:outline-none focus:ring-2 focus:ring-link focus:border-transparent bg-cream shadow-sm"
      />
      <button
        type="submit"
        disabled={isPending}
        className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-link text-white text-sm font-medium rounded-lg hover:bg-ink transition-colors disabled:opacity-50"
      >
        {isPending ? 'Searching…' : 'Search'}
      </button>
    </form>
  )
}

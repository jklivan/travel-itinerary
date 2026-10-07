'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useTransition } from 'react'
import SearchField from '@/components/ui/SearchField'

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
    <form onSubmit={handleSubmit} className="mb-6">
      <SearchField
        key={current}
        ref={inputRef}
        defaultValue={current}
        aria-label="Search trips"
        placeholder={'Try \u201cfamily trip in Europe\u201d or \u201ccheap beach vacation\u201d\u2026'}
        style={{ '--placeholder-size': '0.75rem' } as React.CSSProperties}
        buttonLabel={isPending ? 'Searching…' : 'Search'}
        buttonDisabled={isPending}
      />
    </form>
  )
}

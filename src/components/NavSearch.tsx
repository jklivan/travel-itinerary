'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useRef, useEffect, useCallback, Suspense } from 'react'

type Suggestion = { label: string; main: string; secondary: string }

function NavSearchInner() {
  const pathname = usePathname()
  const params = useSearchParams()
  const search = pathname === '/' ? params.get('search') ?? '' : ''
  return <NavSearchForm key={`${pathname}:${search}`} initialQuery={search} />
}

function NavSearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<AbortController | null>(null)

  const cancelSuggestions = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    requestRef.current?.abort()
  }, [])

  useEffect(() => cancelSuggestions, [cancelSuggestions])

  function closeSuggestions() {
    cancelSuggestions()
    setSuggestions([])
    setOpen(false)
    setActiveIdx(-1)
  }

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }
    const controller = new AbortController()
    requestRef.current = controller
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(q)}&type=destination`, { signal: controller.signal })
      if (!res.ok) return
      const data: Suggestion[] = await res.json()
      if (controller.signal.aborted) return
      setSuggestions(data)
      setOpen(data.length > 0)
      setActiveIdx(-1)
    } catch {
      // Keep free-text search available if suggestions fail or are cancelled.
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    closeSuggestions()
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  function pick(s: Suggestion) {
    setQuery(s.main)
    closeSuggestions()
    router.push(`/?search=${encodeURIComponent(s.main)}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    closeSuggestions()
    if (q) router.push(`/?search=${encodeURIComponent(q)}`)
    else router.push('/')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pick(suggestions[activeIdx]) }
    else if (e.key === 'Escape') { closeSuggestions() }
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        cancelSuggestions()
        setSuggestions([])
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [cancelSuggestions])

  return (
    <form role="search" onSubmit={handleSubmit} className="flex items-center w-full">
      <div ref={containerRef} className="relative w-full">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 text-sm">🔍</span>
        <input
          type="search"
          aria-label="Search destinations"
          enterKeyHint="search"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search destinations…"
          autoComplete="off"
          className="w-full min-h-12 pl-9 pr-3 py-3 text-base text-white placeholder-white/60 rounded-lg bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/20 transition-all"
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full bg-[#faf7f1] rounded-xl border border-[#dfd3c2] shadow-lg overflow-hidden">
            {suggestions.map((s, i) => (
              <li
                key={i}
                onMouseDown={() => pick(s)}
                className={`px-3 py-2.5 cursor-pointer text-sm transition-colors ${i === activeIdx ? 'bg-[#dfd3c2]' : 'hover:bg-[#dfd3c2]'}`}
              >
                <span className="font-medium text-[#242e25]">{s.main}</span>
                {s.secondary && (
                  <span className="text-[#8B6F4E] text-xs ml-1.5">{s.secondary}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </form>
  )
}

export default function NavSearch() {
  return (
    <Suspense>
      <NavSearchInner />
    </Suspense>
  )
}

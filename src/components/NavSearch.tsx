'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useRef, useEffect, useCallback, Suspense } from 'react'

type Suggestion = { label: string; main: string; secondary: string }

function NavSearchInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [query, setQuery] = useState(params.get('search') ?? '')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }
    const res = await fetch(`/api/places?q=${encodeURIComponent(q)}&type=destination`)
    if (!res.ok) return
    const data: Suggestion[] = await res.json()
    setSuggestions(data)
    setOpen(data.length > 0)
    setActiveIdx(-1)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  function pick(s: Suggestion) {
    setQuery(s.main)
    setSuggestions([])
    setOpen(false)
    router.push(`/?search=${encodeURIComponent(s.main)}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    setOpen(false)
    if (q) router.push(`/?search=${encodeURIComponent(q)}`)
    else router.push('/')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pick(suggestions[activeIdx]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <form onSubmit={handleSubmit} className="flex items-center w-full">
      <div ref={containerRef} className="relative w-full">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 text-sm">🔍</span>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search destinations…"
          autoComplete="off"
          className="w-full pl-8 pr-3 py-1.5 text-sm text-white placeholder-white/60 rounded-lg bg-white/20 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/30 transition-all"
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            {suggestions.map((s, i) => (
              <li
                key={i}
                onMouseDown={() => pick(s)}
                className={`px-3 py-2.5 cursor-pointer text-sm transition-colors ${i === activeIdx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <span className="font-medium text-gray-900">{s.main}</span>
                {s.secondary && (
                  <span className="text-gray-400 text-xs ml-1.5">{s.secondary}</span>
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

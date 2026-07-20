'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

type Suggestion = { label: string; main: string; secondary: string }

type Props = {
  value: string
  onChange: (val: string) => void
  onSelect?: (main: string, secondary: string) => void
  type?: 'destination' | 'hotel' | 'restaurant' | 'activity'
  placeholder?: string
  className?: string
}

export default function PlacesAutocomplete({
  value, onChange, onSelect, type = 'destination', placeholder, className,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }
    const res = await fetch(`/api/places?q=${encodeURIComponent(q)}&type=${type}`)
    if (!res.ok) return
    const data: Suggestion[] = await res.json()
    setSuggestions(data)
    setOpen(data.length > 0)
    setActiveIdx(-1)
  }, [type])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  function pick(s: Suggestion) {
    onChange(s.main)
    onSelect?.(s.main, s.secondary)
    setSuggestions([])
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pick(suggestions[activeIdx]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  // Close on outside click
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
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
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
  )
}

'use client'

import { useState, useRef, useEffect, useCallback, type InputHTMLAttributes } from 'react'

type Suggestion = { label: string; main: string; secondary: string; placeId: string | null }

type Props = Pick<InputHTMLAttributes<HTMLInputElement>, 'name' | 'id' | 'required' | 'maxLength' | 'autoFocus'> & {
  value: string
  onChange: (val: string) => void
  onSelect?: (main: string, secondary: string, placeId?: string | null) => void
  type?: 'destination' | 'hotel' | 'restaurant' | 'activity'
  placeholder?: string
  className?: string
  city?: string
}

export default function PlacesAutocomplete({
  value, onChange, onSelect, type = 'destination', placeholder, className, city, ...inputProps
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<AbortController | null>(null)
  const [resultKey, setResultKey] = useState('')
  const [error, setError] = useState('')
  const currentKey = JSON.stringify([value, type, city])

  const cancelSuggestions = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    requestRef.current?.abort()
  }, [])

  useEffect(() => cancelSuggestions, [cancelSuggestions, type, city])

  const closeSuggestions = useCallback(() => {
    cancelSuggestions()
    setSuggestions([])
    setError('')
    setOpen(false)
    setActiveIdx(-1)
  }, [cancelSuggestions])

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }
    const params = new URLSearchParams({ q, type })
    if (city) params.set('city', city)
    const controller = new AbortController()
    requestRef.current = controller
    try {
      const res = await fetch(`/api/places?${params}`, { signal: controller.signal })
      if (!res.ok) {
        if (!controller.signal.aborted) {
          setResultKey(JSON.stringify([q, type, city]))
          setError(city ? 'Could not load suggestions for this destination. Check the location or enter the place manually.' : 'Could not load suggestions. You can still enter a place manually.')
        }
        return
      }
      const data: Suggestion[] = await res.json()
      if (controller.signal.aborted) return
      setResultKey(JSON.stringify([q, type, city]))
      setSuggestions(data)
      setOpen(data.length > 0)
      setActiveIdx(-1)
    } catch {
      // Free-text entry remains available if suggestions fail or are cancelled.
    }
  }, [type, city])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onChange(val)
    closeSuggestions()
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  function pick(s: Suggestion) {
    onChange(s.main)
    onSelect?.(s.main, s.secondary, s.placeId)
    closeSuggestions()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || resultKey !== currentKey) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIdx >= 0) pick(suggestions[activeIdx]); else closeSuggestions() }
    else if (e.key === 'Escape') { closeSuggestions() }
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeSuggestions()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [closeSuggestions])

  return (
    <div ref={containerRef} className="relative">
      <input
        {...inputProps}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={closeSuggestions}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {error && resultKey === currentKey && <p role="status" className="mt-1 text-xs text-amber-800">{error}</p>}
      {open && resultKey === currentKey && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          <li
            onPointerDown={event => { event.preventDefault(); closeSuggestions() }}
            className="px-3 py-2.5 cursor-pointer text-sm bg-gray-50 border-b border-gray-100 text-gray-500 hover:bg-gray-100 flex items-center gap-1.5"
          >
            <span className="text-blue-500 shrink-0">↵</span>
            <span className="truncate">Use &ldquo;{value}&rdquo;</span>
          </li>
          {suggestions.map((s, i) => (
            <li
              key={i}
              onPointerDown={event => { event.preventDefault(); pick(s) }}
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

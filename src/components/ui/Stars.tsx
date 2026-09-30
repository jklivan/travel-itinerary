'use client'

import { Star } from 'lucide-react'

// The one star picker: gold filled stars, hollow outlines when empty. Tap a star again to clear it.
export function StarPicker({ value, onChange, name, size = 24, disabled = false }: { value: number; onChange: (value: number) => void; name?: string; size?: number; disabled?: boolean }) {
  return <div className="flex items-center">
    {[1, 2, 3, 4, 5].map(star => <button key={star} type="button" disabled={disabled} aria-label={`Rate ${name ? `${name} ` : ''}${star} out of 5`} aria-pressed={value === star}
      onClick={() => onChange(value === star ? 0 : star)} className="flex items-center justify-center p-1 focus:outline-none disabled:opacity-50" style={{ minWidth: size + 12, minHeight: size + 12 }}>
      <Star size={size} strokeWidth={1.6} className={star <= value ? 'fill-gold text-gold' : 'fill-none text-gold-faint'} />
    </button>)}
  </div>
}

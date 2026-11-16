'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'

// The round copy button beside an address: once copied it turns navy with a tick and says "Copied" just above it
// for a couple of seconds (a message lower down the card was easy to miss). onFail: copying isn't allowed here, so
// the card can say to select the text instead.
export default function CopyButton({ text, label, onFail }: { text: string; label: string; onFail?: () => void }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  // "Copied" floats just above the button, so the address beside it keeps its width (inline, it squeezed a long
  // address onto two lines mid-word).
  return <span className="relative flex shrink-0">
    {copied && <span role="status" className="absolute bottom-full right-0 z-10 mb-1 w-max rounded-lg bg-ink px-2 py-1 text-xs font-semibold text-white">Copied</span>}
    <button type="button" onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true), () => onFail?.())} aria-label={label} className={`btn-icon ${copied ? 'btn-icon-done' : ''}`}>{copied ? <Check size={18} /> : <Copy size={18} />}</button>
  </span>
}

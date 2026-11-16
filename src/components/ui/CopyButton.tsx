'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'

// The round copy button beside an address: once copied it turns navy with a tick and says "Copied" right next to it
// for a couple of seconds (a message lower down the card was easy to miss). onFail: copying isn't allowed here, so
// the card can say to select the text instead.
export default function CopyButton({ text, label, onFail }: { text: string; label: string; onFail?: () => void }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  return <span className="flex shrink-0 items-center gap-1.5">
    {copied && <span role="status" className="text-xs font-semibold text-ink">Copied</span>}
    <button type="button" onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true), () => onFail?.())} aria-label={label} className={`btn-icon ${copied ? 'btn-icon-done' : ''}`}>{copied ? <Check size={18} /> : <Copy size={18} />}</button>
  </span>
}

'use client'

import { useEffect, useState } from 'react'
import { Sparkles, X } from 'lucide-react'

const KEY = 'postcard.tip.aiAgent'

// A one-time pop-up on the new trip and post pages: ask your AI assistant for an itinerary, then upload it. It floats
// above the page (not part of it), shows once until closed (or until something's imported), remembered on this device.
export default function AiAgentTip({ hidden = false }: { hidden?: boolean }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    let seen = false
    try { seen = localStorage.getItem(KEY) === '1' } catch { /* storage off: show it this time */ }
    if (!seen) { const timer = setTimeout(() => setShow(true), 400); return () => clearTimeout(timer) }
  }, [])
  function close() {
    setShow(false)
    try { localStorage.setItem(KEY, '1') } catch { /* nothing to remember it in */ }
  }
  if (!show || hidden) return null
  return <aside role="dialog" aria-label="Tip" className="fixed inset-x-4 bottom-[calc(var(--app-bottom-clearance)+0.75rem)] z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-cream p-4 pr-10 shadow-pop">
    <Sparkles size={22} className="mt-1 shrink-0 text-ink" />
    {/* A little itinerary document, like the one an assistant sends. */}
    <div aria-hidden="true" className="relative mt-1 h-24 w-20 shrink-0">
      <span className="panel absolute inset-0 translate-x-1.5 translate-y-1 rotate-3" />
      <span className="panel absolute inset-0 -rotate-2 px-2 py-2">
        <span className="block text-micro font-semibold leading-tight text-ink">Italy Trip Itinerary</span>
        {[80, 60, 70, 50, 65, 45].map((width, index) => <span key={index} className="mt-1.5 block h-1 rounded-full bg-line" style={{ width: `${width}%` }} />)}
      </span>
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold leading-snug text-ink">Tip: Ask your AI agent (Instinct, Muse, etc.) for an itinerary</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">They can send you a past trip itinerary (PDF or doc) that you can upload here and turn into a Postcard in seconds.</p>
      <button type="button" onClick={close} className="btn btn-primary btn-sm mt-3">Got it</button>
    </div>
    <button type="button" onClick={close} aria-label="Close tip" className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-muted hover:text-ink"><X size={18} /></button>
  </aside>
}

// Importing counts as having seen the tip.
export function markAiAgentTipSeen() {
  try { localStorage.setItem(KEY, '1') } catch { /* nothing to remember it in */ }
}

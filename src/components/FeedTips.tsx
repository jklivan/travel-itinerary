'use client'

import { useEffect, useState } from 'react'
import { Lightbulb, X } from 'lucide-react'
import NewUserTips from './NewUserTips'

// The Feed's top-left Tips button: the intro's last slide (tips for new users) as a full-screen sheet.
export default function FeedTips() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="-ml-1 flex min-h-11 items-center gap-1 pr-2 text-base text-ink hover:text-ink-soft">
      <Lightbulb size={22} strokeWidth={1.75} />Tips
    </button>
    {open && <div role="dialog" aria-modal="true" aria-labelledby="feed-tips-title" className="fixed inset-0 z-[70] flex flex-col items-center overflow-y-auto bg-paper px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] text-ink">
      <div className="flex w-full max-w-sm justify-end pt-3"><button type="button" onClick={() => setOpen(false)} aria-label="Close tips" className="btn-icon"><X size={22} /></button></div>
      <h1 id="feed-tips-title" className="type-display max-w-sm text-center normal-case tracking-normal">Tips for new users.</h1>
      <p className="mt-3 max-w-sm text-center text-base leading-snug text-link">Quick ways to get the most out of Postcard.</p>
      <NewUserTips back="/" className="mt-5 w-full max-w-sm" />
    </div>}
  </>
}

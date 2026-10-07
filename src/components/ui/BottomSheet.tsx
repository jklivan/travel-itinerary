'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

// A sheet that slides up from the bottom over the page (feed comments and likes), like Instagram's.
// Closes with ✕, a tap above it, or Escape; the page underneath doesn't scroll while it's open.
export default function BottomSheet({ title, label, onClose, footer, children }: { title: string; label: string; onClose: () => void; footer?: ReactNode; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
    // Focus starts on the list (not the close button), so no focus ring shows on open.
    body.current?.focus({ preventScroll: true })
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])
  return <dialog ref={dialog} aria-label={label} onClose={onClose}
    onClick={event => { if (event.target === dialog.current) dialog.current?.close() }}
    className="bottom-sheet m-0 mt-auto h-[78dvh] max-h-none w-full max-w-none rounded-t-3xl bg-card p-0 text-ink shadow-pop backdrop:bg-ink/40 sm:mx-auto sm:max-w-xl">
    <div className="flex h-full flex-col">
      <header className="relative border-b border-line-soft px-5 pb-3 pt-2 text-center">
        <span aria-hidden="true" className="mx-auto mb-2 block h-1 w-10 rounded-full bg-line" />
        <h2 className="type-label">{title}</h2>
        <button type="button" aria-label={`Close ${title.toLowerCase()}`} onClick={() => dialog.current?.close()} className="absolute right-3 top-2 grid size-10 place-items-center rounded-full text-muted outline-none hover:bg-chip focus-visible:ring-2 focus-visible:ring-link"><X size={18} /></button>
      </header>
      <div ref={body} tabIndex={-1} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 outline-none">{children}</div>
      {footer && <div className="border-t border-line-soft px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
    </div>
  </dialog>
}

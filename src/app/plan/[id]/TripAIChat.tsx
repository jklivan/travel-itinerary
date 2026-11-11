'use client'

import { forwardRef } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import TestPlanner, { type Turn } from '@/app/testplan/TestPlanner'
import type { UsualTravelers } from '@/lib/usualTravelers'

export type TripAI = { chat: { id: string; turns: Turn[] } | null; trip: { id: string; title: string; places: { id: string; name: string; type: string; notes: string | null; placeId: string | null; lat: number | null; lng: number | null; day: number | null; photos: string[]; destination: string }[] }; usual: UsualTravelers | null; open: boolean; draft: string; ask: string }

// The trip's AI chat, at the top of the trip page: it carries on the trip's latest conversation, and what it adds
// lands in the trip below. Folded to one bar unless just opened (a trip the chat made, Plan with AI or Ask AI).
const TripAIChat = forwardRef<HTMLDivElement, { ai: TripAI; open: boolean; onToggle: (open: boolean) => void }>(function TripAIChat({ ai, open, onToggle }, ref) {
  const started = !!ai.chat?.turns.some(turn => turn.role === 'user')
  return <div ref={ref} className="mb-4 scroll-mt-[calc(var(--app-header-height,0px)+6rem)]">
    {!open ? <button type="button" onClick={() => onToggle(true)} aria-expanded={false} className="btn btn-outline w-full justify-start bg-mist hover:bg-mist-strong"><Sparkles size={18} /><span className="flex-1 text-left">{started ? 'Continue your chat with AI' : 'Chat with AI about this trip'}</span><ChevronDown size={18} /></button>
    : <div className="panel overflow-hidden">
      <button type="button" onClick={() => onToggle(false)} aria-expanded className="flex w-full items-center gap-2 border-b border-line-soft px-4 py-3 text-left text-sm font-semibold text-ink"><Sparkles size={16} /><span className="flex-1">Chat with AI</span><span className="text-xs font-normal text-link">Fold</span><ChevronDown size={16} className="rotate-180" /></button>
      <TestPlanner key={ai.ask} embedded fromPlanner usualTravelers={ai.usual} trip={ai.trip} chat={ai.ask ? null : ai.chat} history={[]} initialDraft={ai.draft} />
    </div>}
  </div>
})
export default TripAIChat

'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Flag } from 'lucide-react'
import BottomSheet from './ui/BottomSheet'
import { reportContent, blockUser } from '@/actions/safety'
import { REPORT_REASONS, type ReportKind } from '@/lib/reports'

const WHAT: Record<ReportKind, string> = { trip: 'trip', comment: 'comment', message: 'message', snapshot: 'snapshot', question: 'question', user: 'account' }

// Report a trip, comment, message, snapshot, question or person: pick a reason, add a note if you like, send.
// Afterwards, offers to block the person. Reports are reviewed within 24 hours (admin page).
// children: what the trigger shows (defaults to a small "Report" link); className styles the trigger.
export default function ReportButton({ kind, targetId, personName, className = 'inline-flex items-center gap-1 text-xs text-muted hover:text-danger', children, onBlocked }: {
  kind: ReportKind; targetId: string; personName?: string; className?: string; children?: ReactNode; onBlocked?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState<{ subjectId: string | null } | null>(null)
  const [blocked, setBlocked] = useState(false)
  function close() { setOpen(false); setReason(''); setDetails(''); setError(''); setSent(null); setBlocked(false) }
  async function send() {
    if (!reason || busy) return
    setBusy(true); setError('')
    try { const result = await reportContent(kind, targetId, reason, details); if (result.error) setError(result.error); else setSent({ subjectId: result.subjectId ?? null }) }
    catch { setError('Could not send your report. Please try again.') } finally { setBusy(false) }
  }
  async function block() {
    if (!sent?.subjectId || busy) return
    setBusy(true); setError('')
    try { const result = await blockUser(sent.subjectId); if (result.error) setError(result.error); else { setBlocked(true); onBlocked?.(); router.refresh() } }
    catch { setError('Could not block. Please try again.') } finally { setBusy(false) }
  }
  return <>
    <button type="button" onClick={event => { event.preventDefault(); event.stopPropagation(); setOpen(true) }} aria-label={`Report this ${WHAT[kind]}`} className={className}>
      {children ?? <><Flag size={12} />Report</>}
    </button>
    {open && <BottomSheet title={`Report ${WHAT[kind]}`} label={`Report this ${WHAT[kind]}`} onClose={close}
      footer={!sent ? <button type="button" disabled={!reason || busy} onClick={() => void send()} className="btn btn-danger w-full">{busy ? 'Sending…' : 'Send report'}</button> : undefined}>
      {!sent ? <div className="space-y-4">
        <p className="text-sm text-muted">Why are you reporting this {WHAT[kind]}? Reports are private; {personName ? `${personName} won’t` : 'the person won’t'} know it was you.</p>
        <div className="flex flex-wrap gap-2">{REPORT_REASONS.map(option => <button key={option} type="button" aria-pressed={reason === option} onClick={() => setReason(option)} className="chip">{option}</button>)}</div>
        <label className="block text-sm">Anything else we should know? <span className="text-muted">(optional)</span>
          <textarea value={details} onChange={event => setDetails(event.target.value)} maxLength={1000} rows={3} className="field mt-2" /></label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div> : <div className="space-y-4">
        <p className="type-title">Thanks for letting us know</p>
        <p className="text-sm text-muted">We’ll review this within 24 hours and remove anything that breaks our rules.</p>
        {sent.subjectId && kind !== 'user' && !blocked && <div className="panel-inset space-y-2 p-3">
          <p className="text-sm">Don’t want to see {personName ?? 'this person'}’s posts? Blocking hides their trips, comments, snapshots and messages from you.</p>
          <button type="button" disabled={busy} onClick={() => void block()} className="btn btn-outline btn-sm text-danger">{busy ? 'Blocking…' : `Block ${personName ?? 'them'}`}</button>
        </div>}
        {blocked && <p role="status" className="text-sm text-link">Blocked. You won’t see their posts.</p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="button" onClick={close} className="btn btn-primary w-full">Done</button>
      </div>}
    </BottomSheet>}
  </>
}

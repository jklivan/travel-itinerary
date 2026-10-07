'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { addComment, loadComments } from '@/actions/comments'
import { CommentInput, CommentRow, type Comment } from './Comments'
import BottomSheet from './ui/BottomSheet'

// Feed: comments open in a sheet over the feed instead of leaving for the trip page.
// The sheet loads the trip's comments itself and reloads them after you comment, reply or delete.
function Sheet({ itineraryId, title, onClose }: { itineraryId: string; title: string; onClose: (changed: boolean) => void }) {
  const changed = useRef(false)
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [userId, setUserId] = useState<string | undefined>()
  const [error, setError] = useState('')
  const load = useCallback(() => loadComments(itineraryId).then(result => {
    if (result.error) setError('These comments aren’t available.')
    setComments(result.comments); setUserId(result.userId)
  }, () => setError('Could not load comments. Please try again.')), [itineraryId])
  const changedAndReload = () => { changed.current = true; void load() }

  useEffect(() => {
    let active = true
    loadComments(itineraryId).then(result => {
      if (!active) return
      if (result.error) setError('These comments aren’t available.')
      setComments(result.comments); setUserId(result.userId)
    }, () => { if (active) setError('Could not load comments. Please try again.') })
    return () => { active = false }
  }, [itineraryId])

  return <BottomSheet title="Comments" label={`Comments on ${title}`} onClose={() => onClose(changed.current)}
    footer={userId ? <CommentInput placeholder="Add a comment…" onSubmit={async content => { const result = await addComment(itineraryId, content); if (result.error) setError(result.error); else changedAndReload() }} />
      : <p className="text-center text-sm text-muted"><Link href="/login" className="font-semibold text-link">Sign in</Link> to comment.</p>}>
    {error ? <p role="alert" className="text-sm text-danger">{error}</p>
      : comments === null ? <p className="text-sm text-muted">Loading comments…</p>
      : comments.length === 0 ? <p className="py-10 text-center text-sm text-muted">No comments yet. Start the conversation.</p>
      : <div className="space-y-4">{comments.map(comment => <CommentRow key={comment.id} comment={comment} itineraryId={itineraryId} currentUserId={userId} onChanged={changedAndReload} />)}</div>}
  </BottomSheet>
}

// The comment icon and "View all N comments" on a feed card; both open the sheet.
export default function CommentsSheetButton({ itineraryId, title, count, variant }: { itineraryId: string; title: string; count: number; variant: 'icon' | 'link' }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return <>
    {variant === 'icon'
      ? <button type="button" onClick={() => setOpen(true)} aria-label={`${count} comments`} className="flex min-h-8 items-center gap-1 text-label hover:text-link"><MessageCircle size={15} />{count}</button>
      : <button type="button" onClick={() => setOpen(true)} className="block text-left text-muted hover:text-link">View all {count} comments</button>}
    {open && <Sheet itineraryId={itineraryId} title={title} onClose={changed => { setOpen(false); if (changed) router.refresh() }} />}
  </>
}

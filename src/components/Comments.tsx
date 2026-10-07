'use client'

import Link from 'next/link'
import UserAvatar from './UserAvatar'
import { useState, useTransition } from 'react'
import { addComment, deleteComment } from '@/actions/comments'
import { Trash2 } from 'lucide-react'

export type Comment = {
  id: string
  content: string
  createdAt: Date
  user: { id: string; name: string; image?: string | null }
  replies: {
    id: string
    content: string
    createdAt: Date
    user: { id: string; name: string; image?: string | null }
  }[]
}

function Avatar({ name, image }: { name: string; image?: string | null }) {
  return <UserAvatar name={name} image={image} size={28} />
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function CommentInput({
  placeholder,
  onSubmit,
  autoFocus,
  onCancel,
}: {
  placeholder: string
  onSubmit: (content: string) => Promise<void>
  autoFocus?: boolean
  onCancel?: () => void
}) {
  const [text, setText] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | undefined>()

  function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed) return
    startTransition(async () => {
      setError(undefined)
      await onSubmit(trimmed)
      setText('')
    })
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={onCancel ? 'Your reply' : 'Your comment'}
        autoFocus={autoFocus}
        rows={3}
        className="field"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
        }}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={pending || !text.trim()}
          className="btn btn-primary btn-sm"
        >
          {pending ? 'Posting…' : 'Post'}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="btn btn-outline btn-sm"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

// onChanged: called after a delete or reply, for places that load comments themselves (the feed's comments sheet).
export function CommentRow({
  comment,
  itineraryId,
  currentUserId,
  isReply = false,
  onChanged,
}: {
  comment: Comment | Comment['replies'][number]
  itineraryId: string
  currentUserId: string | undefined
  isReply?: boolean
  onChanged?: () => void
}) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [, startTransition] = useTransition()

  const isOwn = currentUserId === comment.user.id
  const hasReplies = !isReply && 'replies' in comment && comment.replies.length > 0

  function handleDelete() {
    startTransition(async () => {
      await deleteComment(comment.id)
      onChanged?.()
    })
  }

  return (
    <div className={`flex gap-2.5 ${isReply ? 'pl-9' : ''}`}>
      <Link href={`/user/${comment.user.id}`} aria-label={comment.user.name} className="shrink-0"><Avatar name={comment.user.name} image={comment.user.image} /></Link>
      <div className="flex-1 min-w-0">
        <div className="bg-cream rounded-xl px-3 py-2">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <Link href={`/user/${comment.user.id}`} className="text-xs font-semibold text-ink hover:underline">{comment.user.name}</Link>
            <div className="flex items-center gap-2">
              <span className="text-label text-muted">{fmtDate(comment.createdAt)}</span>
              {isOwn && (
                <button onClick={handleDelete} title="Delete" className="text-line-strong hover:text-danger transition-colors">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-ink-soft whitespace-pre-line break-words">{comment.content}</p>
        </div>

        {!isReply && currentUserId && (
          <button
            onClick={() => setReplyOpen((o) => !o)}
            className="mt-1 ml-1 text-xs text-muted hover:text-link transition-colors"
          >
            Reply
          </button>
        )}

        {hasReplies && (
          <div className="mt-2 space-y-2">
            {(comment as Comment).replies.map((reply) => (
              <CommentRow
                key={reply.id}
                comment={reply}
                itineraryId={itineraryId}
                currentUserId={currentUserId}
                isReply
                onChanged={onChanged}
              />
            ))}
          </div>
        )}

        {replyOpen && (
          <div className="mt-2 pl-0">
            <CommentInput
              placeholder="Write a reply…"
              autoFocus
              onCancel={() => setReplyOpen(false)}
              onSubmit={async (content) => {
                const result = await addComment(itineraryId, content, comment.id)
                if (!result.error) { setReplyOpen(false); onChanged?.() }
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function Comments({
  itineraryId,
  initialComments,
  currentUserId,
  isLoggedIn,
}: {
  itineraryId: string
  initialComments: Comment[]
  currentUserId: string | undefined
  isLoggedIn: boolean
}) {
  return (
    <div id="comments" className="mt-6 pt-6 border-t border-line-soft scroll-mt-24">
      <h2 className="type-label mb-4">
        Comments {initialComments.length > 0 && <span className="text-muted font-normal">({initialComments.length})</span>}
      </h2>

      {initialComments.length > 0 && (
        <div className="space-y-4 mb-5">
          {initialComments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              itineraryId={itineraryId}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      {isLoggedIn ? (
        <CommentInput
          placeholder="Ask a question or leave a comment…"
          onSubmit={async (content) => {
            await addComment(itineraryId, content)
          }}
        />
      ) : (
        <p className="text-sm text-muted italic">
          <a href="/login" className="text-link hover:underline">Log in</a> to leave a comment.
        </p>
      )}
    </div>
  )
}

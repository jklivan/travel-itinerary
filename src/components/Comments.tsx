'use client'

import { useState, useTransition } from 'react'
import { addComment, deleteComment } from '@/actions/comments'
import { Trash2 } from 'lucide-react'

type Comment = {
  id: string
  content: string
  createdAt: Date
  user: { id: string; name: string }
  replies: {
    id: string
    content: string
    createdAt: Date
    user: { id: string; name: string }
  }[]
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
      {initials}
    </div>
  )
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CommentInput({
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
        autoFocus={autoFocus}
        rows={2}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
        }}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={pending || !text.trim()}
          className="text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? 'Posting…' : 'Post'}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-xs font-medium px-3 py-1.5 border border-gray-300 text-gray-600 rounded-full hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

function CommentRow({
  comment,
  itineraryId,
  currentUserId,
  isReply = false,
}: {
  comment: Comment | Comment['replies'][number]
  itineraryId: string
  currentUserId: string | undefined
  isReply?: boolean
}) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [, startTransition] = useTransition()

  const isOwn = currentUserId === comment.user.id
  const hasReplies = !isReply && 'replies' in comment && comment.replies.length > 0

  function handleDelete() {
    startTransition(async () => {
      await deleteComment(comment.id)
    })
  }

  return (
    <div className={`flex gap-2.5 ${isReply ? 'pl-9' : ''}`}>
      <Avatar name={comment.user.name} />
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 rounded-xl px-3 py-2">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-xs font-semibold text-gray-800">{comment.user.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">{fmtDate(comment.createdAt)}</span>
              {isOwn && (
                <button onClick={handleDelete} title="Delete" className="text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-line break-words">{comment.content}</p>
        </div>

        {!isReply && currentUserId && (
          <button
            onClick={() => setReplyOpen((o) => !o)}
            className="mt-1 ml-1 text-xs text-gray-400 hover:text-blue-500 transition-colors"
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
                if (!result.error) setReplyOpen(false)
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
    <div className="mt-6 pt-6 border-t border-gray-100">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">
        Comments {initialComments.length > 0 && <span className="text-gray-400 font-normal">({initialComments.length})</span>}
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
        <p className="text-sm text-gray-400 italic">
          <a href="/login" className="text-blue-500 hover:underline">Log in</a> to leave a comment.
        </p>
      )}
    </div>
  )
}

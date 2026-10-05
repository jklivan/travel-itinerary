'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { loadLikers } from '@/actions/likes'
import { sendFollowRequest, unfollowUser } from '@/actions/friends'
import UserAvatar from './UserAvatar'
import BottomSheet from './ui/BottomSheet'

type Liker = { id: string; name: string; image: string | null; following: boolean }

function FollowButton({ liker, onChange }: { liker: Liker; onChange: (following: boolean) => void }) {
  const [pending, startTransition] = useTransition()
  return <button type="button" disabled={pending} aria-pressed={liker.following} onClick={() => startTransition(async () => {
    if (liker.following) await unfollowUser(liker.id); else await sendFollowRequest(liker.id)
    onChange(!liker.following)
  })} className="chip shrink-0">{liker.following ? 'Following' : 'Follow'}</button>
}

// Feed: "Liked by … and N others" opens who liked the trip, each with Follow, like Instagram.
function Sheet({ itineraryId, title, onClose }: { itineraryId: string; title: string; onClose: (changed: boolean) => void }) {
  const changed = useRef(false)
  const [likers, setLikers] = useState<Liker[] | null>(null)
  const [userId, setUserId] = useState<string | undefined>()
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    loadLikers(itineraryId).then(result => {
      if (!active) return
      if (result.error) setError('These likes aren’t available.')
      setLikers(result.likers); setUserId(result.userId)
    }, () => { if (active) setError('Could not load likes. Please try again.') })
    return () => { active = false }
  }, [itineraryId])
  return <BottomSheet title="Likes" label={`People who liked ${title}`} onClose={() => onClose(changed.current)}>
    {error ? <p role="alert" className="text-sm text-danger">{error}</p>
      : likers === null ? <p className="text-sm text-muted">Loading…</p>
      : likers.length === 0 ? <p className="py-10 text-center text-sm text-muted">No likes yet.</p>
      : <ul className="space-y-3">{likers.map(liker => <li key={liker.id} className="flex items-center justify-between gap-3">
        <Link href={`/user/${liker.id}`} className="flex min-w-0 items-center gap-3 hover:opacity-80">
          <UserAvatar name={liker.name} image={liker.image} size={40} />
          <span className="truncate text-sm font-semibold text-ink">{liker.name}</span>
        </Link>
        {userId && liker.id !== userId && <FollowButton liker={liker} onChange={following => { changed.current = true; setLikers(current => current?.map(item => item.id === liker.id ? { ...item, following } : item) ?? null) }} />}
      </li>)}</ul>}
  </BottomSheet>
}

export default function LikesSheetButton({ itineraryId, title, children }: { itineraryId: string; title: string; children: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" onClick={() => setOpen(true)} className="font-semibold text-ink hover:underline">{children}</button>
    {open && <Sheet itineraryId={itineraryId} title={title} onClose={changed => { setOpen(false); if (changed) router.refresh() }} />}
  </>
}

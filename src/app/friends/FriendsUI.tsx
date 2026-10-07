'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Users, Search, UserPlus } from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'
import SearchField from '@/components/ui/SearchField'
import {
  searchUsers,
  sendFollowRequest,
  cancelFollowRequest,
  acceptFollowRequest,
  rejectFollowRequest,
  unfollowUser,
} from '@/actions/friends'

type User = { id: string; name: string; image?: string | null }

function Avatar({ name, image }: { name: string; image?: string | null }) {
  return <UserAvatar name={name} image={image} size={48} />
}

function FollowButton({
  userId, status, onFollow, onCancel, onUnfollow,
}: {
  userId: string
  status: 'none' | 'pending' | 'following'
  onFollow: (id: string) => void
  onCancel: (id: string) => void
  onUnfollow: (id: string) => void
}) {
  if (status === 'following') {
    return (
      <button onClick={() => onUnfollow(userId)}
        className="chip">
        Following
      </button>
    )
  }
  if (status === 'pending') {
    return (
      <button onClick={() => onCancel(userId)}
        className="chip">
        Requested
      </button>
    )
  }
  return (
    <button onClick={() => onFollow(userId)}
      className="btn btn-primary btn-sm">
      <UserPlus size={12} />
      Follow
    </button>
  )
}

export default function FriendsUI({
  following,
  pendingOutgoing,
  incomingRequests,
}: {
  following: User[]
  pendingOutgoing: User[]
  incomingRequests: User[]
}) {
  const [nameQuery, setNameQuery] = useState('')
  const [nameResults, setNameResults] = useState<User[]>([])
  const [nameSearched, setNameSearched] = useState(false)
  const [followingIds, setFollowingIds] = useState(new Set(following.map((u) => u.id)))
  const [pendingIds, setPendingIds] = useState(new Set(pendingOutgoing.map((u) => u.id)))
  const [requests, setRequests] = useState(incomingRequests)
  const [followingList, setFollowingList] = useState(following)
  const [, startTransition] = useTransition()

  function followStatus(userId: string): 'none' | 'pending' | 'following' {
    if (followingIds.has(userId)) return 'following'
    if (pendingIds.has(userId)) return 'pending'
    return 'none'
  }

  async function handleNameSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!nameQuery.trim()) return
    setNameResults(await searchUsers(nameQuery))
    setNameSearched(true)
  }

  function handleFollow(userId: string) {
    startTransition(async () => {
      await sendFollowRequest(userId)
      setPendingIds((prev) => new Set([...prev, userId]))
    })
  }

  function handleCancel(userId: string) {
    startTransition(async () => {
      await cancelFollowRequest(userId)
      setPendingIds((prev) => { const n = new Set(prev); n.delete(userId); return n })
    })
  }

  function handleUnfollow(userId: string) {
    startTransition(async () => {
      await unfollowUser(userId)
      setFollowingIds((prev) => { const n = new Set(prev); n.delete(userId); return n })
      setFollowingList((prev) => prev.filter((u) => u.id !== userId))
    })
  }

  function handleAccept(user: User) {
    startTransition(async () => {
      await acceptFollowRequest(user.id)
      setRequests((prev) => prev.filter((r) => r.id !== user.id))
      setFollowingIds((prev) => new Set([...prev, user.id]))
      setFollowingList((prev) => [user, ...prev])
    })
  }

  function handleReject(userId: string) {
    startTransition(async () => {
      await rejectFollowRequest(userId)
      setRequests((prev) => prev.filter((r) => r.id !== userId))
    })
  }

  return (
    <div className="space-y-5">
      {/* Incoming requests */}
      {requests.length > 0 && (
        <section className="bg-cream rounded-xl border border-sand overflow-hidden">
          <div className="bg-sand border-b border-sand px-5 py-3 flex items-center gap-2">
            <Users size={16} className="text-brown" />
            <h2 className="type-label text-ink">
              Follow requests
              <span className="ml-2 text-brown">({requests.length})</span>
            </h2>
          </div>
          <ul className="divide-y divide-sand">
            {requests.map((user) => (
              <li key={user.id} className="flex items-center justify-between px-5 py-3">
                <Link href={`/user/${user.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <Avatar name={user.name} image={user.image} />
                  <p className="text-sm font-medium text-ink">{user.name}</p>
                </Link>
                <div className="flex gap-2">
                  <button onClick={() => handleAccept(user)}
                    className="btn btn-primary btn-sm">
                    Accept
                  </button>
                  <button onClick={() => handleReject(user.id)}
                    className="chip">
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Search */}
      <section className="bg-cream rounded-xl border border-sand overflow-hidden">
        <div className="px-5 py-3 border-b border-sand flex items-center gap-2">
          <Search size={16} className="text-brown" />
          <h2 className="type-label text-ink">Find travelers</h2>
        </div>
        <div className="p-4">
          <form onSubmit={handleNameSearch}>
            <SearchField value={nameQuery} aria-label="Search travelers by name"
              onChange={(e) => { setNameQuery(e.target.value); setNameSearched(false) }}
              placeholder="Search by name…" buttonLabel="Search" />
          </form>
          {nameSearched && nameResults.length === 0 && (
            <p className="mt-4 text-sm text-brown italic">No users found.</p>
          )}
          {nameResults.length > 0 && (
            <ul className="mt-4 divide-y divide-sand">
              {nameResults.map((user) => (
                <li key={user.id} className="flex items-center justify-between py-3">
                  <Link href={`/user/${user.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <Avatar name={user.name} image={user.image} />
                    <p className="text-sm font-medium text-ink">{user.name}</p>
                  </Link>
                  <FollowButton userId={user.id} status={followStatus(user.id)}
                    onFollow={handleFollow} onCancel={handleCancel} onUnfollow={handleUnfollow} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Following list */}
      <section className="bg-cream rounded-xl border border-sand overflow-hidden">
        <div className="px-5 py-3 border-b border-sand flex items-center gap-2">
          <Users size={16} className="text-brown" />
          <h2 className="type-label text-ink">
            People you follow
            {followingList.length > 0 && (
              <span className="ml-2 text-brown font-normal">({followingList.length})</span>
            )}
          </h2>
        </div>
        {followingList.length === 0 ? (
          <p className="text-sm text-brown italic p-5">
            You&apos;re not following anyone yet. Search above to find travelers.
          </p>
        ) : (
          <ul className="divide-y divide-sand">
            {followingList.map((user) => (
              <li key={user.id} className="flex items-center justify-between px-5 py-3">
                <Link href={`/user/${user.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <Avatar name={user.name} image={user.image} />
                  <p className="text-sm font-medium text-ink">{user.name}</p>
                </Link>
                <button onClick={() => handleUnfollow(user.id)}
                  className="chip">
                  Unfollow
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

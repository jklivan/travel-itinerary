'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  searchUsers,
  searchUsersByDestination,
  sendFollowRequest,
  cancelFollowRequest,
  acceptFollowRequest,
  rejectFollowRequest,
  unfollowUser,
} from '@/actions/friends'

type User = { id: string; name: string }
type DestUser = { id: string; name: string; matchedDestinations: string[] }

function FollowButton({
  userId,
  status,
  onFollow,
  onCancel,
  onUnfollow,
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
        className="text-xs font-medium px-3 py-1 rounded-full border border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-500 transition-colors">
        Following
      </button>
    )
  }
  if (status === 'pending') {
    return (
      <button onClick={() => onCancel(userId)}
        className="text-xs font-medium px-3 py-1 rounded-full border border-amber-300 text-amber-700 hover:border-red-300 hover:text-red-500 transition-colors">
        Requested
      </button>
    )
  }
  return (
    <button onClick={() => onFollow(userId)}
      className="text-xs font-medium px-3 py-1 rounded-full border border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors">
      + Follow
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
  const [tab, setTab] = useState<'name' | 'destination'>('name')
  const [nameQuery, setNameQuery] = useState('')
  const [destQuery, setDestQuery] = useState('')
  const [nameResults, setNameResults] = useState<User[]>([])
  const [destResults, setDestResults] = useState<DestUser[]>([])
  const [nameSearched, setNameSearched] = useState(false)
  const [destSearched, setDestSearched] = useState(false)
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

  async function handleDestSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!destQuery.trim()) return
    setDestResults(await searchUsersByDestination(destQuery))
    setDestSearched(true)
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
    <div className="space-y-8">
      {/* Incoming requests */}
      {requests.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            Follow requests
            <span className="ml-2 text-sm font-normal text-amber-700">({requests.length})</span>
          </h2>
          <ul className="divide-y divide-amber-100">
            {requests.map((user) => (
              <li key={user.id} className="flex items-center justify-between py-3">
                <Link href={`/user/${user.id}`} className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors">{user.name}</Link>
                <div className="flex gap-2">
                  <button onClick={() => handleAccept(user)}
                    className="text-xs font-medium px-3 py-1 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                    Accept
                  </button>
                  <button onClick={() => handleReject(user.id)}
                    className="text-xs font-medium px-3 py-1 rounded-full border border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-500 transition-colors">
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Search */}
      <section className="bg-white rounded-2xl shadow-md p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Find travellers</h2>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 text-sm font-medium mb-4 w-fit">
          <button onClick={() => setTab('name')}
            className={`px-4 py-1.5 rounded-lg transition-colors ${tab === 'name' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-700 hover:text-gray-900'}`}>
            By name
          </button>
          <button onClick={() => setTab('destination')}
            className={`px-4 py-1.5 rounded-lg transition-colors ${tab === 'destination' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-700 hover:text-gray-900'}`}>
            By destination
          </button>
        </div>

        {tab === 'name' && (
          <>
            <form onSubmit={handleNameSearch} className="flex gap-2">
              <input type="text" value={nameQuery}
                onChange={(e) => { setNameQuery(e.target.value); setNameSearched(false) }}
                placeholder="Search by name…"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit"
                className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                Search
              </button>
            </form>
            {nameSearched && nameResults.length === 0 && (
              <p className="mt-4 text-sm text-gray-900 italic">No users found.</p>
            )}
            {nameResults.length > 0 && (
              <ul className="mt-4 divide-y divide-gray-100">
                {nameResults.map((user) => (
                  <li key={user.id} className="flex items-center justify-between py-3">
                    <Link href={`/user/${user.id}`} className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors">{user.name}</Link>
                    <FollowButton userId={user.id} status={followStatus(user.id)}
                      onFollow={handleFollow} onCancel={handleCancel} onUnfollow={handleUnfollow} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'destination' && (
          <>
            <form onSubmit={handleDestSearch} className="flex gap-2">
              <input type="text" value={destQuery}
                onChange={(e) => { setDestQuery(e.target.value); setDestSearched(false) }}
                placeholder="e.g. Tokyo, France, Bali…"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit"
                className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                Search
              </button>
            </form>
            {destSearched && destResults.length === 0 && (
              <p className="mt-4 text-sm text-gray-900 italic">No travellers found for that destination.</p>
            )}
            {destResults.length > 0 && (
              <ul className="mt-4 divide-y divide-gray-100">
                {destResults.map((user) => (
                  <li key={user.id} className="flex items-center justify-between py-3 gap-4">
                    <div>
                      <Link href={`/user/${user.id}`} className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors">{user.name}</Link>
                      <p className="text-xs text-gray-900 mt-0.5">
                        📍 {user.matchedDestinations.join(' · ')}
                      </p>
                    </div>
                    <FollowButton userId={user.id} status={followStatus(user.id)}
                      onFollow={handleFollow} onCancel={handleCancel} onUnfollow={handleUnfollow} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* Following list */}
      <section className="bg-white rounded-2xl shadow-md p-6">
        <h2 className="font-semibold text-gray-900 mb-4">
          People you follow
          {followingList.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-900">({followingList.length})</span>
          )}
        </h2>
        {followingList.length === 0 ? (
          <p className="text-sm text-gray-900 italic">
            You&apos;re not following anyone yet. Search above to find travellers.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {followingList.map((user) => (
              <li key={user.id} className="flex items-center justify-between py-3">
                <Link href={`/user/${user.id}`} className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors">{user.name}</Link>
                <button onClick={() => handleUnfollow(user.id)}
                  className="text-xs font-medium px-3 py-1 rounded-full border border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-500 transition-colors">
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

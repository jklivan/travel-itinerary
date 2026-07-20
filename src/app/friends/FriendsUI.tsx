'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Users, Search, UserPlus, MapPin } from 'lucide-react'
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

const AVATAR_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6',
  '#F59E0B', '#EF4444', '#10B981', '#3B82F6',
]
function hashPick(str: string, arr: string[]) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return arr[Math.abs(h) % arr.length]
}
function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
      style={{ backgroundColor: hashPick(name, AVATAR_COLORS) }}
    >
      {getInitials(name)}
    </div>
  )
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
        className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-500 transition-colors">
        Following
      </button>
    )
  }
  if (status === 'pending') {
    return (
      <button onClick={() => onCancel(userId)}
        className="text-xs font-medium px-3 py-1.5 rounded-full border border-amber-300 text-amber-700 hover:border-red-300 hover:text-red-500 transition-colors">
        Requested
      </button>
    )
  }
  return (
    <button onClick={() => onFollow(userId)}
      className="text-xs font-medium px-3 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1">
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
    <div className="space-y-5">
      {/* Incoming requests */}
      {requests.length > 0 && (
        <section className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-100 px-5 py-3 flex items-center gap-2">
            <Users size={16} className="text-amber-600" />
            <h2 className="font-semibold text-gray-900 text-sm">
              Follow requests
              <span className="ml-2 text-amber-700">({requests.length})</span>
            </h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {requests.map((user) => (
              <li key={user.id} className="flex items-center justify-between px-5 py-3">
                <Link href={`/user/${user.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <Avatar name={user.name} />
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                </Link>
                <div className="flex gap-2">
                  <button onClick={() => handleAccept(user)}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                    Accept
                  </button>
                  <button onClick={() => handleReject(user.id)}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-500 transition-colors">
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Search */}
      <section className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Search size={16} className="text-gray-400" />
          <h2 className="font-semibold text-gray-900 text-sm">Find travellers</h2>
        </div>
        <div className="p-4">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 text-sm font-medium mb-4 w-fit">
            <button onClick={() => setTab('name')}
              className={`px-4 py-1.5 rounded-lg transition-colors ${tab === 'name' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              By name
            </button>
            <button onClick={() => setTab('destination')}
              className={`px-4 py-1.5 rounded-lg transition-colors ${tab === 'destination' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              By destination
            </button>
          </div>

          {tab === 'name' && (
            <>
              <form onSubmit={handleNameSearch} className="flex gap-2">
                <input type="text" value={nameQuery}
                  onChange={(e) => { setNameQuery(e.target.value); setNameSearched(false) }}
                  placeholder="Search by name…"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="submit"
                  className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                  Search
                </button>
              </form>
              {nameSearched && nameResults.length === 0 && (
                <p className="mt-4 text-sm text-gray-500 italic">No users found.</p>
              )}
              {nameResults.length > 0 && (
                <ul className="mt-4 divide-y divide-gray-100">
                  {nameResults.map((user) => (
                    <li key={user.id} className="flex items-center justify-between py-3">
                      <Link href={`/user/${user.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <Avatar name={user.name} />
                        <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      </Link>
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
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="submit"
                  className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                  Search
                </button>
              </form>
              {destSearched && destResults.length === 0 && (
                <p className="mt-4 text-sm text-gray-500 italic">No travellers found for that destination.</p>
              )}
              {destResults.length > 0 && (
                <ul className="mt-4 divide-y divide-gray-100">
                  {destResults.map((user) => (
                    <li key={user.id} className="flex items-center justify-between py-3 gap-4">
                      <Link href={`/user/${user.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0">
                        <Avatar name={user.name} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                            <MapPin size={10} />
                            {user.matchedDestinations.join(' · ')}
                          </p>
                        </div>
                      </Link>
                      <FollowButton userId={user.id} status={followStatus(user.id)}
                        onFollow={handleFollow} onCancel={handleCancel} onUnfollow={handleUnfollow} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>

      {/* Following list */}
      <section className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Users size={16} className="text-gray-400" />
          <h2 className="font-semibold text-gray-900 text-sm">
            People you follow
            {followingList.length > 0 && (
              <span className="ml-2 text-gray-400 font-normal">({followingList.length})</span>
            )}
          </h2>
        </div>
        {followingList.length === 0 ? (
          <p className="text-sm text-gray-500 italic p-5">
            You&apos;re not following anyone yet. Search above to find travellers.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {followingList.map((user) => (
              <li key={user.id} className="flex items-center justify-between px-5 py-3">
                <Link href={`/user/${user.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <Avatar name={user.name} />
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                </Link>
                <button onClick={() => handleUnfollow(user.id)}
                  className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-500 transition-colors">
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

'use client'

import { useState, useTransition } from 'react'
import { searchUsers, searchUsersByDestination, followUser, unfollowUser } from '@/actions/friends'

type User = { id: string; name: string }
type DestUser = { id: string; name: string; matchedDestinations: string[] }

function FollowButton({
  userId,
  isFollowing,
  onFollow,
  onUnfollow,
}: {
  userId: string
  isFollowing: boolean
  onFollow: (id: string) => void
  onUnfollow: (id: string) => void
}) {
  return isFollowing ? (
    <button onClick={() => onUnfollow(userId)}
      className="text-xs font-medium px-3 py-1 rounded-full border border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors">
      Following
    </button>
  ) : (
    <button onClick={() => onFollow(userId)}
      className="text-xs font-medium px-3 py-1 rounded-full border border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors">
      + Follow
    </button>
  )
}

export default function FriendsUI({ following }: { following: User[] }) {
  const [tab, setTab] = useState<'name' | 'destination'>('name')
  const [nameQuery, setNameQuery] = useState('')
  const [destQuery, setDestQuery] = useState('')
  const [nameResults, setNameResults] = useState<User[]>([])
  const [destResults, setDestResults] = useState<DestUser[]>([])
  const [nameSearched, setNameSearched] = useState(false)
  const [destSearched, setDestSearched] = useState(false)
  const [followingIds, setFollowingIds] = useState<Set<string>>(
    new Set(following.map((u) => u.id))
  )
  const [, startTransition] = useTransition()

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
      await followUser(userId)
      setFollowingIds((prev) => new Set([...prev, userId]))
    })
  }

  function handleUnfollow(userId: string) {
    startTransition(async () => {
      await unfollowUser(userId)
      setFollowingIds((prev) => { const n = new Set(prev); n.delete(userId); return n })
    })
  }

  return (
    <div className="space-y-8">
      {/* Search */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Find travellers</h2>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 text-sm font-medium mb-4 w-fit">
          <button
            onClick={() => setTab('name')}
            className={`px-4 py-1.5 rounded-lg transition-colors ${tab === 'name' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
            By name
          </button>
          <button
            onClick={() => setTab('destination')}
            className={`px-4 py-1.5 rounded-lg transition-colors ${tab === 'destination' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
            By destination
          </button>
        </div>

        {tab === 'name' && (
          <>
            <form onSubmit={handleNameSearch} className="flex gap-2">
              <input type="text" value={nameQuery}
                onChange={(e) => { setNameQuery(e.target.value); setNameSearched(false) }}
                placeholder="Search by name…"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit"
                className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                Search
              </button>
            </form>
            {nameSearched && nameResults.length === 0 && (
              <p className="mt-4 text-sm text-gray-400 italic">No users found.</p>
            )}
            {nameResults.length > 0 && (
              <ul className="mt-4 divide-y divide-gray-100">
                {nameResults.map((user) => (
                  <li key={user.id} className="flex items-center justify-between py-3">
                    <span className="text-sm font-medium text-gray-800">{user.name}</span>
                    <FollowButton userId={user.id} isFollowing={followingIds.has(user.id)}
                      onFollow={handleFollow} onUnfollow={handleUnfollow} />
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
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit"
                className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                Search
              </button>
            </form>
            {destSearched && destResults.length === 0 && (
              <p className="mt-4 text-sm text-gray-400 italic">No travellers found for that destination.</p>
            )}
            {destResults.length > 0 && (
              <ul className="mt-4 divide-y divide-gray-100">
                {destResults.map((user) => (
                  <li key={user.id} className="flex items-center justify-between py-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{user.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        📍 {user.matchedDestinations.join(' · ')}
                      </p>
                    </div>
                    <FollowButton userId={user.id} isFollowing={followingIds.has(user.id)}
                      onFollow={handleFollow} onUnfollow={handleUnfollow} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* Following list */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">
          People you follow
          {followingIds.size > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-400">({followingIds.size})</span>
          )}
        </h2>
        {followingIds.size === 0 ? (
          <p className="text-sm text-gray-400 italic">
            You&apos;re not following anyone yet. Search above to find travellers.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {following.filter((u) => followingIds.has(u.id)).map((user) => (
              <li key={user.id} className="flex items-center justify-between py-3">
                <span className="text-sm font-medium text-gray-800">{user.name}</span>
                <button onClick={() => handleUnfollow(user.id)}
                  className="text-xs font-medium px-3 py-1 rounded-full border border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors">
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
